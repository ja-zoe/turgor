/**
 * Migration drift canary (R31.2). Replays every migrations/NNN-*.sql into a
 * scratch schema, then structurally diffs it against the live `public` schema
 * (columns, enums, indexes, PK/FK/unique constraints). Exits 1 on any
 * unexpected difference — run after adding a migration to prove that a fresh
 * install (migrations replayed from zero) matches the database the app
 * actually runs on.
 *
 *   pnpm exec tsx scripts/verify-migrations.ts
 *
 * ACCEPTED_DRIFT lists known pre-migrations legacy differences in the live dev
 * DB (dead columns from early ad-hoc DDL, the Milestone→Deliverable constraint
 * names, two FKs without ON UPDATE CASCADE, DB-level defaults Prisma supplies
 * client-side). Documented in changes/31-ship-readiness/R31.2. Do not grow
 * this list without the same scrutiny.
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import pg from "pg";
import "dotenv/config";

const { Client } = pg;
const SCRATCH = "migrations_check";
const MIGRATIONS_DIR = join(import.meta.dirname, "..", "migrations");

const ACCEPTED_DRIFT = new Set([
  "column:CalendarEvent.semesters",
  "column:CalendarEvent.updatedAt",
  "column:Notification.body",
  "column:Notification.type",
  "column:NotificationRule.channel",
  "column:ProjectAssignment.createdAt",
  "column:ProjectAssignment.role",
  "column:Role.description",
  "column:StatusUpdate.createdAt",
  "column:StatusUpdate.updatedAt",
  "column:Subtask.updatedAt",
  "index:Milestone_pkey",
  "index:Deliverable_pkey",
  "constraint:CalendarEvent_projectId_fkey",
  "constraint:Milestone_pkey",
  "constraint:Milestone_projectId_fkey",
  "constraint:StatusUpdate_calendarEventId_fkey",
  "constraint:Deliverable_pkey",
  "constraint:Deliverable_projectId_fkey",
]);

const norm = (s: string | null) =>
  (s ?? "")
    .replaceAll(`${SCRATCH}.`, "")
    .replaceAll(`"${SCRATCH}".`, "")
    .replaceAll("public.", "")
    .replaceAll('"public".', "")
    // same function, two serializations
    .replaceAll("CURRENT_TIMESTAMP", "now()")
    .replace(/\s+/g, " ")
    .trim();

async function snapshot(client: pg.Client, schema: string) {
  const cols = await client.query(
    `SELECT table_name, column_name, udt_name, is_nullable, column_default
     FROM information_schema.columns WHERE table_schema = $1
       AND table_name <> '_migrations'
     ORDER BY table_name, column_name`,
    [schema],
  );
  const enums = await client.query(
    `SELECT t.typname, array_to_string(array_agg(e.enumlabel ORDER BY e.enumsortorder), ',') AS labels
     FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
     JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = $1 GROUP BY t.typname ORDER BY t.typname`,
    [schema],
  );
  const idx = await client.query(
    `SELECT indexname, indexdef FROM pg_indexes
     WHERE schemaname = $1 AND tablename <> '_migrations' ORDER BY indexname`,
    [schema],
  );
  const fks = await client.query(
    `SELECT conname, pg_get_constraintdef(c.oid) AS def
     FROM pg_constraint c
     JOIN pg_namespace n ON n.oid = c.connamespace
     JOIN pg_class t ON t.oid = c.conrelid
     WHERE n.nspname = $1 AND contype IN ('f','p','u') AND t.relname <> '_migrations'
     ORDER BY conname`,
    [schema],
  );
  return {
    column: new Map<string, string>(
      cols.rows.map((r) => [
        `${r.table_name}.${r.column_name}`,
        `${r.udt_name}|${r.is_nullable}|${norm(r.column_default)}`,
      ]),
    ),
    enum: new Map<string, string>(enums.rows.map((r) => [r.typname, r.labels])),
    index: new Map<string, string>(
      idx.rows.map((r) => [
        r.indexname,
        norm(r.indexdef).replace(new RegExp(`ON ${SCRATCH}\\.|ON public\\.`, "g"), "ON "),
      ]),
    ),
    constraint: new Map<string, string>(fks.rows.map((r) => [r.conname, norm(r.def)])),
  };
}

function diffMaps(label: string, live: Map<string, string>, replay: Map<string, string>) {
  let bad = 0;
  const report = (key: string, msg: string) => {
    if (ACCEPTED_DRIFT.has(`${label}:${key}`)) return;
    console.log(msg);
    bad++;
  };
  for (const [k, v] of live) {
    if (!replay.has(k)) report(k, `  [live only] ${label}: ${k} = ${v}`);
    else if (replay.get(k) !== v)
      report(k, `  [differs] ${label}: ${k}\n    live:   ${v}\n    replay: ${replay.get(k)}`);
  }
  for (const k of replay.keys())
    if (!live.has(k)) report(k, `  [replay only] ${label}: ${k} = ${replay.get(k)}`);
  return bad;
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${SCRATCH} CASCADE`);
    await client.query(`CREATE SCHEMA ${SCRATCH}`);
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d+-.+\.sql$/.test(f))
      .sort();
    for (const f of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8")
        .replace(`CREATE SCHEMA IF NOT EXISTS "public";`, "");
      await client.query("BEGIN");
      await client.query(`SET LOCAL search_path TO ${SCRATCH}`);
      await client.query(sql);
      await client.query("COMMIT");
      console.log(`replayed  ${f}`);
    }

    const live = await snapshot(client, "public");
    const replay = await snapshot(client, SCRATCH);
    let bad = 0;
    for (const label of ["column", "enum", "index", "constraint"] as const) {
      bad += diffMaps(label, live[label], replay[label]);
    }
    console.log(
      bad === 0
        ? "OK — replayed migrations structurally match the live schema (accepted legacy drift excluded)"
        : `${bad} UNEXPECTED DIFFERENCES`,
    );
    process.exitCode = bad === 0 ? 0 : 1;
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${SCRATCH} CASCADE`).catch(() => {});
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

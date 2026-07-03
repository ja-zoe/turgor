/**
 * Versioned migration runner (R31.2).
 *
 * Applies the numbered SQL files in migrations/ (NNN-slug.sql, filename order)
 * that are not yet recorded in the _migrations ledger table. Each file runs in
 * its own transaction and is recorded on success; the first failure aborts.
 *
 *   pnpm db:migrate            apply all pending migrations
 *   pnpm db:migrate:status     list applied/pending, change nothing
 *   pnpm db:migrate:baseline   record all files as applied WITHOUT running them
 *                              (one-time onboarding for a database that already
 *                              has the schema, e.g. a pre-migrations deployment)
 *
 * Uses a raw pg Client against DATABASE_URL — never the Prisma schema engine,
 * which hangs against the Supabase pooler (see changes/CONTEXT.md).
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import pg from "pg";
import "dotenv/config";

const { Client } = pg;
const MIGRATIONS_DIR = join(import.meta.dirname, "..", "migrations");

const LEDGER_DDL = `CREATE TABLE IF NOT EXISTS _migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
)`;

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+-.+\.sql$/.test(f))
    .sort();
}

async function main() {
  const mode = process.argv[2] ?? "apply";
  if (!["apply", "--status", "--baseline"].includes(mode)) {
    console.error(`Unknown argument: ${mode} (expected --status or --baseline)`);
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set (see .env.example)");
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(LEDGER_DDL);
    const applied = new Set(
      (await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name),
    );
    const files = migrationFiles();
    const pending = files.filter((f) => !applied.has(f));

    // A pending file sorting before an already-applied one usually means a file
    // was added out of order or renamed; warn but proceed in filename order.
    const lastApplied = files.filter((f) => applied.has(f)).at(-1);
    if (lastApplied) {
      for (const f of pending) {
        if (f < lastApplied) {
          console.warn(`warning: ${f} sorts before already-applied ${lastApplied}`);
        }
      }
    }

    if (mode === "--status") {
      for (const f of files) console.log(`${applied.has(f) ? "applied" : "pending"}  ${f}`);
      console.log(`${applied.size} applied, ${pending.length} pending`);
      return;
    }

    if (mode === "--baseline") {
      for (const f of pending) {
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [f]);
        console.log(`recorded (not run)  ${f}`);
      }
      console.log(pending.length === 0 ? "nothing to record" : `${pending.length} recorded`);
      return;
    }

    if (pending.length === 0) {
      console.log("up to date — nothing to apply");
      return;
    }
    for (const f of pending) {
      const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [f]);
        await client.query("COMMIT");
        console.log(`applied  ${f}`);
      } catch (e) {
        await client.query("ROLLBACK");
        console.error(`FAILED  ${f} — rolled back, nothing recorded`);
        console.error((e as Error).message);
        process.exit(1);
      }
    }
    console.log(`${pending.length} applied`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

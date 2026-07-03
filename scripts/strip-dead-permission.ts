// R26.1 one-off: remove the retired VIEW_ASSIGNED_PROJECTS value from every
// Role.permissions array. No gate reads the value, so this is behavior-preserving;
// the enum value itself stays in the DB (dropping enum values needs a table rewrite).
// Run with: tsx scripts/strip-dead-permission.ts
import pg from "pg";
import "dotenv/config";

const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const res = await client.query(
    `UPDATE "Role"
     SET permissions = array_remove(permissions, 'VIEW_ASSIGNED_PROJECTS'::"Permission")
     WHERE 'VIEW_ASSIGNED_PROJECTS' = ANY(permissions)`
  );
  console.log(`Stripped VIEW_ASSIGNED_PROJECTS from ${res.rowCount} role(s).`);

  const check = await client.query(
    `SELECT count(*)::int AS n FROM "Role" WHERE 'VIEW_ASSIGNED_PROJECTS' = ANY(permissions)`
  );
  console.log(`Roles still carrying the value: ${check.rows[0].n}`);

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

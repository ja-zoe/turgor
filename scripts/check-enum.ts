import pg from "pg";
import "dotenv/config";

const { Client } = pg;

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query(
    `SELECT enum_range(NULL::"NotificationType")::text AS vals`
  );
  console.log("NotificationType:", r.rows[0].vals);
  await c.end();
}

main().catch(console.error);

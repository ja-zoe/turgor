import pg from "pg";
import "dotenv/config";

const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log("Connected!");

  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
  );
  console.log(
    "Tables:",
    tables.rows.map((r) => r.table_name)
  );

  const enums = await client.query(
    `SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname`
  );
  console.log(
    "Enums:",
    enums.rows.map((r) => r.typname)
  );

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

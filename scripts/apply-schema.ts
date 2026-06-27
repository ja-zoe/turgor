import { readFileSync } from "fs";
import pg from "pg";
import "dotenv/config";

const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log("Connected to Supabase!");

  const sql = readFileSync("/tmp/schema.sql", "utf8");
  try {
    await client.query(sql);
    console.log("Schema applied successfully!");
  } catch (e: unknown) {
    const msg = (e as Error).message;
    console.error("Error applying schema:", msg);
    throw e;
  }
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

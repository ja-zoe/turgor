import pg from "pg";
import "dotenv/config";

const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Check enum values for the differently-named enums
  for (const enumName of [
    "Channel",
    "RecipientGroup",
    "TimelineStatus",
    "Permission",
    "DeliverableStatus",
    "SubtaskStatus",
    "NotificationChannel",
    "NotificationRecipient",
  ]) {
    try {
      const r = await client.query(
        `SELECT enum_range(NULL::"${enumName}")::text AS vals`
      );
      console.log(enumName, ":", r.rows[0].vals);
    } catch {
      console.log(enumName, ": NOT FOUND");
    }
  }

  // Check column types for Deliverable and Notification tables
  const cols = await client.query(`
    SELECT table_name, column_name, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('Deliverable', 'Subtask', 'NotificationRule', 'Notification')
    ORDER BY table_name, ordinal_position
  `);
  console.log("\nColumn types:");
  for (const row of cols.rows) {
    console.log(`  ${row.table_name}.${row.column_name}: ${row.udt_name}`);
  }

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

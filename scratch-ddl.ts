import "dotenv/config";
import { Client } from "pg";
const stmts = [
  `ALTER TYPE "CalendarEventType" ADD VALUE IF NOT EXISTS 'LEAD_MEETING'`,
  `ALTER TYPE "CalendarEventType" ADD VALUE IF NOT EXISTS 'EBOARD_MEETING'`,
  `ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'VIEW_LEAD_MEETINGS'`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "statusSubmitWindowDays" INTEGER NOT NULL DEFAULT 3`,
];
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await c.connect();
  for (const s of stmts) {
    try { await c.query(s); console.log("OK:", s.slice(0, 60)); }
    catch (e:any) { console.error("ERR:", s.slice(0,60), "->", e.message); }
  }
  await c.end();
})().catch(e=>{console.error(e.message);process.exit(1)});

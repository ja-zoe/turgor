import "dotenv/config";

const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("CRON_SECRET is not set");
  process.exit(1);
}

const res = await fetch(`${baseUrl}/api/cron/notifications`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
});

const json = await res.json();
console.log(json);

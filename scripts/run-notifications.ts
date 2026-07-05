import "dotenv/config";

// Wrapped in main() rather than top-level await: the tsx/esbuild cjs transform
// used to run this script does not support top-level await.
async function main() {
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

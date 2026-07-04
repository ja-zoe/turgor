/**
 * Pre-dev database guard.
 *
 * Runs before `next dev` (wired into the `dev` script). Its only job is to make
 * sure DATABASE_URL is reachable before the dev server boots, so you don't get a
 * wall of JWTSessionError / connection failures from a Postgres that simply
 * wasn't started yet.
 *
 * Behaviour:
 *   1. Try to connect to DATABASE_URL (short timeout). If it works, do nothing.
 *   2. If it fails and the URL points at a LOCAL host (localhost/127.0.0.1/::1)
 *      and Docker Compose is available, run `docker compose up -d` and wait for
 *      the `db` service to become healthy, then re-check the connection.
 *   3. If it fails against a REMOTE host (e.g. Supabase), just warn and let the
 *      dev server start — there's no container to bring up, and it may be a
 *      transient blip we shouldn't hard-block on.
 *
 * Never manages Docker when the DB is already reachable, so a native local
 * Postgres (or an already-running container) is left untouched.
 */
import { execFileSync } from "child_process";
import { join } from "path";
import pg from "pg";
import "dotenv/config";

const { Client } = pg;
const REPO_ROOT = join(import.meta.dirname, "..");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", ""]);

async function canConnect(timeoutMs: number): Promise<boolean> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: timeoutMs,
  });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    return false;
  }
}

function isLocalHost(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

function dockerComposeAvailable(): boolean {
  try {
    execFileSync("docker", ["compose", "version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function dockerCompose(args: string[], opts: { capture?: boolean } = {}): string {
  return execFileSync("docker", ["compose", ...args], {
    cwd: REPO_ROOT,
    stdio: opts.capture ? ["ignore", "pipe", "ignore"] : "inherit",
    encoding: "utf8",
  });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL is not set — cannot start the dev server.");
    console.error("  Add it to .env (see .env.example / SETUP.md).");
    process.exit(1);
  }

  if (await canConnect(3000)) return; // already up — say nothing, keep startup quiet

  if (!isLocalHost(url)) {
    console.warn(
      "⚠ Database is not reachable and DATABASE_URL is remote (not localhost);",
    );
    console.warn("  starting the dev server anyway — check your DB / network.");
    return;
  }

  if (!dockerComposeAvailable()) {
    console.error("✗ Local database is down and Docker Compose isn't available.");
    console.error("  Start Postgres yourself, or install Docker, then retry.");
    process.exit(1);
  }

  console.log("• Local database is down — starting it with Docker Compose…");
  dockerCompose(["up", "-d"]);

  // Wait for the `db` service to report healthy (compose healthcheck).
  const deadline = Date.now() + 60_000;
  process.stdout.write("  waiting for Postgres to be healthy");
  while (Date.now() < deadline) {
    let healthy = false;
    try {
      const out = dockerCompose(["ps", "--format", "{{.Health}}", "db"], {
        capture: true,
      });
      healthy = out.includes("healthy");
    } catch {
      /* compose ps can briefly fail during startup */
    }
    if (healthy && (await canConnect(3000))) {
      process.stdout.write(" ✓\n");
      console.log("✓ Database ready.");
      return;
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 2000));
  }

  process.stdout.write("\n");
  console.error("✗ Database did not become healthy within 60s.");
  console.error("  Check `docker compose logs db` and retry.");
  process.exit(1);
}

main();

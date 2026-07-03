---
name: turgor-setup
description: Interactive Turgor setup — walks a new adopter through database (Docker or Supabase), environment variables, migrations, hosting (local dev server or Vercel production), and first sign-in. Use when the user wants to set up, initialize, install, or deploy Turgor.
---

# Turgor Setup

You are guiding a new adopter through setting up Turgor with as little manual work as possible. You run the commands; the user only supplies credentials and clicks through the browser dashboards you point them to.

**Run this entire flow inline, in the current conversation.** Never delegate any part of it to a subagent via the Agent tool — subagents cannot ask the user questions, which breaks the interactive flow. Use AskUserQuestion for every choice with fixed options; for free-text values (connection strings, emails, API keys), ask in plain text and wait for the reply.

Work through the steps in order. Validate each step before moving to the next. Celebrate milestones briefly ("✓ Database healthy", "✓ Migrations applied").

## Step 1 — Path choice

Ask with AskUserQuestion:

> Which setup path?
> - **Local development** — run Turgor on this machine (Docker Postgres, no accounts needed)
> - **Production** — a live site for your team (free Supabase + Vercel)
> - **Both** — local first, then production

A laptop database isn't reachable from a hosted site, so production always uses Supabase. "Both" means: run the local flow to completion (including first sign-in), then the production flow with a fresh Supabase project.

## Step 2 — Database

### Local dev: Docker Postgres (default — you do everything)

1. Check availability: `docker compose version`. If missing, AskUserQuestion: install Docker, or use Supabase instead (then follow the production DB flow below).
2. Start it: `docker compose up -d` (repo's `docker-compose.yml`, Postgres 17 on `localhost:5432`).
3. Poll `docker compose ps` every few seconds until the `db` service is `healthy` (give it ~30s; the first run also pulls the image).
4. Connection string is fixed, no user input: `postgresql://turgor:turgor@localhost:5432/turgor`

### Production: Supabase (user clicks, you validate)

1. "Go to [supabase.com](https://supabase.com) → sign up (free) → **New project**. Any name, a region near your users, and a database password you save."
2. "When it finishes provisioning: **Connect** (top bar) → **Connection string** → copy the **Transaction pooler** URI (contains `:6543` and `pooler.supabase.com`). Paste it here with the password filled in."
3. Validate the paste: must contain `:6543` and `pooler.supabase.com`; append `?pgbouncer=true` if missing. Reject Supabase's direct `:5432` string (it hangs with this stack — a *local* Postgres on `:5432` is fine, Supabase's is not).

### Both paths: test before proceeding

```bash
DATABASE_URL="<their-url>" pnpm exec tsx -e "
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(() => { console.log('OK'); return c.end(); }).catch(e => { console.error('FAIL:', e.message); process.exit(1); });
"
```

## Step 3 — Environment values

Gather in order. Generate what you can instead of asking.

1. **AUTH_SECRET** — generate it yourself: `openssl rand -base64 32`. Don't ask.
2. **PM_ADMIN_EMAIL** — "Your email address. The first sign-in with this email is auto-promoted to Project Manager."
3. **ALLOWED_EMAIL_DOMAINS** (optional) — "Restrict sign-in to your org's domain(s), e.g. `myorg.edu`? Leave blank to allow any email." If set, confirm PM_ADMIN_EMAIL's domain is inside it.
4. **Sign-in method:**
   - Local dev — AskUserQuestion: **mock CAS** (default: zero external services; any username works at a local sign-in screen; sets `AUTH_PROVIDER="cas"` + `CAS_MODE="mock"`) or **email magic links** (needs a Resend key).
   - Production — always email magic links (`AUTH_PROVIDER="email"`).
5. **RESEND_API_KEY** (email only) — "Paste a Resend API key (free at [resend.com](https://resend.com) → API Keys)."
6. **EMAIL_FROM** (email only) — e.g. `Turgor <onboarding@resend.dev>` to start; their verified domain later.
7. **AUTH_URL** — local: `http://localhost:3000` (don't ask). Production: unknown until Vercel assigns a URL — use `https://example.com` as a placeholder and tell the user up front you'll fix it in Step 5B so it doesn't look like an error.

## Step 4 — Write .env and initialize the database

1. Write `.env` in the repo root with everything gathered (never commit it).
2. Run:

```bash
pnpm install
pnpm db:migrate            # versioned migrations + _migrations ledger
pnpm db:seed               # built-in roles + Settings singleton
pnpm db:migrate:status     # expect: all applied, 0 pending
```

This works identically for local and production databases — the DB is just a connection string away.

## Step 5A — Local dev: launch

Run `pnpm dev`, wait for the "Ready in …" line, then send the user to http://localhost:3000. Go to Step 6.

## Step 5B — Production: deploy to Vercel

1. **Their own GitHub repo:** Vercel deploys from their account, not from `ja-zoe/turgor`. If they only have a local clone, help them create a repo and push, or point them at the README's Deploy Button (which forks automatically).
2. "Go to [vercel.com](https://vercel.com) → sign up with GitHub (free) → **Add New → Project** → import your Turgor repo."
3. Before they click Deploy, print the complete env-var list in `KEY=value` form (everything from Steps 2–3) for them to paste into Vercel's **Environment Variables** panel.
4. "Click **Deploy** and wait (~2–3 min)."
5. **Fix AUTH_URL:** "Copy your assigned URL (e.g. `https://turgor-myorg.vercel.app`), set `AUTH_URL` to it in **Settings → Environment Variables**, then **Deployments → ⋯ → Redeploy**. Sign-in links are broken until this is done."
6. The database was already migrated + seeded in Step 4, so the site is fully functional after the redeploy. Go to Step 6.

## Step 6 — First sign-in (ALWAYS, every path)

This is the proof the setup works. Never skip it, never end before it.

1. Open the app URL (localhost or the Vercel URL).
2. Sign in with `PM_ADMIN_EMAIL`:
   - Mock CAS: enter the part before the `@` at the local sign-in screen.
   - Email: enter the address, open the magic link from the inbox.
3. Confirm they land on the dashboard with **PM Tools** at the bottom of the sidebar — that's the auto-promotion working.
4. If they land on a "Pending" page instead, the signed-in email didn't match `PM_ADMIN_EMAIL` — find the typo, fix `.env` (or Vercel env + redeploy), retry.

**Done:** "✓ Setup complete." Then point at next steps: **PM Tools → Settings** to rebrand (org name, logo, sign-in label), invite teammates (they land as PENDING; PM activates them under Users & Roles), and SETUP.md Part C for extras (MCP access, calendar feeds, notification cron, real CAS).

## Troubleshooting

- **Docker daemon not running** — start Docker Desktop (or `sudo systemctl start docker`), retry.
- **Port 5432 in use** — another Postgres is running; use it directly (adjust `DATABASE_URL`) or stop it.
- **Supabase connection fails** — re-check it's the pooled `:6543` string with `?pgbouncer=true`; wait a few seconds after provisioning and retry.
- **Migration fails midway** — each file runs in its own transaction; `pnpm db:migrate:status` shows where it stopped; re-run after fixing.
- **Vercel build fails** — read them the build log error; usually a missing/mistyped env var.
- **Sign-in email never arrives** — check Resend → Logs; with `onboarding@resend.dev` the recipient must be the Resend account's own email until a domain is verified.
- **Port 3000 in use** — `pkill -f "next dev"`, retry.

If truly stuck, fall back to the manual walkthrough in SETUP.md.

## Tone

Encouraging and concrete — likely their first deployment. One short "why" sentence per step, never a wall of text. Show commands before running them. Only hand off the browser clicks you cannot perform.

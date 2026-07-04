---
name: turgor-setup
description: Interactive Turgor setup — walks a new adopter through database (Docker or Supabase), environment variables, sign-in (dev mock, email magic links, or Google/GitHub OAuth), migrations, hosting (local dev server or Vercel production), and first sign-in. Use when the user wants to set up, initialize, install, or deploy Turgor.
---

# Turgor Setup

You are guiding a new adopter through setting up Turgor with as little manual work as possible. You run the commands; the user only supplies credentials and clicks through the browser dashboards you point them to.

**Run this entire flow inline, in the current conversation.** Never delegate any part of it to a subagent via the Agent tool — subagents cannot ask the user questions, which breaks the interactive flow. Use AskUserQuestion for every choice with fixed options; for free-text values (connection strings, emails, API keys), ask in plain text and wait for the reply.

## Persistence — do not stop until setup is verified

**The goal is a single, non-negotiable end state: Turgor is running and the user has completed a successful first sign-in (Step 6). Do not end your turn, yield control, hand off, summarize-and-stop, or declare partial success until that end state is reached or the user explicitly tells you to stop.**

- Never stop just because a step failed. Diagnose it, fix it (see Troubleshooting), and continue. Errors are steps in the flow, not exits from it.
- The only two reasons to end are: (1) you have confirmed first sign-in landed on the dashboard with **PM Tools** visible, or (2) the user explicitly says to stop/pause/quit.
- Waiting on the user for a value (credential, browser click, paste) is **not** a reason to end your turn's intent — ask the one question you need, wait for the reply, then immediately keep going. Never ask a question and then stop as if the task is finished.
- If you are blocked and unsure, ask the user a specific unblocking question rather than ending. Keep ownership of the goal until it is done.
- Do not offer to "continue later," present next steps, or wrap up before Step 6 passes. There is no acceptable stopping point in the middle.

Work through the steps in order. Validate each step before moving to the next. Celebrate milestones briefly ("✓ Database healthy", "✓ Migrations applied"), but a milestone is not the finish line — only Step 6 is.

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
3. **ALLOWED_EMAIL_DOMAINS** (optional) — "Restrict sign-in to your org's domain(s), e.g. `myorg.edu`? Leave blank to allow any email." If set, confirm PM_ADMIN_EMAIL's domain is inside it. **Leave it fully unset (not an empty string) when allowing any domain**, and for production add it *after* deploy in Vercel → Settings → Environment Variables — never in the initial deploy env list (Vercel makes listed vars mandatory, and an empty value there breaks sign-in).
4. **Sign-in method.** Email is the identity key, so one person reaches the same account through any door. Turgor has three:
   - **Dev mock** (local only, default — nothing to configure): at `/dev-login` you enter any email and are signed in instantly. It is `NODE_ENV`-gated and **404s in production**, so it's for local development only. No external accounts, no env vars.
   - **Email magic links** (local: optional; production: the baseline): a single-use link by email. Needs a Resend key.
   - **Google / GitHub OAuth** (optional, either environment): one-click "Continue with …" buttons, each shown only when its credential pair is set.

   For **local dev**, the mock is enough — skip Resend/OAuth unless you want to test them. For **production**, set up **email magic links** as the baseline (the mock is unavailable there) and optionally add OAuth. There is no `AUTH_PROVIDER`/`CAS_MODE` variable anymore (CAS was removed).
5. **RESEND_API_KEY** + **EMAIL_FROM** (when using magic links) — "Paste a Resend API key (free at [resend.com](https://resend.com) → API Keys)." EMAIL_FROM e.g. `Turgor <onboarding@resend.dev>` to start (optional; that's the default), a verified domain later.
6. **Google / GitHub OAuth** (optional) — only if the user wants social sign-in. They create an OAuth app per provider (walk them via SETUP.md → "Social sign-in"; GitHub is ~2 min) and give you the client ID + secret for each. Set `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` and/or `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET` (both halves of a pair, or its button won't appear). The callback URL to register is `<AUTH_URL>/api/auth/callback/google` (or `/github`) — for production, register it once AUTH_URL is known (Step 5B). Signing in with `PM_ADMIN_EMAIL` through a provider auto-promotes to PM, exactly like the magic link.
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
3. Before they click Deploy, print the env-var list in `KEY=value` form for them to paste into Vercel's **Environment Variables** panel: the required core (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` placeholder, `PM_ADMIN_EMAIL`), the magic-link pair (`RESEND_API_KEY`, `EMAIL_FROM`), and any OAuth pairs the user chose. **Do not include `ALLOWED_EMAIL_DOMAINS`** in this list (Vercel would force a value — add it later if wanted, Step 6 next-steps).
4. "Click **Deploy** and wait (~2–3 min)."
5. **Fix AUTH_URL (and register OAuth callbacks):** "Copy your assigned URL (e.g. `https://turgor-myorg.vercel.app`), set `AUTH_URL` to it in **Settings → Environment Variables**." If they configured OAuth, they must now register the real callback URL(s) in each provider's app — `<that URL>/api/auth/callback/google` and/or `/github` (the localhost placeholder won't work in production). Then **Deployments → ⋯ → Redeploy**. "Sign-in is broken until AUTH_URL is set and redeployed."
6. The database was already migrated + seeded in Step 4, so the site is fully functional after the redeploy. Go to Step 6.

## Step 6 — First sign-in (ALWAYS, every path)

This is the proof the setup works. Never skip it, never end before it.

1. Open the app URL (localhost or the Vercel URL).
2. Sign in with `PM_ADMIN_EMAIL` (whichever method was configured):
   - Dev mock (local): go to `/dev-login`, enter the full `PM_ADMIN_EMAIL`, submit — you're in immediately.
   - Email magic link: enter the address on the sign-in page, open the link from the inbox.
   - Google / GitHub: click "Continue with …" and authorize with the account whose email is `PM_ADMIN_EMAIL`.
3. Confirm they land on the dashboard with **PM Tools** at the bottom of the sidebar — that's the auto-promotion working (it fires for `PM_ADMIN_EMAIL` no matter which door they used).
4. If they land on a "Pending" page instead, the signed-in email didn't match `PM_ADMIN_EMAIL` — find the typo, fix `.env` (or Vercel env + redeploy), retry. (For OAuth, the provider account's primary email must equal `PM_ADMIN_EMAIL`.)

**Done:** "✓ Setup complete." Then point at next steps: **PM Tools → Settings** to rebrand (org name, logo, theme family) — each member also gets a personal light/dark toggle; invite teammates (they land as PENDING; PM activates them under Users & Roles); add `ALLOWED_EMAIL_DOMAINS` in Vercel if you want to restrict who can sign in; and SETUP.md Part C for extras (Google/GitHub social sign-in, MCP access, calendar feeds, notification cron).

## Troubleshooting

- **Docker daemon not running** — start Docker Desktop (or `sudo systemctl start docker`), retry.
- **Port 5432 in use** — another Postgres is running; use it directly (adjust `DATABASE_URL`) or stop it.
- **Supabase connection fails** — re-check it's the pooled `:6543` string with `?pgbouncer=true`; wait a few seconds after provisioning and retry.
- **Migration fails midway** — each file runs in its own transaction; `pnpm db:migrate:status` shows where it stopped; re-run after fixing.
- **Vercel build fails** — read them the build log error; usually a missing/mistyped env var.
- **Sign-in email never arrives** — check Resend → Logs; with `onboarding@resend.dev` the recipient must be the Resend account's own email until a domain is verified. (Locally, use the dev mock at `/dev-login` instead — no email needed.)
- **OAuth button not showing** — both halves of the pair must be set (`AUTH_GOOGLE_ID` *and* `AUTH_GOOGLE_SECRET`); restart the dev server / redeploy after adding them.
- **OAuth "redirect_uri_mismatch" or provider error** — the callback registered in the provider app must exactly match `<AUTH_URL>/api/auth/callback/<provider>`; in production that's the Vercel URL, not localhost.
- **OAuth sign-in shows "that account's email domain isn't allowed"** — the provider account's email is outside `ALLOWED_EMAIL_DOMAINS`; unset it (allow any) or add the domain.
- **Port 3000 in use** — the dev server process is named `next-server` (not "next dev"), so kill it with `pkill -f "[n]ext-server"` (the bracket stops pkill from matching its own shell), then retry.

If truly stuck, fall back to the manual walkthrough in SETUP.md.

## Tone

Encouraging and concrete — likely their first deployment. One short "why" sentence per step, never a wall of text. Show commands before running them. Only hand off the browser clicks you cannot perform.

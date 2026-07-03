# Turgor Setup Agent

Automates initial setup for adopting organizations — local development **or** a live production deployment on Vercel. Run it in Claude Code after cloning the repo:

```
/turgor-setup
```

## What it does

The agent first asks whether you're setting up **local development**, **production**, or both, then handles as much as possible itself:

1. **Database:**
   - **Local dev:** starts a local Postgres itself via `docker compose up -d` — zero accounts, zero questions (Supabase also works if you prefer)
   - **Production:** walks you through creating a free Supabase project in the browser, validates your connection string (catches the common pooler-vs-direct mistake), and tests the connection before proceeding
2. **Environment** — asks one question at a time, generates what it can:
   - `AUTH_SECRET` generated automatically (cryptographic random)
   - `PM_ADMIN_EMAIL` (your email — auto-promoted to Project Manager)
   - `ALLOWED_EMAIL_DOMAINS` (optional sign-in restriction)
   - Sign-in method: mock CAS for local evaluation (zero external services), or email magic links via Resend for production
3. **Database initialization** — runs `pnpm db:migrate` + `pnpm db:seed` and verifies with `db:migrate:status`
4. **Hosting:**
   - **Local:** starts `pnpm dev`
   - **Production:** guides the Vercel deploy — pushing to your GitHub, importing the repo, pasting env vars (the agent prints the exact list), and the post-deploy `AUTH_URL` fix + redeploy
5. **First sign-in** — always, regardless of path: sign in with your admin email, confirm you land on the dashboard with **PM Tools** in the sidebar (proof the setup works end to end)
6. **Next steps** — rebrand in Org Settings, invite teammates, optional extras (MCP, calendar feeds, cron)

## What you provide

- Your email address
- Local dev: Docker installed (or a free [Supabase](https://supabase.com) account instead)
- For production: free [Supabase](https://supabase.com), [Vercel](https://vercel.com), and [Resend](https://resend.com) accounts (the agent walks you through each)
- Your org's email domain (optional, to lock down sign-in)

Everything else — secrets, `.env`, migrations, seeding, validation — the agent does itself.

## Re-running

Safe to re-run if setup fails partway: migrations are versioned and idempotent, and the agent picks up from where things stopped (`pnpm db:migrate:status` shows applied vs pending).

## Troubleshooting

- **Supabase connection fails:** use the **Transaction pooler** connection string (`:6543`, `pooler.supabase.com`, `?pgbouncer=true`) — the direct `:5432` connection hangs
- **Sign-in email never arrives:** with Resend's `onboarding@resend.dev` sender, the recipient must be your Resend account email until you verify a domain
- **Vercel sign-in links broken:** `AUTH_URL` must be updated to the real Vercel URL and redeployed (the agent covers this step)

For anything else, fall back to the manual walkthrough in [SETUP.md](../../SETUP.md).

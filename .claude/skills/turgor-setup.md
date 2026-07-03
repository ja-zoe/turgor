# Turgor Setup Agent

Automates initial setup for adopting organizations. Run this after cloning the repo:

```bash
claude code -- /setup
```

Or invoke directly in Claude Code (IDE extension):

```
/turgor-setup
```

## What it does

This agent will:

1. **Check prerequisites** — verify Node.js 20+, pnpm, and Git
2. **Gather environment** — prompt for or auto-generate:
   - `DATABASE_URL` (Supabase pooler connection)
   - `AUTH_SECRET` (random string for session security)
   - `AUTH_URL` (app's public URL, e.g., for Vercel deployment)
   - `PM_ADMIN_EMAIL` (your email — auto-promoted to Project Manager)
   - `ALLOWED_EMAIL_DOMAINS` (restrict sign-in to a domain, optional)
   - `RESEND_API_KEY` (optional, for email sign-in)
   - `EMAIL_FROM` (sender name/address for emails)
3. **Create `.env`** — write configuration to `.env`
4. **Initialize database** — run `pnpm db:migrate` + `pnpm db:seed`
5. **Validate setup** — test the database connection and schema
6. **Launch dev server** — start `pnpm dev` and open the app in your browser
7. **First sign-in** — guide you to sign in and confirm you're the PM

## Usage

### Interactive setup (recommended)

The agent will prompt you for each value:

```
? Database URL (from Supabase pooler): [copy-paste your connection string]
? Auth secret (leave blank to generate): [enter or press Enter]
? Auth URL (e.g., https://turgor.vercel.app): [your app's public URL]
? PM admin email: [your email]
? Allowed email domains (optional, leave blank for any): [your-org.edu]
? Resend API key (optional, leave blank to skip email): [paste or skip]
```

### Skipping email setup

If you want to evaluate locally without email sign-in, the agent will offer:

```
? Set up email magic links? (y/n): n
→ Will use mock CAS sign-in instead (any username works locally)
```

### Re-running setup

If setup fails partway through, you can re-run the agent — it will skip completed steps:

```
? Skip database initialization? (already done): y
? Skip environment creation? (already done): y
→ Jumping to dev server launch...
```

## What you provide

- **Supabase connection string** (get from Project Settings → Database → Connection string, pooled)
- **Your email address** (will be auto-promoted to PM)
- **Your org's domain** (optional, to lock down sign-in; leave blank to allow any email)
- **Resend API key** (optional, for email sign-in; can be added later in Org Settings)

## What the agent automates

- ✅ Generates `AUTH_SECRET` (cryptographic random)
- ✅ Creates `.env` file with all required variables
- ✅ Validates Supabase connection before proceeding
- ✅ Runs all migrations and seeds the database in one go
- ✅ Checks that the app can boot (TypeScript, builds, runs)
- ✅ Opens the app in your browser and walks you through first sign-in

## After setup

Your app is live at `http://localhost:3000`. The agent will:

1. Have you sign in with your `PM_ADMIN_EMAIL`
2. Confirm you see "PM Tools" in the sidebar (you're the Project Manager)
3. Suggest next steps: invite teammates, customize branding in Org Settings

Then you can close the agent and start using Turgor.

## Troubleshooting

If the agent gets stuck:

- **Supabase connection fails**: Verify your DATABASE_URL is the pooled connection (`:6543`, `pooler.supabase.com`) and includes `?pgbouncer=true`
- **Build fails**: Try `rm -rf .next && pnpm install` then re-run the agent
- **Port 3000 in use**: Kill the dev server and try again: `pkill -f "next dev"`

For other issues, fall back to the manual steps in [SETUP.md](../../SETUP.md).

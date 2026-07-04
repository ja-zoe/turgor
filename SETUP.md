# Setting up Turgor for your organization

This guide is for the person who will run Turgor for their club or team (the
"Project Manager"). It assumes you can open a terminal and paste a few commands,
but not that you know anything about web development.

**If using Claude Code's setup agent:** after cloning, run `ln -s .agents .claude`
in the repo directory (creates a symlink so the agent files are accessible). Then
run `/turgor-setup` and it'll guide you through everything below.

Most teams want a **live site their whole team can use** - that is Part A, and it
takes about 15 minutes, most of it waiting on free accounts. If you only want to
try Turgor on your own laptop first, skip to Part B.

---

## Part A - Get it live

You will create two free accounts (a database and a host) and connect them.

### A1. Create the database (Supabase)

1. Go to [supabase.com](https://supabase.com), sign up, and click **New project**.
2. Pick any name and region, and set a database password you'll remember.
3. Once it finishes provisioning, open **Project Settings → Database → Connection
   string** and copy the **pooled** string (it contains `:6543` and
   `pooler.supabase.com`). Keep it handy - it is your `DATABASE_URL`.

### A2. Deploy the app (Vercel)

Click the button to clone Turgor into your own Vercel account:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ja-zoe/turgor&env=DATABASE_URL,AUTH_SECRET,AUTH_URL,PM_ADMIN_EMAIL,ALLOWED_EMAIL_DOMAINS,RESEND_API_KEY,EMAIL_FROM&envDescription=Database%2C%20auth%2C%20and%20email%20settings%20-%20see%20the%20setup%20guide&envLink=https://github.com/ja-zoe/turgor/blob/main/SETUP.md)

Vercel will ask you to fill in these settings:

- **`DATABASE_URL`** - the pooled Supabase string from A1. Make sure it ends with
  `?pgbouncer=true`.
- **`AUTH_SECRET`** - a random string that secures sign-in sessions. Generate one
  by running `openssl rand -base64 32` in a terminal and paste the output.
- **`AUTH_URL`** - your site's public address. You won't know it until the first
  deploy finishes, so put a placeholder like `https://example.com` now and fix it
  in A4.
- **`PM_ADMIN_EMAIL`** - **your email address.** The first person to sign in with
  this address becomes the Project Manager automatically; everyone else waits for
  your approval.
- **`ALLOWED_EMAIL_DOMAINS`** - who may request a sign-in link. Set it to your
  school domain (e.g. `myschool.edu`) to restrict sign-in, or leave it blank to
  allow any email. Make sure `PM_ADMIN_EMAIL` is inside it if you set it.
- **`RESEND_API_KEY`** - Turgor's default sign-in emails a magic link, which needs
  an email sender. Create a free [Resend](https://resend.com) account and paste an
  API key. (If you'd rather evaluate without email first, use Part B locally.)
- **`EMAIL_FROM`** - the sender name/address for those emails, e.g.
  `Turgor <onboarding@resend.dev>` to start.

Click **Deploy** and wait for it to finish.

### A3. Create the tables

The database is empty until you load Turgor's schema into it. Do this once from
your own machine (you need [Node.js 20+](https://nodejs.org) and pnpm -
`npm install -g pnpm`):

```bash
git clone --recurse-submodules git@github.com:ja-zoe/turgor.git
cd turgor
pnpm install
cp .env.example .env      # then paste your DATABASE_URL into it
pnpm db:migrate           # creates all tables (safe to re-run)
pnpm db:seed              # adds built-in roles and default settings
```

`pnpm db:migrate` applies the versioned migrations in `migrations/`; it records
what it has run, so running it again is harmless and is also how you pick up
future updates. **Never use `prisma db push`** - Supabase's pooler hangs on it.

### A4. Point the app at itself

1. In Vercel, open your project → **Settings → Domains** and copy your site URL
   (e.g. `https://turgor-yourteam.vercel.app`).
2. Go to **Settings → Environment Variables**, set `AUTH_URL` to that exact URL,
   and redeploy (Deployments → ⋯ → Redeploy). Sign-in links won't work until
   `AUTH_URL` matches your real address.

### A5. First sign-in and approving your team

1. Open your site. Enter your `PM_ADMIN_EMAIL`, check your inbox, and click the
   magic link.
2. You should land on the dashboard with a **PM Tools** section (Users & Roles,
   Monthly Review, Settings) at the bottom of the left sidebar. If it's there,
   you're the Project Manager. If not, confirm `PM_ADMIN_EMAIL` matches the address
   you signed in with.
3. As teammates sign in, their accounts wait in **Users & Roles → Pending**.
   Approve each and pick a role: **Project Lead** for people who run a project,
   **Viewer** for everyone else.

### A6. Make it yours

Turgor ships with neutral default branding. Go to **PM Tools → Settings** to
replace it:

- **Organization** - your org's short name, full name, institution, and logo.
  Upload a logo directly (add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` from your
  Supabase project's API settings to enable uploads) or paste an image URL. This
  replaces the default Turgor branding across the app, sign-in screen, and emails.
- **Period label** - what your org calls a planning period: Semester, Quarter,
  Term... This renames the calendar and every period picker.
- **Theme** - pick a color preset to move off the default forest green.
- **Detection thresholds** - how far a project slips (weeks behind a milestone,
  missed goals in a row) before it is auto-flagged BEHIND.
- **Notification rules** - who gets notified about what, and whether by email,
  in-app, or both.

Built-in roles can be renamed in **Users & Roles** (e.g. "Project Manager" →
"Director") - renames are safe and survive re-seeding.

You now have a live, branded tracker. The rest of this file is optional.

---

## Part B - Run it locally

To evaluate or develop on your own machine instead of deploying, you need a
Postgres database first. Pick one:

- **Docker (simplest):** run `docker compose up -d` in the repo - it starts a
  local Postgres 17, and your `DATABASE_URL` is
  `postgresql://turgor:turgor@localhost:5432/turgor`.
- **Supabase:** create a free project as in A1 and use its pooled connection
  string. (Production always uses a hosted database - a laptop Postgres isn't
  reachable from a hosted site.)

Then:

```bash
git clone --recurse-submodules git@github.com:ja-zoe/turgor.git
cd turgor
pnpm install
docker compose up -d      # if using the Docker database option
cp .env.example .env      # fill in DATABASE_URL and AUTH_SECRET at minimum
pnpm db:migrate           # create the tables
pnpm db:seed              # seed built-in roles and settings
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). For a zero-email trial, use
the local mock login at [/dev-login](http://localhost:3000/dev-login): enter any
email - your `PM_ADMIN_EMAIL` to land as the Project Manager - and you're in, no
Resend key needed. (The mock login is dev-only; it 404s in production builds.)

The comments in `.env.example` explain every setting, including the ones only
specific deployments need (Stytch/ChatGPT OAuth, cron secret).

---

## Part C - Going further

- **AI assistant access (MCP)** - each user can connect Claude, Cursor, or another
  MCP-capable AI client: go to **Account**, generate a personal access token, and
  paste the shown client configuration into the AI tool. The assistant then works
  with the tracker under that user's own permissions.
- **Social sign-in (Google / GitHub)** - optional one-click sign-in alongside the
  email magic link. Each provider's button appears only when you set both of its
  environment variables; the same allowed-domains rule applies. Set `AUTH_URL` to
  your site's URL first (the callback URLs are built from it).
  - **GitHub** (quickest): GitHub → Settings → Developer settings → **OAuth Apps** →
    New OAuth App. Homepage URL = your site; **Authorization callback URL** =
    `<AUTH_URL>/api/auth/callback/github`. Copy the Client ID and generate a client
    secret into `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`.
  - **Google**: Google Cloud Console → **APIs & Services → Credentials** → Create
    Credentials → **OAuth client ID** → Web application. Add
    `<AUTH_URL>/api/auth/callback/google` under **Authorized redirect URIs** (fill in
    the OAuth consent screen first if prompted). Copy the client ID/secret into
    `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.
  - Redeploy (or restart `pnpm dev`) after setting the variables. Anyone signing in
    with Google/GitHub uses the same account as their magic-link email - one person,
    one account, whichever door they use.
- **Calendar subscription** - the calendar page offers an ICS export you can
  subscribe to from Google Calendar or Outlook.
- **Scheduled notifications** - point a cron job at `POST /api/cron/notifications`
  (sending the `CRON_SECRET` header) to run the notification engine on a schedule.
  On Vercel, a `vercel.json` cron or any external scheduler works.
- **End of period** - when a semester/quarter ends, archive finished projects from
  the project page, or "carry" continuing ones into the new period (clones the
  project with a fresh slate and archives the old one). Archived projects stay
  searchable and exportable.
- **Backups and upgrades** - your data lives in your Supabase Postgres database;
  use Supabase's backup features to protect it (restoring a backup is also how you
  roll back a bad change). To upgrade Turgor, pull the latest code, run
  `pnpm db:migrate` to apply any new migrations, and redeploy.

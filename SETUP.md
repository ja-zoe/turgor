# Setting up the tracker for your organization

This guide is for the person who will run the tracker for their club or team (the
"Project Manager"). It assumes you can open a terminal and paste commands, but not
that you know anything about web development. Expect the whole setup to take about
30 minutes, most of it waiting on accounts.

## 1. Prerequisites

You need three things installed or created before starting:

- **Node.js 20 or newer** - download from [nodejs.org](https://nodejs.org) (the LTS
  version is fine).
- **pnpm** - the package manager this project uses (not npm). After installing
  Node, run: `npm install -g pnpm`
- **A Postgres database** - the easiest path is a free
  [Supabase](https://supabase.com) project: create an account, click "New project",
  pick any name and region, and set a database password you'll remember.

Then get the code:

```bash
git clone --recurse-submodules git@github.com:ja-zoe/seed-project-tracker.git
cd seed-project-tracker
pnpm install
```

## 2. Configure your environment

Copy the example configuration file and open it in any text editor:

```bash
cp .env.example .env
```

The file explains every setting, but these are the ones you must fill in:

- **`DATABASE_URL`** - in Supabase, go to Project Settings → Database → Connection
  string and copy the **pooled** connection string (it contains `:6543` and
  `pooler.supabase.com`). Replace the placeholder with it, keeping
  `?pgbouncer=true` at the end. (`DIRECT_URL` is the same string with `:5432` -
  copy it too, but the app itself only uses the pooled one.)
- **`AUTH_SECRET`** - a random string that secures sign-in sessions. Generate one
  by running `openssl rand -base64 32` in your terminal and paste the output.
- **`PM_ADMIN_EMAIL`** - **your email address.** The first account that signs in
  with this address is automatically activated and made the Project Manager.
  Everyone else who signs in starts as "pending" until you approve them.
- **`CAS_MODE`** - leave it as `"mock"` unless your school runs a CAS single
  sign-on server and has registered this app with it. Mock mode gives you a simple
  local sign-in screen and the app is fully usable with it.
- **`CAS_EMAIL_DOMAIN`** and **`ALLOWED_EMAIL_DOMAINS`** - replace the Rutgers
  domains with your own. Sign-in asks for a username and turns it into
  `username@CAS_EMAIL_DOMAIN`; that domain must appear in `ALLOWED_EMAIL_DOMAINS`
  or every sign-in is rejected. Make sure `PM_ADMIN_EMAIL` uses the same domain
  (e.g. domain `yourschool.edu` and admin email `jane@yourschool.edu`).
- **`RESEND_API_KEY`** - optional. If you want the tracker to send email
  notifications, create a free [Resend](https://resend.com) account and paste an
  API key here. If you leave it empty, email is skipped and in-app notifications
  still work. If you set it, also update `EMAIL_FROM` to your sender name.

The remaining settings (CAS server details, Stytch/ChatGPT OAuth, cron secret) are
only needed for specific deployments - the comments in `.env.example` say when.

### Choosing your sign-in method

You pick this inside the app: **Org Settings → Sign-in method** (you can change it
any time after your first sign-in; new installations default to email):

- **Email magic link** (the default) - members enter their email and receive a
  single-use sign-in link (this requires `RESEND_API_KEY`).
  `ALLOWED_EMAIL_DOMAINS` controls who may request a link: set it to your school's
  domain to restrict sign-in, or leave it empty to allow any address. Either way,
  every new account still waits for your approval before it can do anything.
- **CAS single sign-on** - if your school runs CAS. Until your IT department
  registers the app's URL with the CAS server, `CAS_MODE="mock"` gives you a
  working local sign-in screen for evaluation; switch to `CAS_MODE="real"` once
  registered.

(Advanced: setting the `AUTH_PROVIDER` environment variable forces a method and
locks the Org Settings control - useful for testing, rarely needed otherwise.)

## 3. Initialize the database and start the app

Create the tables. **Do not use `prisma db push`** - Supabase's connection pooler
hangs on it. The project ships a script that applies the schema directly:

```bash
pnpm exec prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > /tmp/schema.sql
pnpm exec tsx scripts/apply-schema.ts
```

Then seed the built-in roles and settings, and start the app:

```bash
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 4. First sign-in and approving your team

1. The app redirects you to a sign-in screen. In mock mode, enter the part of your
   `PM_ADMIN_EMAIL` before the `@` (e.g. `jane` for `jane@yourschool.edu`).
2. You should land on the dashboard with a **PM Tools** section (Users & Roles,
   Monthly Review, Settings) at the bottom of the left sidebar. If you see it, you
   are the Project Manager. If not, double-check `PM_ADMIN_EMAIL` matches the
   address you signed in with.
3. When teammates sign in, their accounts wait in **Users & Roles** under "Pending".
   Approve each one and pick their role: **Project Lead** for people who run a
   project, **Viewer** for everyone else. You can also build custom roles on the
   same page.

## 5. Make it yours

Everything branded "SEED" is configurable. Go to **PM Tools → Settings**:

- **Organization** - your org's short name, full name, institution, and logo.
  Upload a logo image directly (add `SUPABASE_URL` and `SUPABASE_SECRET_KEY`
  from your Supabase project's API-keys settings to `.env` to enable uploads), or
  paste an image URL. These replace the SEED branding across the app, sign-in screen,
  and emails.
- **Sign-in label** - what your login identity is called on the sign-in screen
  (e.g. "Rutgers NetID", "University ID", or just "Email").
- **Period label** - what your org calls a planning period: Semester, Quarter,
  Term... This renames the calendar and every period picker.
- **Theme** - pick one of the color presets to move away from the default forest
  green.
- **Detection thresholds** - how far a project slips (weeks behind a milestone,
  missed goals in a row) before it is automatically flagged BEHIND.
- **Notification rules** - who gets notified about what (missing submissions,
  projects behind, action items due, missed goals) and whether by email, in-app,
  or both.

Built-in roles can be renamed in **Users & Roles** (e.g. "Project Manager" →
"Director") - renames are safe and survive re-seeding.

## 6. Going further

- **AI assistant access (MCP)** - each user can connect Claude, Cursor, or another
  MCP-capable AI client to the tracker: go to **Account**, generate a personal
  access token, and paste the shown client configuration into the AI tool. The
  assistant then works with the tracker under that user's own permissions. Tokens
  work identically whichever sign-in method you chose.
- **Calendar subscription** - the calendar page offers an ICS export you can
  subscribe to from Google Calendar or Outlook.
- **Real single sign-on** - if your school runs CAS, have IT register the app's
  URL, then set `CAS_MODE="real"` and the `CAS_*` values in `.env`.
- **End of period** - when a semester/quarter ends, archive finished projects from
  the project page, or "carry" continuing projects into the new period (this
  clones the project with a fresh slate and archives the old one). Archived
  projects stay searchable and exportable.
- **Deploying to the internet** - the app is a standard Next.js project; Vercel's
  free tier works well. Set the same `.env` values in the Vercel dashboard, plus
  `AUTH_URL` set to your public URL, and point a cron job at
  `POST /api/cron/notifications` (with the `CRON_SECRET` header) to run the
  notification engine on a schedule.

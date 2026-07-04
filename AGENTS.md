# AGENTS.md

This file documents the architecture for Turgor, written for agent-based development in Claude Code and other AI-driven workflows. Agent skills live in `.agents/skills/` (tracked in git); locally, `.claude` is a symlink to `.agents/`.

## Non-negotiables

The rules most often broken in past sessions. The first three are hard-enforced by hooks (`.claude/settings.json` → `.agents/hooks/spec-gate.sh`); a blocked merge or blocked turn means fix the paper trail, not fight the hook (deliberate, user-approved override: `SPEC_GATE_SKIP=1` prefix on the merge command).

1. **All feature work goes through the spec-driven-dev skill.** No source changes without a feature file under `changes/N-*/`, and flip the `_set.md` markers in real time: `[ ]→[~]` when you start a feature, `[~]→[t]` the moment its tests pass, `[t]→[x]` on merge. As they happen, never batched at the end.
2. **The Tests checklist is the merge gate.** Never mark a test item `[x]` without literally running it (`pnpm build` satisfies only the build item). A `[t]`/`[x]` feature whose checklist still has `- [ ]` items is a contradiction; treat it as `[FAIL]`.
3. **Set branches merge to `main` only with explicit user approval**, after every feature passed its scheme and the app boots clean. Verify your own work first (Playwright + screenshots for anything user-visible); never hand the user something you have not verified yourself.
4. **Clean up test artifacts** (test projects, seeded rows, stray screenshots) before handing work to the user.
5. **One dev server at a time, and kill any server or background process you started** when you finish with it. Orphaned dev servers plus Playwright have crashed this machine (100% CPU/RAM/swap). Run Playwright headless with a single worker.
6. **Never ask the user to paste secrets into chat.** Have them edit `.env` themselves and tell you only the variable name; transcripts persist on disk.
7. **Update this file as part of any set that changes architecture.** Stale docs cost a whole session of re-derivation.

## Commands

```bash
pnpm dev                   # start dev server (Turbopack)
pnpm build                 # production build
pnpm db:seed               # seed built-in roles + Settings singleton
pnpm db:studio             # open Prisma Studio
pnpm notifications:run     # run notification engine once (for manual testing)
pnpm db:migrate            # apply pending migrations/NNN-*.sql (also: :status, :baseline)
tsx scripts/verify-migrations.ts  # drift canary: replayed migrations vs live schema
```

There is no test suite.

## Architecture

**Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 · Prisma v7 WASM · Supabase Postgres

### Route layout

```
src/app/
  layout.tsx              # root: font vars + GsapProvider
  (app)/                  # authenticated app shell (layout.tsx: sidebar + session)
    dashboard/
    projects/[id]/        # sub-routes: deliverables (R30.1), action-items (R30.2), timeline, status/new, meeting/new, members, history
    my-tasks/
    action-items/
    account/              # MCP token generation + client config snippet
    pm/                   # PM-only: users, review, settings
  api/
    mcp/route.ts          # MCP server (JSON-RPC 2.0, Bearer token auth)
    notifications/        # GET list, POST /read
    auth/email/           # magic-link request + callback (Resend + VerificationToken)
    cron/                 # notification engine HTTP trigger
  auth/                   # NextAuth handlers + /auth/handoff (token → session)
  signin/                 # /signin dispatcher (→ /signin/email) + /signin/email form
  dev-login/              # dev-only mock login (404s in production)
  pending/                # shown to PENDING users after sign-in
```

### Auth flow (R33.1: CAS removed; email magic link + optional OAuth)

1. Middleware (`src/proxy.ts` — must live in `src/`, a root-level file is silently ignored) redirects unauthenticated requests to `/signin`, which forwards to `/signin/email` (magic links via Resend + the NextAuth `VerificationToken` table), preserving `?next=`.
2. The magic-link callback (`/api/auth/email/callback`), the OAuth callbacks (R33.2), and the dev-only mock at `/dev-login` all mint the same short-lived HMAC handoff token (`src/lib/handoff-token.ts`, 60 s TTL) carrying a full verified email. `/dev-login` is `NODE_ENV`-gated — it `notFound()`s in production, so it can't be an auth bypass.
3. The handoff token is passed via `/auth/handoff` (a route handler — Next 16 forbids `signIn()` during page render) to NextAuth's Credentials provider (`src/auth.ts`), which validates `ALLOWED_EMAIL_DOMAINS`, creates/finds the user, and issues a JWT session.
4. The first sign-in from `PM_ADMIN_EMAIL` auto-promotes the user to the "Project Manager" role.
5. New users start as `PENDING` and land on `/pending` until a PM activates them.

### RBAC: two-layer roles

- **Global role** (`User.roleId → Role.permissions[]`): controls PM-level abilities (MANAGE_PROJECTS, MANAGE_USERS, VIEW_ALL_PROJECTS, etc.). Seeded roles: "Project Manager", "Project Lead", "Viewer".
- **Project role** (`ProjectAssignment.role: LEAD | SUBLEAD | MEMBER`): controls per-project write operations (submit status updates, manage deliverables/subtasks).

Permission helpers live in `src/lib/permissions.ts`:
- `requireAuth()` — returns session user or redirects to `/signin`
- `requirePermission(perm)` — redirects to /dashboard if not granted
- `getUserPermissions(roleId)` — returns permissions array for RBAC checks
- `getProjectMembership(userId, projectId)` — returns project role or null

### Database

Postgres, either Supabase (hosted; this repo's shared dev DB) or a local instance via `docker compose up -d` (Postgres 17 on `localhost:5432`, `turgor:turgor@localhost:5432/turgor`). On Supabase, connect via the pgBouncer pooler (port 6543) — **`prisma db push` and Supabase's direct port 5432 both hang, never use them** (a local Postgres at :5432 is fine; `db push` stays banned everywhere in favor of migrations). DDL ships as numbered migrations in `migrations/NNN-slug.sql`, applied with `pnpm db:migrate` (ledger table `_migrations`; `db:migrate:status` / `db:migrate:baseline` variants). After adding a migration, keep `prisma/schema.prisma` in sync and run `tsx scripts/verify-migrations.ts` (drift canary). `scripts/apply-schema.ts` (raw SQL from `/tmp/schema.sql`) remains for throwaway dev experiments only.

Prisma v7 WASM engine requires the driver adapter — always construct the client as:
```ts
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
```

The generated client is at `src/generated/prisma` (non-default). After `prisma generate`, Turbopack caches the old WASM bundle — **restart the dev server** (`Ctrl+C` + `pnpm dev`) before testing.

### Server actions

All mutations are Next.js Server Actions in `src/lib/actions/`. Each file maps to a domain:
- `projects.ts` — create/update project, assign/remove members, override status
- `deliverables.ts` — CRUD for deliverables and subtasks (including `updateSubtaskStatus`)
- `action-items.ts`, `status-updates.ts`, `meeting-records.ts` — domain mutations
- `users.ts`, `roles.ts` — PM-only user/role management
- `account.ts` — `generateMcpToken()` server action (upserts `User.mcpToken`)

Actions call `requirePermission()` or `requireAuth()` + membership check, then `revalidatePath()`.

### MCP server (`/api/mcp`)

Implements JSON-RPC 2.0 (protocol version `2024-11-05`). Auth via `Authorization: Bearer <mcpToken>` header — token is looked up in `User.mcpToken`. Returns 401 for missing/invalid tokens or non-ACTIVE users. Tools return `{ content: [{ type: "text", text: JSON.stringify(...) }] }`.

### Notification engine

Rule-based system stored in `NotificationRule`. `src/lib/notifications.ts` contains `runNotificationEngine()`. Trigger types: `MISSING_SUBMISSION`, `PROJECT_BEHIND`, `ACTION_ITEM_DUE`, `GOAL_MISSED`. Recipients: `PM`, `PROJECT_LEADS`, `ACTION_OWNER`, `ALL_ACTIVE`. Channels: `IN_APP`, `EMAIL`, `BOTH`. Email uses Resend (`RESEND_API_KEY`).

### Red-flag detection

`src/lib/red-flag.ts` — `runRedFlagDetection(projectId)` auto-sets project status to BEHIND based on two configurable thresholds in the `Settings` singleton: weeks behind a milestone (`weeksBehindMilestone`) and consecutive missed goals (`missedGoalsInARow`). `statusOverride: true` bypasses auto-detection entirely.

## Design system

**Theme system v2 (R32.4)** — CSS custom-property palettes in `src/app/globals.css`, two orthogonal axes:
- **Family** (org-wide, `Settings.themePreset`): one of 6 curated ids in `src/lib/themes.ts` — `forest` (default), `slate`, `plum`, `clay`, `marine`, `ochre` — emitted as `data-theme` on `<html>` (forest omits it).
- **Mode** (per-user): light|dark in the `turgor-theme-mode` cookie → `data-mode="dark"` on `<html>`; a no-FOUC inline script in the root layout fills it from `prefers-color-scheme` when there's no cookie. The Sun/Moon toggle (`theme-mode-toggle.tsx`) lives in the sidebar footer.
- Palette blocks: `:root` = forest light (the Forest Floor values below), `[data-theme=X]` = family light, `[data-mode=dark]` = forest dark (complete token set), `[data-theme=X][data-mode=dark]` = family dark. Use tokens, never hardcoded light hexes, so dark mode follows.
- The R29.2 custom color picker was removed (`Settings.customColors` dropped; `readableForeground` deleted).

**Forest Floor** — the default forest-light palette:
- Canvas: `#F4F1EA` (background), `#FFFFFF` (card)
- Primary: `#2E4034` (forest green), Secondary: `#F9F8F5`
- Status: on-track `#588157`, at-risk `#C99846`, behind `#A4503C` — semantically green/amber/red in every family and mode.

**Tailwind v4** — `@import "tailwindcss"` + `@theme inline` (no `tailwind.config.js`). All design tokens are CSS variables bridged into Tailwind via `@theme inline`. The `dark:` variant keys off `[data-mode="dark"]`.

**Icons:** Phosphor Icons only (`@phosphor-icons/react`), Bold/Fill weights. Lucide is banned.

**Fonts:** `--font-sans` = Geist Sans (body), `--font-display` = Instrument Serif (h1/h2), `--font-mono` = JetBrains Mono (timestamps, labels, code). Set via `style={{ fontFamily: "var(--font-mono)" }}` for one-off mono elements.

**No heavy shadows, no gradients, no glassmorphism.** Status badges use `.status-on-track`, `.status-at-risk`, `.status-behind` utility classes.

## Revision tracking

Changes are tracked under `changes/` by the **spec-driven-dev skill**. The skill is vendored as a git submodule at `.agents/skills/spec-driven-dev` (repo: `git@github.com:ja-zoe/agent-skill-spec-driven-dev.git`) and bridged to Claude Code via the symlink `.claude/skills/spec-driven-dev`. After a fresh clone, run `git submodule update --init` to populate it. Layout:

- `changes/CONTEXT.md` — project-wide invariants. **Read this first** in any session.
- `changes/N-slug/` — one directory per revision set, containing `_set.md` (status checklist + roll-up log) and one `RN.M-slug.md` file per feature (spec + notes). Large features with attachments become a `RN.M-slug/` directory instead.

To resume work: read `CONTEXT.md` + the target set's `_set.md`, then load only the feature file(s) you're touching. The latest set is the highest-numbered `changes/N-*` directory (currently `changes/30-content-pages-mcp/`; sets 23–30 are merged to main).

**Branching:** `main` is the single integration branch (no `develop`). Each set → `feat/setN-<slug>` off `main`; each feature → `feat/setN/RN.M-<slug>` off the set branch. A feature merges into the set branch only after passing its tests/verification; the set merges into `main` only after every feature passes, the app boots, and the user approves.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev                   # start dev server (Turbopack)
pnpm build                 # production build
pnpm db:seed               # seed built-in roles + Settings singleton
pnpm db:studio             # open Prisma Studio
pnpm notifications:run     # run notification engine once (for manual testing)
tsx scripts/apply-schema.ts  # apply raw DDL to the DB (see DB section)
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
    projects/[id]/        # sub-routes: deliverables, timeline, status, meeting, members, action-items, history
    my-tasks/
    action-items/
    account/              # MCP token generation + client config snippet
    pm/                   # PM-only: users, review, settings
  api/
    mcp/route.ts          # MCP server (JSON-RPC 2.0, Bearer token auth)
    notifications/        # GET list, POST /read
    cas/login/            # CAS redirect (real) or mock dev-login redirect
    cron/                 # notification engine HTTP trigger
    ai/                   # (legacy stubs, unused)
  auth/                   # NextAuth handlers
  cas/                    # CAS callback (real mode)
  dev-login/              # mock login form (CAS_MODE != "real")
  pending/                # shown to PENDING users after sign-in
```

### Auth flow

1. Middleware redirects unauthenticated requests to `/api/cas/login`.
2. In mock mode (`CAS_MODE=mock`), that redirects to `/dev-login` where any netId can be entered.
3. In real mode, browser goes to the Rutgers CAS server; on callback, `/cas/callback` mints a short-lived HMAC handoff token (`src/lib/handoff-token.ts`, 60 s TTL).
4. The handoff token is passed to NextAuth's Credentials provider (`src/auth.ts`), which creates/finds the user and issues a JWT session.
5. The first sign-in from `PM_ADMIN_EMAIL` auto-promotes the user to the "Project Manager" role.
6. New users start as `PENDING` and land on `/pending` until a PM activates them.

### RBAC: two-layer roles

- **Global role** (`User.roleId → Role.permissions[]`): controls PM-level abilities (MANAGE_PROJECTS, MANAGE_USERS, VIEW_ALL_PROJECTS, etc.). Seeded roles: "Project Manager", "Project Lead", "Viewer".
- **Project role** (`ProjectAssignment.role: LEAD | SUBLEAD | MEMBER`): controls per-project write operations (submit status updates, manage deliverables/subtasks).

Permission helpers live in `src/lib/permissions.ts`:
- `requireAuth()` — returns session user or redirects to CAS
- `requirePermission(perm)` — redirects to /dashboard if not granted
- `getUserPermissions(roleId)` — returns permissions array for RBAC checks
- `getProjectMembership(userId, projectId)` — returns project role or null

### Database

Supabase Postgres connects via pgBouncer pooler (port 6543). **`prisma db push` and direct port 5432 both hang — never use them.** Apply DDL by writing raw SQL to `/tmp/schema.sql` then running `tsx scripts/apply-schema.ts`.

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

**Forest Floor palette** — defined as CSS custom properties in `src/app/globals.css`:
- Canvas: `#F4F1EA` (background), `#FFFFFF` (card)
- Primary: `#2E4034` (forest green), Secondary: `#F9F8F5`
- Status: on-track `#588157`, at-risk `#C99846`, behind `#A4503C`

**Tailwind v4** — `@import "tailwindcss"` + `@theme inline` (no `tailwind.config.js`). All design tokens are CSS variables bridged into Tailwind via `@theme inline`.

**Icons:** Phosphor Icons only (`@phosphor-icons/react`), Bold/Fill weights. Lucide is banned.

**Fonts:** `--font-sans` = Geist Sans (body), `--font-display` = Instrument Serif (h1/h2), `--font-mono` = JetBrains Mono (timestamps, labels, code). Set via `style={{ fontFamily: "var(--font-mono)" }}` for one-off mono elements.

**No heavy shadows, no gradients, no glassmorphism.** Status badges use `.status-on-track`, `.status-at-risk`, `.status-behind` utility classes.

## Revision tracking

Changes are tracked under `changes/` by the **spec-driven-dev skill**. The skill is vendored as a git submodule at `.agents/skills/spec-driven-dev` (repo: `git@github.com:ja-zoe/agent-skill-spec-driven-dev.git`) and bridged to Claude Code via the symlink `.claude/skills/spec-driven-dev`. After a fresh clone, run `git submodule update --init` to populate it. Layout:

- `changes/CONTEXT.md` — project-wide invariants. **Read this first** in any session.
- `changes/N-slug/` — one directory per revision set, containing `_set.md` (status checklist + roll-up log) and one `RN.M-slug.md` file per feature (spec + notes). Large features with attachments become a `RN.M-slug/` directory instead.

To resume work: read `CONTEXT.md` + the target set's `_set.md`, then load only the feature file(s) you're touching. The latest set is `changes/5-logo-mcp-notify/` (complete).

**Branching:** `main` is the single integration branch (no `develop`). Each set → `feat/setN-<slug>` off `main`; each feature → `feat/setN/RN.M-<slug>` off the set branch. A feature merges into the set branch only after passing its tests/verification; the set merges into `main` only after every feature passes, the app boots, and the user approves.

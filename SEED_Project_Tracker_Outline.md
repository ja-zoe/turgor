# SEED Project Tracker — Build Spec

**Club:** Students for Environmental and Energy Development (SEED), Rutgers University–New Brunswick  
**Owner:** Project Manager (also serves as a Project Lead)  
**Purpose:** Turn the existing Project Communication Plan into a web app that enforces accountability, surfaces blockers early, and visualizes project progress across the semester.

This is the definitive spec for Claude Code to build from the ground up. All **[DECISION]** items are locked. **[ASSUMPTION]** items can be overridden before building if you have a better-informed choice.

---

## 1. Goal & Problem Statement

Last year projects fell behind due to communication breakdowns, missed deadlines, and unclear priorities. This app operationalizes the weekly check-in plan so that:

- Project leads submit structured status updates **before** each weekly meeting.
- The Project Manager documents and tracks each project **after** each meeting.
- Everyone can see project health, accountability, and progress trends over the semester.
- "Behind schedule" is measured against a concrete semester plan, not a gut feeling.

---

## 2. Users & Roles

The PM is **also** a lead, so one account must be able to hold multiple capabilities at once. Capabilities attach to a role; the PM role is a superset, not a separate account.

**Built-in roles:**

| Role                     | Can do                                                                                                                                                                                                                                               |
| :----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Project Lead**         | Submit pre-meeting status updates for their own project(s); view all projects (read-only on others); edit only their own; see action items assigned to them.                                                                                         |
| **Viewer**               | Read-only across all projects. Intended for Eboard members who attend optionally. No editing, no submissions.                                                                                                                                        |
| **Project Manager (PM)** | Everything a lead can do, **plus**: create/manage projects and deliverables, do post-meeting tracking for all projects, assign action items, view the all-projects dashboard and monthly review, manage users, create/edit custom roles. Super Admin |

**Custom roles (PM-managed):** The PM can create roles beyond the three above by toggling a set of permission flags. Permissions are granular and optionally scopeable (global vs. per-project):

- View projects (all / assigned only)
- Submit status updates
- Do post-meeting tracking
- Manage projects / deliverables
- Assign / close action items
- Configure notifications & triggers
- Manage users & roles

Roles are **data, not hardcoded** — the PM defines a role, sets its permissions, and assigns users to it. The three built-ins are pre-seeded rows of the same system.

**Project membership:** A user's _app role_ (e.g. Project Lead) is separate from their _project-level membership role_. Within a project, the three membership roles are:

| Project role | Meaning |
| :----------- | :------ |
| `LEAD` | Runs the project. Primary point of contact. Submits status updates and co-manages deliverables with the PM. |
| `SUBLEAD` | Deputy lead. Can submit status updates and help manage deliverables and subtasks. Useful for large projects or for training a successor. |
| `MEMBER` | General contributor. Receives delegated subtasks and has a read-only member view of the project. |

A user with the "Project Lead" app role may be a SUBLEAD or MEMBER on a different project they don't run. The PM can assign any active user to a project at any membership level.

---

## 3. Authentication — Rutgers CAS SSO

**[DECISION] Auth uses Rutgers CAS (Central Authentication Service), NOT Google OAuth.**

Rutgers CAS is a ticket-based SSO protocol, not OAuth. The flow:

1. App redirects the browser to `<CAS>/login?service=<callback_url>`.
2. User authenticates at CAS (their Rutgers NetID + password). CAS redirects back to `<callback_url>?ticket=ST-...`.
3. App validates the ticket server-side against `<CAS>/serviceValidate` and gets the authenticated NetID.
4. NetID maps to an email address (`<netid>@<CAS_EMAIL_DOMAIN>`) for user records and domain allow-list checking.

**Two modes via `CAS_MODE` env var:**

- `mock` (default) — A local stand-in login screen at `/dev-login` mints a signed fake ticket. Use this until the app's service URL is registered with Rutgers IdM. Lets the full app run and be demoed immediately with no external dependency.
- `real` — Talks to the actual Rutgers CAS server at `CAS_BASE_URL`. Requires that the app's service URL has been registered via the Enterprise CAS request form with Rutgers IdM (without registration, CAS rejects the service URL and auth fails).

**Implementation approach:**

- Use **Auth.js v5** (`next-auth@5.0.0-beta`) with the **Prisma adapter** (`@auth/prisma-adapter`) to store users, sessions, and accounts in Postgres.
- Auth.js does not have a built-in CAS provider. Implement a **custom Credentials provider** that accepts a short-lived signed handoff token (not the raw CAS ticket). Flow:
  1. Browser hits `/api/cas/login` → redirected to CAS (or `/dev-login` in mock mode).
  2. CAS callback route validates the ticket server-side, mints a signed handoff token (HMAC, 60s TTL) for the authenticated NetID.
  3. Client receives the handoff token and POSTs it to the Auth.js Credentials provider endpoint.
  4. Credentials provider verifies the handoff token → calls `signIn` to create the session.
- Reject sign-in for any email outside `ALLOWED_EMAIL_DOMAINS` (`scarletmail.rutgers.edu,rutgers.edu` by default).
- First sign-in creates a `User` row with `status: PENDING`. The user lands on a `/pending` page until the PM approves them and assigns a role.
- **Exception:** If the signing-in email matches `PM_ADMIN_EMAIL`, auto-activate and grant the PM role (so the app is usable without a chicken-and-egg approval problem).

**Required env vars for auth:**

```
AUTH_SECRET=             # openssl rand -base64 32
CAS_MODE=mock            # "mock" | "real"
CAS_BASE_URL=https://cas.rutgers.edu
CAS_EMAIL_DOMAIN=scarletmail.rutgers.edu
ALLOWED_EMAIL_DOMAINS=scarletmail.rutgers.edu,rutgers.edu
PM_ADMIN_EMAIL=          # <netid>@scarletmail.rutgers.edu
```

_Confirm the exact CAS base URL and domain strings with the Rutgers CAS documentation before switching to real mode._

---

## 4. Core Data Model

Prisma (PostgreSQL) is the ORM. The schema below is the source of truth; keep entity names and enum values consistent with it throughout the codebase.

**Auth adapter models** (required by Auth.js Prisma adapter — do not rename):

- `Account`, `Session`, `VerificationToken` — standard adapter fields.

**Domain models:**

- **`Role`** — id, name, `isBuiltIn` (bool), `permissions` (array of `Permission` enum flags). PM-creatable. `isBuiltIn` means the row cannot be deleted; the PM can still edit its name and permissions freely. All three built-in roles are fully configurable.
- **`Permission`** (enum) — `VIEW_ALL_PROJECTS`, `VIEW_ASSIGNED_PROJECTS`, `SUBMIT_STATUS_UPDATES`, `EDIT_OWN_PROJECT`, `POST_MEETING_TRACKING`, `MANAGE_PROJECTS`, `MANAGE_MILESTONES`, `ASSIGN_ACTION_ITEMS`, `CLOSE_ACTION_ITEMS`, `VIEW_MONTHLY_REVIEW`, `CONFIGURE_NOTIFICATIONS`, `MANAGE_USERS`, `MANAGE_ROLES`.
- **`User`** — id, name, email, `emailVerified`, image, `status` (`PENDING` | `ACTIVE` | `SUSPENDED`), `roleId` (FK to Role). Plus Auth.js relations (accounts, sessions) and domain relations.
- **`Project`** — id, name, description, semester (string, e.g. `"Fall 2026"`), status (`ON_TRACK` | `AT_RISK` | `BEHIND`), `statusOverride` (bool — true means PM manually set status, suppress auto-detection), `correctiveActionPlan` (text — required when flagged Behind).
- **`ProjectAssignment`** — join table: `projectId`, `userId`, `role` (`LEAD` | `SUBLEAD` | `MEMBER`). Unique on `[projectId, userId]`.
- **`Deliverable`** — id, `projectId`, title, description (**Markdown text** — detailed acceptance criteria), `status` (`NOT_STARTED` | `IN_PROGRESS` | `BLOCKED` | `COMPLETE`), `startDate` (optional), `targetDate`, `completed` (bool — canonical "done" signal for health detection), `completedDate`, `orderIndex` (manual ordering on the timeline).
  - Has many **`Subtask`**s.
- **`Subtask`** — id, `deliverableId`, title, description (**Markdown text**), `status` (`NOT_STARTED` | `IN_PROGRESS` | `BLOCKED` | `COMPLETE`), `startDate`, `dueDate`, `orderIndex`, `assigneeId` (optional FK to User), `completedAt`.
- **`StatusUpdate`** (pre-meeting) — id, `projectId`, `submittedById`, `meetingDate`, `plannedWork`, `actualProgress`, `blockers`, `nextWeekGoals`, `needsHelp` (bool), `helpNeeded` (text), `submittedAt`, `isLate` (bool).
- **`MeetingRecord`** (post-meeting) — id, `projectId`, `meetingDate`, `status` (`ProjectStatus`), `goalMet` (bool?), `keyBlockers`, `notes`, `recordedById`.
- **`ActionItem`** — id, `projectId`, description, `ownerId` (User?), deadline, `status` (`OPEN` | `DONE`), `carriedOver` (bool), `meetingId` (optional FK to MeetingRecord), `completedAt`.
- **`NotificationRule`** (PM-configurable) — id, name, `triggerType` (`MISSING_SUBMISSION` | `PROJECT_BEHIND` | `ACTION_ITEM_DUE` | `GOAL_MISSED`), `channel` (`EMAIL` | `IN_APP` | `BOTH`), `recipients` (`PM` | `PROJECT_LEADS` | `ACTION_OWNER` | `ALL_ACTIVE`), `enabled` (bool), `thresholdHours` (int? — hours-before-deadline for time-based triggers).
- **`Notification`** (in-app bell) — id, `userId`, `type`, title, body, link, `read` (bool).
- **`Settings`** (singleton, id = `"singleton"`) — `weeksBehindMilestone` (int, default 1), `missedGoalsInARow` (int, default 2), `requireBoth` (bool, default false), `submissionDeadlineHours` (int, default 24). PM edits this via the notification/trigger settings page.

**Seed data** (`prisma/seed.ts`):

- Three built-in roles (all PM-editable; `isBuiltIn` only prevents deletion):
  - **Project Manager** — all permissions including `VIEW_MONTHLY_REVIEW`, `MANAGE_USERS`, `MANAGE_ROLES`, `CONFIGURE_NOTIFICATIONS`.
  - **Project Lead** — `VIEW_ALL_PROJECTS`, `VIEW_ASSIGNED_PROJECTS`, `SUBMIT_STATUS_UPDATES`, `EDIT_OWN_PROJECT`, `CLOSE_ACTION_ITEMS`.
  - **Viewer** — `VIEW_ALL_PROJECTS`, `VIEW_ASSIGNED_PROJECTS` only.
- Settings singleton (`id = "singleton"`) with defaults.
- _PM user is NOT seeded — they sign in via CAS and are auto-activated based on `PM_ADMIN_EMAIL`._

**Database connection:**

- `DATABASE_URL` — Supabase pgBouncer pooler (`port 6543`, `?pgbouncer=true`). Used by the running app.
- `DIRECT_URL` — Supabase direct connection (`port 5432`). Used for `prisma migrate` / `prisma db push`. Note: port 5432 may be unreachable from some environments; apply schema changes via the pooler URL if needed, or use the Supabase dashboard SQL editor.

---

## 5. Features

### 5.1 Pre-Meeting Status Updates (Leads)

A form with five required fields:

- Planned Work for This Week
- Actual Progress (what got done / what didn't)
- Blockers
- Next Week's Goals
- Help Needed (toggle + specifics field)

Tied to a specific meeting/week, timestamped. Submissions are **always allowed** but **visibly marked "late"** if submitted after the deadline (default: 24 hours before the meeting — configurable in Settings). Leads can view their own submission history.

### 5.2 Post-Meeting Tracking (PM)

Per-project interface after each meeting:

- Project Status: On Track / At Risk / Behind
- Weekly Goal Met: Yes / No
- Action Items: who / what / deadline
- Key Blockers (text)

Editable immediately after the meeting. Feeds the dashboard and audit trail.

### 5.3 Red Flag / "Behind" Auto-Detection

- Auto-flag a project as **Behind** when **either** condition is met (configurable in Settings): it's more than N weeks behind its deliverable target dates, **or** it has missed weekly goals M weeks in a row.
- `Settings` singleton stores N (`weeksBehindMilestone`), M (`missedGoalsInARow`), and whether **both** conditions must be true (`requireBoth`).
- Flagged projects require the `correctiveActionPlan` field to be filled before the status can be cleared.
- PM can manually override the auto-status (`statusOverride: true`).

### 5.4 Semester Timeline / Deliverable Tracking

The semester plan is structured as a two-level hierarchy:

- **Deliverables** — major milestones (e.g. "Prototype validated"). Defined by the PM at the start of the semester with a target date and acceptance criteria. Shown as the top-level timeline items. Have a `status` field (`NOT_STARTED` | `IN_PROGRESS` | `BLOCKED` | `COMPLETE`) for richer state representation beyond just done/not-done.
- **Subtasks** — discrete steps needed to complete a deliverable. Assignable to any project member (LEAD, SUBLEAD, or MEMBER). Have their own status, start/due dates, and optional assignee.

**Markdown descriptions:** Both Deliverable and Subtask description fields store Markdown. The description input must provide a **Write / Preview toggle** — a textarea in Write mode, a rendered Markdown preview in Preview mode (GitHub-style). Use `react-markdown` with `remark-gfm` for rendering. The stored value is always the raw Markdown string.

"On track vs. behind" is computed against deliverable target dates. The timeline view shows deliverables as major milestones with expandable subtask lists, what's complete, what's overdue, and what's blocked. Supports Excel export of the full timeline.

### 5.5 Subtask Assignment / My Tasks

Subtasks (nested under Deliverables) can be assigned to any member of the project — lead or general member. The **My Tasks** page shows the current user all subtasks assigned to them across all their projects, with status and due date. This is the primary interface for project members who are not leads.

### 5.6 Notifications & Reminders

Both **email and in-app** notifications are supported.

- Auto-remind leads 24h before the meeting if they haven't submitted (configurable window).
- Notify action-item owners when an item is assigned or nearing its deadline.
- Notify the PM (and optionally leads) when a project trips the "Behind" flag.
- **Configurable trigger system (PM-managed):** PM controls notification rules — what event fires, what threshold, which channel (email / in-app / both), who receives it. The red-flag thresholds in 5.3 also live in Settings (same page).
- **Email:** Resend free tier. If `RESEND_API_KEY` is unset, email sending is skipped; in-app notifications still work.
- **Cron:** A `POST /api/cron/notifications` endpoint runs the notification engine on a schedule. Protected by `CRON_SECRET`. Runnable locally via `pnpm notifications:run`.

### 5.7 Action Item Tracking

- Action items are first-class objects: owner, deadline, `OPEN` / `DONE` status.
- Incomplete items **carry over** (`carriedOver: true`) and are visibly flagged the next week.
- Each lead sees their own open action items and can view (read-only) those on other projects; PM sees and manages all.
- Action items can be linked to the meeting record that created them.

### 5.8 Monthly Review Dashboard

**Access: requires `VIEW_MONTHLY_REVIEW` permission. By default only the Project Manager role has this permission; the PM can grant it to custom roles.**

A view that auto-answers four monthly accountability questions:

- Which projects missed goals multiple weeks in a row?
- What are the most common blockers across projects?
- Where are recurring resource/skill gaps?
- Which projects might need a priority shift?

### 5.9 Submission History / Audit Trail

- Per-project log of every status update and meeting record, chronological.
- "Did they meet their goal?" history feeds accountability metrics.
- Immutable record of commitments over the semester.

### 5.10 Data Visualization

Charts for both leads (own project) and PM (all projects), using **Recharts** and **ShadCN** styled to the earthy palette:

- **Goal completion rate** over the semester (line or bar — % of weekly goals met).
- **Status-over-time** strip per project (On Track / At Risk / Behind across weeks).
- **Deliverable progress** (% complete, timeline view).
- **Blocker frequency** (which blockers recur — bar chart).
- **PM all-projects overview** — a grid/heatmap of every project's current health at a glance.

---

## 6. Pages / Screen List

**Lead view**

- Dashboard (my projects, my open action items, submit-status CTA)
- Submit / edit status update
- My project detail (history, metrics, deliverables + timeline)
- All-projects view (read-only on projects that aren't theirs)
- My Tasks (subtasks assigned to me, across all projects)

**PM view (superset)**

- All-projects dashboard (health grid + flags)
- Project detail + post-meeting tracking entry
- Deliverable / milestone management per project (with subtask assignment)
- Action item board (all projects)
- Monthly review dashboard *(requires `VIEW_MONTHLY_REVIEW` permission — PM-only by default; grantable to custom roles)*
- User/role management (approve pending users, assign to projects as LEAD / SUBLEAD / MEMBER, create/edit/delete custom roles, edit permissions on any role including built-ins)
- Notification & trigger settings (configure rules, thresholds, channels, recipients)

**Viewer view**

- Read-only access to dashboards and project details

**Shared**

- Login (Rutgers NetID via CAS; `/dev-login` mock screen in mock mode)
- Pending approval page (users awaiting PM activation)
- Profile / role indicator

---

## 7. Tech Stack

Chosen for free hosting + a solo maintainer + good fit with Claude Code.

| Concern             | Choice                                                                   | Notes                                                                                                          |
| :------------------ | :----------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| **Package manager** | pnpm                                                                     | Required. Use `pnpm dlx` not `npx`.                                                                            |
| **Framework**       | Next.js 15 (App Router, React 19)                                        | Deploys free on Vercel; handles frontend + API routes.                                                         |
| **Auth**            | Auth.js v5 (`next-auth@5.0.0-beta.25`) + custom CAS Credentials provider | See §3. NOT a Google provider. Prisma adapter for session/user storage.                                        |
| **ORM**             | Prisma v6 (`@prisma/client`, `prisma`)                                   | Schema-first. `prisma generate` runs at build time.                                                            |
| **Database**        | Supabase (Postgres, free tier)                                           | Two connection strings: pgBouncer pooler for the app, direct for migrations.                                   |
| **UI components**   | shadcn/ui                                                                | Init with `pnpm dlx shadcn@latest init`. Theme customized to the earthy palette (§10).                         |
| **Styling**         | Tailwind CSS v3 + shadcn semantic tokens                                 | Use semantic tokens (`bg-background`, `text-muted-foreground`) throughout; never raw hex in component classes. |
| **Icons**           | Phosphor Icons (`@phosphor-icons/react`)                                 | Use Bold or Fill weight consistently. Do NOT use Lucide React.                                                 |
| **Charts**          | Recharts                                                                 | Styled to the earthy palette — see §10.                                                                        |
| **Animation**       | GSAP + `@gsap/react`                                                     | ScrollTrigger for scroll-driven reveals. See §10 for motion rules.                                             |
| **Email**           | Resend (`resend`) free tier                                              | Optional — app is fully usable without it.                                                                     |
| **Font loading**    | `next/font`                                                              | Instrument Serif (display), Geist Sans (body), JetBrains Mono (labels/data).                                   |
| **Hosting**         | Vercel (free)                                                            | Set `AUTH_URL` to the production URL in env.                                                                   |
| **TypeScript**      | Strict mode                                                              | Use `tsc --noEmit` in CI.                                                                                      |

---

## 8. Build Phases (suggested order)

**Phase 0 — Project scaffold**
`pnpm create next-app` with TypeScript + Tailwind + App Router. Install and init shadcn/ui. Install Prisma, configure two Supabase connection strings. Add `next/font` with Instrument Serif, Geist Sans, JetBrains Mono. Apply the earthy palette to the shadcn theme (see §10). Install Phosphor Icons, GSAP + `@gsap/react`.

**Phase 1 — Foundation: Auth + RBAC**
Implement CAS auth (mock mode first): `/api/cas/login` route, `/dev-login` mock screen, `/cas/callback` ticket validation, Auth.js custom Credentials provider with handoff tokens, Prisma adapter setup. Seed the three built-in roles and the Settings singleton. Implement pending-user flow and PM auto-activation. Middleware to protect routes by session.

**Phase 2 — Core loop**
Projects + Deliverables (with Subtasks), pre-meeting status form (with late-marking logic reading from `Settings.submissionDeadlineHours`), post-meeting tracking. This phase alone makes the app usable for a meeting cycle.

**Phase 3 — Accountability**
Action items with carry-over, red-flag auto-detection reading from the Settings singleton, audit trail / submission history, My Tasks page (subtasks assigned to the current user).

**Phase 4 — Visibility**
Dashboards, Recharts charts (styled to palette), monthly review view, all-projects read-only access for leads/viewers, timeline view with deliverable/subtask hierarchy and Excel export.

**Phase 5 — Configurability & polish**
Custom-role builder, configurable notification/trigger settings UI, email + in-app notification engine + cron endpoint, empty states, mobile-responsive layout, GSAP scroll-reveal animations, final design-token QA pass against §10 rules.

---

## 9. Resolved Decisions

- **Auth method:** Rutgers CAS SSO via a custom Auth.js Credentials provider (NOT Google OAuth). Mock mode (`CAS_MODE=mock`) for local dev until the app is registered with Rutgers IdM.
- **Auth domain:** `scarletmail.rutgers.edu` and/or `rutgers.edu`. Set via `ALLOWED_EMAIL_DOMAINS` env var. Confirm exact strings in the Rutgers CAS documentation before switching to real mode.
- **ORM:** Prisma. Schema in `prisma/schema.prisma` is the single source of truth for the data model.
- **Package manager:** pnpm. Always use `pnpm` / `pnpm dlx`; never `npm` or `npx`.
- **UI components:** shadcn/ui with the earthy palette applied to the generated theme.
- **Icons:** Phosphor Icons (Bold / Fill weight). Lucide React is explicitly excluded.
- **Viewer role:** Yes — plus a full custom-role/permission system the PM manages.
- **Notifications:** Email (Resend) + in-app, with a PM-configurable trigger system. App works without email configured.
- **Auto-"Behind" trigger:** Fires when either N weeks behind deliverable targets or M missed weekly goals in a row; both thresholds are PM-configurable in Settings.
- **Late submissions:** Allowed but visibly marked late (not locked). Deadline window is PM-configurable in Settings.
- **Lead visibility:** Leads can view all projects, edit only their own.
- **Timeline structure:** Two-level: Deliverable (major milestone) → Subtask (discrete step, assignable to any project member).
- **Project membership roles:** Three levels — `LEAD` (runs the project), `SUBLEAD` (deputy lead, can submit updates and co-manage), `MEMBER` (receives delegated subtasks, read-only project view).
- **Built-in roles:** Configurable. `isBuiltIn` only prevents deletion; the PM can edit names and permissions on all three built-in roles. `VIEW_MONTHLY_REVIEW` is granted only to Project Manager by default.
- **Monthly review access:** Gated by `VIEW_MONTHLY_REVIEW` permission. PM-only by default; the PM can grant it to custom roles.
- **Markdown descriptions:** Deliverable and Subtask description fields store raw Markdown. UI provides a Write / Preview toggle using `react-markdown` + `remark-gfm`.
- **CAS auth implementation:** Manual custom Credentials provider in Auth.js (no CAS library needed). There is no official or well-maintained Auth.js CAS provider package; the handoff token + HMAC pattern is the correct approach.
- **PM seed account:** Not a seeded database row. PM auto-activates on first CAS sign-in based on `PM_ADMIN_EMAIL` env var.

---

## 10. Visual Theme & Design Direction

**Overall direction: earthy editorial minimalism.** The forest / natural palette grounds the identity; the aesthetic is flat and document-like — think a park service field guide printed on warm paper. Depth comes from typographic scale and whitespace, not translucency or shadows. No glassmorphism, no backdrop-filter blur.

### Skills driving this section

| Skill                               | Role                                                                                                           |
| :---------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| `minimalist-ui`                     | Primary aesthetic: flat bento grid, editorial typography, warm monochrome base, banned-element rules           |
| `dashboard`                         | Data-layer hierarchy: modular grids, metric emphasis, loading / error / empty state patterns for tracker views |
| `shadcn` + `ui-styling`             | Component execution: shadcn/ui primitives themed to this palette via CSS custom properties                     |
| `gsap-react` + `gsap-scrolltrigger` | Animation: scroll-triggered reveals, staggered list entrance, hover micro-interactions                         |
| `ui-ux-pro-max`                     | Quality gate: accessibility (contrast, touch targets, focus states), responsive behavior, UX patterns          |
| `frontend-design`                   | Distinctiveness check: ensure the result reads as specific to SEED, not a generic SaaS template                |

### Color palette

Color is a scarce resource — used for semantic meaning or identity, never decoration.

- **Canvas / base background:** warm paper-white `#F4F1EA`
- **Primary surface (cards):** `#FFFFFF` or `#F9F8F5`
- **Structural borders / dividers:** warm `#E2E0D9`
- **Forest identity green** (primary action — buttons, links, active nav): `#2E4034`
- **Moss** (On Track status + spot accents): `#588157` on badge background `#EDF3EC`
- **Sage** (supporting tones, subtle icon backgrounds): `#A3B18A`
- **Earth warmth** (secondary accent, use sparingly): bark `#6F4E37`, clay `#B07156`
- **Status colors — natural, not traffic-light:**
  - On Track: `#588157` text on `#EDF3EC` background
  - At Risk: `#C99846` text on `#FBF3DB` background
  - Behind: `#A4503C` text on `#FDEBEC` background
- **Body text:** warm charcoal `#2B2B26`
- **Secondary / muted text:** `#787774`

Map these values to the shadcn CSS variable layer (`--background`, `--card`, `--primary`, `--muted`, etc.) so all components inherit them automatically via semantic tokens.

### Typography

Load via `next/font`:

- **Display / section headings:** Instrument Serif — tracking `−0.02em`, line-height `1.1`
- **Body / UI copy:** Geist Sans — `16px`, line-height `1.6`
- **Labels, metadata, timestamps, code snippets:** JetBrains Mono — `12px`, weight 600

Do NOT use Inter, Roboto, or Open Sans.

### Layout

- **Bento grid for dashboards:** asymmetric CSS Grid; flat cards with `border: 1px solid #E2E0D9`, `border-radius: 8px–12px`, `padding: 24px–32px`. No `backdrop-filter` blur anywhere.
- **Data tables and submission history:** solid `#F9F8F5` surface, prioritize readability.
- **Generous vertical whitespace** between sections; content constrained to `max-w-5xl`.
- Shadows must be ultra-diffuse and low opacity (< 0.05) if used at all. Depth via type scale and whitespace, not elevation.

### Icons

Use Phosphor Icons (`@phosphor-icons/react`), Bold or Fill weight, consistently sized. Do not use Lucide React or Heroicons.

### Charts (Recharts)

Series colors: moss, forest, sage, clay in that order. Gridlines: `stroke: #E2E0D9`. Tick labels: `#787774`. No default blue or orange. Charts must read as native to the palette — not bolted on.

### Texture

A faint warm paper-grain SVG at `opacity: 0.025` on the `<body>` via `background-image`. Present always; imperceptible in data-dense views because content surfaces sit above it at full opacity.

### Animation (GSAP)

Use `@gsap/react` and `gsap/ScrollTrigger`. Register ScrollTrigger once at the app root.

- **Scroll-entry reveals:** `gsap.from(el, { y: 12, opacity: 0, duration: 0.6, ease: "power3.out" })` via ScrollTrigger, `start: "top 85%"`.
- **Staggered grid/list:** `stagger: 0.08` on grid card collections.
- **Card hover:** CSS transition only — `box-shadow` from `0 0 0` to `0 2px 8px rgba(0,0,0,0.04)` over `200ms`.
- Animate exclusively via `transform` and `opacity`. No layout-triggering properties.
- Respect `prefers-reduced-motion`: wrap GSAP animations in a `gsap.matchMedia()` block and provide a no-motion fallback.
- Clean up ScrollTrigger instances in component unmount / React effect cleanup.

### Banned elements (from `minimalist-ui` skill — enforced)

- Glassmorphism / `backdrop-filter` blur on any surface
- Tailwind default heavy shadows (`shadow-md`, `shadow-lg`, `shadow-xl`)
- Gradient backgrounds on large sections
- Pill-shaped (`rounded-full`) containers, cards, or primary buttons
- Lucide, Feather, or standard Heroicons
- Inter, Roboto, or Open Sans typefaces
- Emojis in UI, markup, or alt text

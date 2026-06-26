# Changes

Running log. Keep entries terse — one line per unit of work. Newest at top.

## Conventions
- Branches: `develop` = always-working integration branch; features on `feat/phase-N-*` off develop.
- Promote `develop` -> `main` only when told. Never merge non-booting code into `develop`.
- DB resets via pooler: `pnpm dlx prisma db push --accept-data-loss` (direct 5432 unreachable).

## Status by phase
- [x] Phase 0 — Scaffold (Next.js, shadcn, Prisma, fonts, palette, icons, GSAP)
- [x] Phase 1 — Auth + RBAC (CAS mock, schema, seed, DB reset, middleware)
- [x] Phase 2 — Core loop (projects, deliverables/subtasks, status form, post-meeting)
- [x] Phase 3 — Accountability (action items, red-flag detection, audit trail, My Tasks)
- [x] Phase 4 — Visibility (dashboards, charts, monthly review, timeline + Excel export)
- [ ] Phase 5 — Configurability & polish (role builder, notifications, cron, responsive, motion)

## Log
- 2026-06-26 — Phase 4 complete. `feat/phase-4-visibility` merged to `develop`.
  Recharts charts (goal completion bar, status history strip, deliverable
  progress bars, blocker frequency). /projects/[id]/timeline with Gantt-style
  bars + today marker. /pm/review monthly review (repeated misses, overdue
  deliverables, blocker + gap frequency charts, health grid). Excel export at
  /api/projects/[id]/export (3 sheets). Dashboard enhanced: PM stats grid,
  shortcuts, per-project charts, open action items widget.
- 2026-06-26 — Phase 3 complete. `feat/phase-3-accountability` merged to `develop`.
  Action items (inline create, mark done, reopen, carry-over badge). Red-flag
  auto-detection reads Settings singleton; sets project BEHIND on overdue
  deliverables or N missed goals in a row; fires after every meeting record.
  Audit trail at /projects/[id]/history (merged timeline). /action-items page
  (PM sees all, others see assigned). My Tasks now shows action items + subtasks.
- 2026-06-26 — Phase 2 complete. `feat/phase-2-core-loop` merged to `develop`.
  (app) route group with sidebar layout gated by permissions.
  Projects CRUD, Deliverables + Subtasks with Markdown write/preview (react-markdown + remark-gfm).
  Pre-meeting status form with late-marking (reads Settings.submissionDeadlineHours).
  Post-meeting meeting record form; updates project.status unless statusOverride.
  Member management (LEAD/SUBLEAD/MEMBER). My Tasks page for assigned subtasks.
- 2026-06-26 — Phase 1 complete. `feat/phase-1-auth-rbac` merged to `develop`.
  Auth.js v5 Credentials provider with HMAC handoff tokens (60s TTL).
  CAS mock mode via /dev-login server action; real CAS callback skeleton in place.
  Prisma v7 client uses @prisma/adapter-pg (WASM engine requires driver adapter).
  Schema enum names aligned with existing DB (TimelineStatus, Channel, RecipientGroup).
  3 built-in roles + Settings singleton seeded. PM auto-activates on first sign-in.
  Edge-safe middleware: auth.config.ts (no Node) + full auth.ts.
- 2026-06-26 — Phase 0 complete. `feat/phase-0-scaffold` merged to `develop`.
  Stack: Next.js 16.2 / React 19 / Tailwind v4 / shadcn (@base-ui) / Prisma v7.
  Fonts: Geist Sans + Instrument Serif + JetBrains Mono via next/font/google.
  Earthy palette mapped to shadcn CSS variables; GSAP + ScrollTrigger registered at root.
  Phosphor Icons (Bold/Fill); lucide-react excluded. Prisma schema covers all §4 models.
  Themed landing page renders at /; pnpm dev boots cleanly → HTTP 200.
- 2026-06-26 — Repo confirmed clean-slate after "Restart from scratch" (skills + env + outline only).
  Created `develop` integration branch. Wrote `claude/BOOTSTRAP_PROMPT.md` and this file.
  DB not yet reset — deferred to Phase 1 (done via 6543 pooler). Ready to start Phase 0.

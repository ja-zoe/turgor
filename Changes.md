# Changes

Running log. Keep entries terse — one line per unit of work. Newest at top.

## Conventions
- Branches: `develop` = always-working integration branch; features on `feat/phase-N-*` off develop.
- Promote `develop` -> `main` only when told. Never merge non-booting code into `develop`.
- DB resets via pooler: `pnpm dlx prisma db push --accept-data-loss` (direct 5432 unreachable).

## Status by phase
- [x] Phase 0 — Scaffold (Next.js, shadcn, Prisma, fonts, palette, icons, GSAP)
- [ ] Phase 1 — Auth + RBAC (CAS mock, schema, seed, DB reset, middleware)
- [ ] Phase 2 — Core loop (projects, deliverables/subtasks, status form, post-meeting)
- [ ] Phase 3 — Accountability (action items, red-flag detection, audit trail, My Tasks)
- [ ] Phase 4 — Visibility (dashboards, charts, monthly review, timeline + Excel export)
- [ ] Phase 5 — Configurability & polish (role builder, notifications, cron, responsive, motion)

## Log
- 2026-06-26 — Phase 0 complete. `feat/phase-0-scaffold` merged to `develop`.
  Stack: Next.js 16.2 / React 19 / Tailwind v4 / shadcn (@base-ui) / Prisma v7.
  Fonts: Geist Sans + Instrument Serif + JetBrains Mono via next/font/google.
  Earthy palette mapped to shadcn CSS variables; GSAP + ScrollTrigger registered at root.
  Phosphor Icons (Bold/Fill); lucide-react excluded. Prisma schema covers all §4 models.
  Themed landing page renders at /; pnpm dev boots cleanly → HTTP 200.
- 2026-06-26 — Repo confirmed clean-slate after "Restart from scratch" (skills + env + outline only).
  Created `develop` integration branch. Wrote `claude/BOOTSTRAP_PROMPT.md` and this file.
  DB not yet reset — deferred to Phase 1 (done via 6543 pooler). Ready to start Phase 0.

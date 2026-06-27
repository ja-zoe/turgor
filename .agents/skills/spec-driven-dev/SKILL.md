---
name: spec-driven-dev
description: Spec-driven feature development in a versioned changes/ directory — plan and review specs before code, gate each feature's merge on its own tests, and keep a running log. Use when starting a feature set, planning or scaffolding implementation, continuing work across sessions, or tracking/branching/merging feature work. Maintains a shared CONTEXT.md plus one directory per feature set (each with a _set.md index and one spec-per-feature file) that serve as both the cold-start bootstrap prompt and a real-time completion log.
---

# Spec-Driven Development

## Overview

This skill manages a `changes/` directory at the project root. It tracks feature work so that any new (cold-start) session can be bootstrapped without re-deriving context from the codebase, and so there is a permanent paper trail of what was built and why.

The system has three layers, smallest-loaded-first:

1. **`changes/CONTEXT.md`** — project-wide invariants. Loaded once. Rarely changes.
2. **`changes/N-slug/_set.md`** — one per revision set. The set's status checklist, open questions, and roll-up log. The entry point for "resume this set."
3. **`changes/N-slug/RN.M-slug.md`** (file) or **`changes/N-slug/RN.M-slug/`** (directory) — one per feature. The spec and feature-level notes.

The point of the split is **context economy**: a session working on one feature loads `CONTEXT.md` + that set's `_set.md` + that one feature — never the specs or logs of unrelated features. This also makes features safe to hand to parallel agents (see the caveat under "Parallel agents").

When the user says "start revision X", "plan the next set", "scaffold the next revision", or "continue revision N", invoke this skill.

---

## Directory layout

```
changes/
  CONTEXT.md                      # project invariants — loaded once, shared by all sets
  5-logo-mcp-notify/              # a revision set = a directory named N-slug
    _set.md                       # set index: status checklist, open questions, roll-up log
    R5.1-notification-fix.md      # small feature → single file (spec + notes inline)
    R5.2-deliverable-crud/        # large feature with attachments → directory
      spec.md
      log.md
      screenshots/
```

Rules:

- **Sets are directories** named `N-slug` (e.g. `6-billing`). `N` is sequential. The slug is a short kebab-case theme.
- **Features are files by default**, named `RN.M-slug.md`. A small feature keeps its spec and notes in that one file.
- **Promote a feature to a directory** (`RN.M-slug/` with `spec.md`, `log.md`, and any assets) only when it carries dependencies — screenshots, SQL files, multiple design docs, etc. Don't create a directory for a one-line fix.
- **Nothing is ever deleted.** Completed sets and features stay as a permanent record.

---

## CONTEXT.md — the shared bootstrap

`CONTEXT.md` holds everything a cold-start session needs to avoid mistakes, that is **not** obvious from reading the code and **does not** change per revision set:

- Package manager (especially if not npm)
- Banned libraries or patterns ("Lucide is banned, use Phosphor Icons")
- DB access constraints ("never use prisma db push; apply DDL via scripts/apply-schema.ts")
- Build/runtime quirks ("Prisma v7 WASM requires the adapter in the constructor")
- Auth quirks, deployment notes, style system / palette
- Standing architectural decisions and rejected alternatives (so they aren't re-litigated)

Do **not** put per-set or per-feature detail here. Do **not** duplicate things derivable from the code (file structure, variable names, standard framework conventions). If a fact is already authoritative in the repo's `CLAUDE.md`, reference it rather than copying it — keep `CONTEXT.md` to the delta.

Update `CONTEXT.md` in place when an invariant genuinely changes. It is the only file that is edited rather than appended to.

---

## _set.md — the set index

One per set. This is the lightweight "load me to resume the set" file. Structure:

```markdown
# Revision Set N — <title>

Bootstrap: read `changes/CONTEXT.md` first for project invariants.
This file is the index and roll-up log for set N. Per-feature specs live in the
sibling `RN.M-*` files; load only the feature(s) you are working on.

## Status
<!-- markers: [ ] not started · [~] in progress · [t] tests passing, awaiting merge · [x] merged -->
- [ ] RN.1 — <short name> — <one-line description>
- [ ] RN.2 — <short name> — <one-line description>

## Open questions / decisions before implementing
1. **<Topic>:** <Question.> Recommendation: <recommendation>. Confirm before implementing.

(Remove items once answered. "None." if there are none.)

## DB changes in this set
(Roll-up of schema changes across features, with how to apply. "None." if none.)

## Log
- YYYY-MM-DD — <set-level milestone: set created, set completed, branch merged>.
```

The `_set.md` log is for **set-level** milestones (set scaffolded, set complete, branch merged). **Feature-level** notes go in the feature's own file. This keeps the index small.

### Real-time status updates (telemetry — keep it cheap)

The Status checklist is the live progress monitor. Update it **as work happens**, but treat it as secondary to the actual implementation — these edits must be near-free:

- Flip a single marker character only: `[ ]` → `[~]` when you start a feature, `[~]` → `[t]` the moment its tests pass, `[t]` → `[x]` when its branch merges.
- **No prose in `_set.md` during work.** Narrative, deviations, and root causes go in the feature file's Notes/log at ship time — not here. The roll-up Log gets an entry only at set-level milestones.
- One marker flip per state change; don't rewrite the line or re-describe the feature. Don't batch flips at the end — the point is that a watcher reading only `_set.md` sees current state without opening anything else.

---

## Branching (mandatory)

Every set and every feature is developed on its own branch. **`main` is the single integration branch** — it is always working, and it is what you branch from and merge back into. (Confirm the integration branch name against the project's `CONTEXT.md`; if no separate integration branch exists, it is `main`. Do not invent a `develop`.)

- **Set branch:** when a set begins, branch off `main`: `feat/setN-<slug>` (e.g. `feat/set6-billing`).
- **Feature branch:** for each feature, branch off the *set* branch: `feat/setN/RN.M-<slug>` (e.g. `feat/set6/R6.2-invoice-pdf`).
- **Merge gate — this is the point of the structure:** a feature branch merges into the set branch **only after the feature's test scheme passes** — that is the feature file's `## Tests` section, or its `tests.md` if the scheme was promoted (see Tests). Whichever one the feature uses *is* the gate. Never merge a feature whose tests fail or that doesn't boot.
- **Set merge:** the set branch merges into `main` **only after every feature's test scheme has passed and the app boots clean** — and only when the user says to. Never merge non-booting code into `main`.
- Record the merge in the log: the feature's Notes/log on feature merge, and `_set.md` Log on set merge.

Before parallelizing features across agents, also apply the file-overlap check under "Parallel agents" — separate branches don't prevent two features from editing the same source file.

---

## Feature files — RN.M-slug.md

Each feature file is the spec, the test scheme, and the implementation notes for one feature. For a small feature all three live in the one file; for a directory feature, `spec.md` holds the spec, `log.md` holds the notes, and the test scheme can be promoted to `tests.md` (see Tests).

```markdown
# RN.M — <full feature name>

**Status:** planned | in progress | tests passing | done
**Files:** <the files this touches — list them>

## Spec

**Problem:** <What is broken or missing and why it matters.>

**Approach:** <How to implement it, specific enough that a cold session executes without
re-deriving decisions: component/function names, data flow, state location, RBAC, edge
cases, packages involved. Include SQL here if this feature needs DB changes (also roll it
up into _set.md).>

## Tests

<The merge gate for this feature. List the concrete checks that must pass before its
branch merges: build/typecheck, unit/integration tests to run, and manual/Playwright
steps with expected results. Mark each pass/fail during verification. For a large scheme,
replace this section with: "See tests.md." and put the detail there.>

## Notes / log
- YYYY-MM-DD — <what was built, deviations from spec, surprises, root causes found>.
```

The **Spec** section is the part the user reviews and approves before implementation — keep it clean and decision-complete. The **Tests** section is the merge gate. The **Notes / log** section is append-only and accrues during implementation.

### Feature Spec quality bar

A good spec answers:
- **What exactly is wrong or missing?** (not "add X" but "X is missing because Y, causing Z")
- **Which files change?** (list them)
- **Where does state live?** (client / server / DB / localStorage — explicit)
- **What's the data flow?** (user action → server action → DB → revalidate → UI)
- **Non-obvious constraints?** (permission checks, edge cases, things that bit you before)
- **What packages or APIs are involved?**

Bad: "add a delete button for subtasks." Good: "add a `deleteSubtask(id)` server action to `src/lib/actions/deliverables.ts` — auth-gated by project membership or `MANAGE_MILESTONES` — and a slide-in confirmation in `SortableDeliverables` using `confirmingDelete: string | null` state, CSS `translateX` transition, `XCircle` Phosphor icon."

---

## Tests — the merge gate, scaled to the feature

Each feature defines its own test scheme, and that scheme is what gates its merge (see Branching). The scheme scales with the feature, mirroring how a large feature gets promoted to a directory:

- **Small feature → inline.** The `## Tests` section in the feature's `.md` file is the whole scheme: a short checklist of the build/typecheck command, any tests to run, and the manual/Playwright steps with expected results.
- **Large feature → promoted to `tests.md`.** When the scheme is big enough that it would dominate the feature file (many cases, fixtures, a matrix of states), put `tests.md` alongside `spec.md`/`log.md` in the feature directory and leave `## Tests` → "See tests.md." in the spec.

**Whichever location is in use is the single source of truth for that feature's gate** — there is never a second, competing scheme. To merge a feature, run its scheme, mark each item pass/fail in that location, and only merge when all pass and the app boots. Mark the feature `[t]` in `_set.md` Status the moment the scheme passes, `[x]` when it merges.

Write the scheme during scaffolding when you can (so the gate is reviewable up front), or at the latest when implementation of that feature begins. A scheme of "none — covered by the set-wide build + boot check" is acceptable for a trivial feature, but say so explicitly rather than leaving `## Tests` empty.

---

## Scaffolding a new set (planning mode)

When the user asks to plan or scaffold a set without implementing yet:

1. Read `changes/CONTEXT.md`. If something the new set depends on isn't captured there and is a true project invariant, add it. Skim the previous set's `_set.md` for recent conventions.
2. Create `changes/N-slug/` and `changes/N-slug/_set.md` with the Status checklist and any Open Questions.
3. Create one feature file (`RN.M-slug.md`) per item, each with a complete **Spec**, a **Tests** scheme (inline, or `tests.md` if large — see Tests), and an empty **Notes / log**. Promote a feature to a directory only if it will carry attachments.
4. Roll up all DB schema changes into `_set.md`'s "DB changes in this set" (SQL + how to apply), and also put each in its owning feature's Spec.
5. Surface only genuine human-decision Open Questions, each ending in a concrete recommendation.
6. Write **no code.** The files are the only output.

---

## Resuming a set from an existing session

When the user says "continue set N" / "load set N" / opens a set file:

1. Read `CONTEXT.md` (if not already loaded) and the set's `_set.md`.
2. From `_set.md` Status, find incomplete `[ ]` items. Check Open Questions — surface any unanswered blockers before writing code.
3. Load **only** the feature file(s) you'll work on. Read its Notes / log for current state.
4. Do **not** re-read the whole codebase or sibling feature files you aren't touching — `CONTEXT.md` + `_set.md` + the feature file are authoritative for setup.
5. Begin with the first incomplete item unless directed otherwise.

---

## Marking work complete

A feature "ships" only once its test scheme passes and its branch is merged into the set branch (see Branching, Tests). The `_set.md` marker flips track this in real time and stay cheap (single-character edits, no prose — see Real-time status updates):

1. `[~]` while implementing → `[t]` the moment its test scheme passes → `[x]` when its branch merges. Flip as each state is reached, not in a batch at the end.
2. Set the feature file's `**Status:**` accordingly, and mark each item in its Tests scheme pass/fail as you verify.
3. On merge, append one dated entry to the feature file's **Notes / log** (what was built, files changed, deviations, which scheme passed, branch merged). This is where narrative lives — not in `_set.md`.
4. When every item is `[x]` and the app boots clean, and the user says to, merge the set branch into `main` and append to `_set.md` Log: `- YYYY-MM-DD — Set N complete. Merged feat/setN-<slug> to main.`

Update markers and logs **as work happens / when a feature ships**, not at the end of the set.

---

## When to create a new set

Create `changes/(N+1)-slug/` when **any** are true:
- The current set's Status is fully `[x]`.
- The user explicitly asks to start a new set.
- Incoming work is thematically unrelated to the current set.

Do **not** create a new set just because a session is ending. The current set stays open across sessions until its features are done.

---

## Parallel agents

The directory layout isolates **context** (each feature is self-contained), which makes features safe to fan out to parallel agents. It does **not** isolate **code**: two features that edit the same source file (e.g. both adding tools to one route) will collide regardless of how cleanly their specs are separated. Before parallelizing, check whether the features touch disjoint files. If they share a file, sequence them or have one agent own that file.

---

## Anti-patterns to avoid

- **Don't write code in revision files.** Architecture, SQL, and component names are fine. Implementation belongs in source.
- **Don't duplicate `CONTEXT.md` into set or feature files.** The whole point is to load shared context once. If you're copying the project-context block, stop and reference `CONTEXT.md`.
- **Don't put feature detail in `_set.md`.** It's an index; keep it small so resuming a set is cheap.
- **Don't create a directory for a one-line feature.** File-by-default; directory only when there are attachments.
- **Don't leave Open Questions vague.** Each ends in a concrete recommendation the user can answer yes/no to.
- **Don't let logs fall behind.** Update on ship, not at set close.
- **Don't number features across sets.** R2.3 is not R3.3. Each set starts at N.1; features within set N are numbered RN.1, RN.2, ….
- **Don't merge a feature that fails its tests or doesn't boot**, and don't merge a set branch into `main` until every feature passes and the user says to. See Branching.

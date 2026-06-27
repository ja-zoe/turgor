---
name: revision-tracking
description: Feature development tracking via versioned revision files in a changes/ directory. Use when starting a new feature set, planning implementation, continuing work across sessions, or when the user asks to track, plan, or scaffold a new revision. Creates and maintains numbered markdown files (1.md, 2.md, ...) that serve as both the session bootstrap prompt and a running completion log.
---

# Revision Tracking System

## Overview

This skill manages a `changes/` directory at the project root. Each file in it represents one **revision set** — a named batch of related features or fixes planned and tracked together. The files serve two purposes simultaneously:

1. **Bootstrap prompt** — loaded at the start of any new session to give full context without re-deriving it from the codebase.
2. **Running log** — updated in place as work completes, so the file always reflects current state.

When the user says "start revision X", "plan the next set of features", "scaffold 3.md", or similar, invoke this skill.

---

## File naming and lifecycle

```
changes/
  1.md   ← first revision set (completed)
  2.md   ← second revision set (in progress or complete)
  3.md   ← next revision set (planning / scaffolding)
```

- Files are numbered sequentially starting at `1.md`.
- A file is created when a new revision set begins — either when planning starts (scaffold) or when implementation begins.
- A file is never deleted. Completed revisions stay as a permanent record.
- When moving from planning to implementation, mark the file header with the branch name: `feat/rev3-*`.

---

## Canonical file structure

Every revision file follows this exact structure. Sections are mandatory unless marked optional.

```markdown
# Revision Set N — Bootstrap & Scaffolding

This file is the canonical bootstrap prompt and running log for Revision Set N.
Load it at the start of any session continuing this work.

---

## Project context

**App:** [App name and one-line description]
**Repo root:** [absolute path]
**Primary branch strategy:** [e.g. develop = integration; feat/revN-* for this set]
**Package manager:** [pnpm / npm / yarn — be specific]
**[Other invariants that affect every session: DB access pattern, auth system, banned libraries, style constraints, etc.]**

---

## Revision Set N — Feature list

### Status
- [ ] RN.1 — [Short name] — [one-line description]
- [ ] RN.2 — [Short name] — [one-line description]
- [ ] RN.3 — [Short name] — [one-line description]

---

## Feature specs

### RN.1 — [Full feature name]

**Problem:** [What is broken or missing and why it matters.]

**Scope:** [Which files, routes, or components are affected.]

**Approach:** [How to implement it. Be specific enough that a cold-start session can execute without re-deriving decisions. Include component names, data flow, state location, and any non-obvious constraints.]

**No DB changes needed.** ← or describe what changes are needed

---

### RN.2 — [Full feature name]

[Same structure as above]

---

## Conventions

- Branches: [branching strategy]
- Promote [branch] → [branch] only when told.
- Never merge non-booting code into [integration branch].
- [Any other project-specific conventions that must be followed every session]

---

## DB changes in this revision

### [Model or table name] ([which feature])
```sql
ALTER TABLE "..." ADD COLUMN IF NOT EXISTS "..." TEXT;
```
[How to apply: migration tool, script name, manual step, etc.]

[Repeat per schema change. If none: "No DB changes in this revision."]

---

## Open questions / decisions before implementing

1. **[Topic]:** [Question.] Recommendation: [your recommendation]. Confirm before implementing.
2. **[Topic]:** [Question.] Recommendation: [your recommendation]. Confirm before implementing.

[List anything that requires user input before implementation can start. Remove items once answered.]

---

## Log

- [YYYY-MM-DD] — [What was completed. One paragraph. Reference branch name. Note any surprises or deviations from the plan.]
```

---

## When to create a new revision file

Create `N+1.md` when **any** of these are true:
- The current revision's feature list is fully checked off (`[x]` on all items).
- The user explicitly asks to start a new revision set.
- The incoming features are thematically unrelated to the current revision (e.g., current revision is bug fixes; new request is a major new subsystem).

Do **not** create a new file just because a session is ending. The current file stays open across sessions until its features are done.

---

## Marking work complete

When a feature is finished:

1. Change `- [ ] RN.X` to `- [x] RN.X` in the Status list.
2. Append a log entry at the **top** of the `## Log` section (newest first):
   ```
   - YYYY-MM-DD — RN.X complete. [What was built, which files changed, any deviations from the spec, branch merged.]
   ```
3. If all items are checked, add a final log entry: `- YYYY-MM-DD — Revision Set N complete. Merged feat/revN-* to [integration branch].`

---

## Starting a session from an existing revision file

When a user says "continue revision 3" or "load 3.md" or starts a session with the revision file open:

1. Read the file fully.
2. Identify which items are `[ ]` (incomplete) vs `[x]` (done).
3. Read the Log section for the most recent entry to understand what state the codebase is in.
4. Check the Open Questions section — if any are unanswered and block implementation, surface them before writing code.
5. Begin with the first incomplete item unless the user directs otherwise.
6. Do **not** re-read the whole codebase from scratch — the file's Project Context and Feature Specs sections are authoritative for session setup.

---

## Scaffolding a new revision file (planning mode)

When the user asks to plan or scaffold a new revision without implementing yet:

1. Read all previous `changes/N.md` files to understand what's been built and what conventions exist.
2. Create `changes/N+1.md` using the canonical structure above.
3. Fill in the Project Context by copying and updating from the previous file — the invariants rarely change.
4. Translate the user's feature requests into numbered items in the Status list.
5. Write a Feature Spec for each item: Problem → Scope → Approach. Be specific about implementation decisions so future sessions don't re-derive them.
6. List all DB schema changes needed (SQL + how to apply).
7. Surface genuine open questions in the Open Questions section. Only list things that require a human decision — don't list things you can decide.
8. Leave the Log section empty (just the header): `## Log\n\n*(no entries yet)*`
9. Do not write any code. The file is the only output.

---

## Scope of the Project Context section

The Project Context section should capture **everything a cold-start session needs to know to not make a mistake** — things that aren't obvious from reading the code:

- Package manager (especially if it's not npm)
- Banned libraries or patterns ("Lucide is banned, use Phosphor Icons")
- DB access constraints ("never use prisma db push; apply DDL via scripts/apply-schema.ts")
- Auth quirks ("PM auto-activates via PM_ADMIN_EMAIL env var")
- Build or runtime constraints ("Prisma v7 WASM requires adapter in constructor")
- Style system and palette
- Deployment or environment notes

Do not include things derivable from reading the code (file structure, variable names, standard framework conventions).

---

## Feature Spec quality bar

A good Feature Spec answers:
- **What exactly is wrong or missing?** (not just "add X" but "X is missing because Y and it causes Z")
- **Which files will change?** (list them; don't say "relevant files")
- **Where does state live?** (client, server, DB, localStorage — be explicit)
- **What's the data flow?** (user action → server action → DB → revalidate → UI)
- **What are the non-obvious constraints?** (permission checks, edge cases, things that bit you before)
- **What packages or APIs are involved?**

A bad Feature Spec says "add a delete button for subtasks." A good one says "add a `deleteSubtask(id)` server action to `src/lib/actions/deliverables.ts` — auth-gated by project membership or `MANAGE_MILESTONES` — and a slide-in confirmation micro-interaction in `SortableDeliverables` using `confirmingDelete: string | null` state, CSS `translateX` transition, `XCircle` Phosphor icon."

---

## Anti-patterns to avoid

- **Don't write code in the revision file.** Architecture, SQL, and component names are fine. Actual implementation belongs in source files.
- **Don't duplicate things already in the codebase.** The Project Context section is for invariants and gotchas, not a summary of every file.
- **Don't leave Open Questions vague.** Every question should end with a concrete recommendation. The user should be able to answer "yes" or "no" to each one.
- **Don't let the log fall behind.** Update it when a feature ships, not at the end of the revision. The log is the source of truth for what's been built.
- **Don't number features across revisions.** R2.3 is not R3.3. Each revision starts at N.1.

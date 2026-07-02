# SEED Project Tracker

A project tracking web app for student organizations. It was built for [SEED (Students for Environmental & Energy Development)](https://github.com/ja-zoe/seed-website) at Rutgers, and is being generalized so any club can run it for their own projects.

> **Note:** as part of that generalization, this repository will be renamed in the future.

## What it does

- **Projects and deliverables** - projects with deliverables, subtasks, timelines, and per-semester views
- **Status tracking** - weekly status updates from project leads, with automatic red-flag detection that marks a project BEHIND when it slips past configurable thresholds (weeks behind a milestone, consecutive missed goals)
- **Action items and meetings** - assignable action items with due dates, plus meeting records per project
- **Role-based access** - two-layer RBAC: global roles (Project Manager, Project Lead, Viewer) plus per-project roles (lead, sublead, member)
- **Notifications** - rule-based engine (missing submission, project behind, action item due, goal missed) delivering in-app and email notifications (via Resend)
- **MCP server** - a built-in [Model Context Protocol](https://modelcontextprotocol.io) endpoint at `/api/mcp` so AI assistants can query the tracker, with token auth generated from the account page and OAuth support for ChatGPT connectors (via Stytch)
- **Excel export** - export project data to spreadsheets

Sign-in uses Rutgers CAS (SSO). For local development a mock CAS mode lets you log in as any user without touching the real CAS server.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Prisma v7 on Supabase Postgres, Auth.js (NextAuth v5), Playwright for end-to-end tests.

## Getting started

```bash
git clone --recurse-submodules git@github.com:ja-zoe/seed-project-tracker.git
cd seed-project-tracker
pnpm install
cp .env.example .env   # fill in database + auth values (see comments in the file)
pnpm db:seed           # seed built-in roles and settings
pnpm dev
```

With `CAS_MODE=mock` (the default) the app redirects to a local dev-login page where any NetID works. Sign in with the NetID from `PM_ADMIN_EMAIL` to land as the Project Manager.

Other useful commands:

```bash
pnpm db:studio           # browse the database with Prisma Studio
pnpm notifications:run   # run the notification engine once
pnpm exec playwright test  # run the e2e suite
```

## Development workflow

Changes are tracked as spec-driven revision sets under `changes/` (see `changes/CONTEXT.md`), using the [spec-driven-dev skill](https://github.com/ja-zoe/agent-skill-spec-driven-dev) vendored as a submodule. `CLAUDE.md` documents the architecture in depth.

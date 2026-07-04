# Turgor

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-2E4034.svg)](LICENSE)

A project tracker for project-based student teams - competition teams, design/build teams, hackathon orgs, and any club that runs real projects with deliverables and deadlines. Built for and battle-tested by [SEED (Students for Environmental & Energy Development)](https://github.com/ja-zoe/seed-website) at Rutgers.

> **Adopting this for your org?** [SETUP.md](SETUP.md) walks a first admin through the whole setup - database, sign-in (email magic links or Google/GitHub OAuth), approving your team, and rebranding - in plain language.

## What it does

- **Projects and deliverables** - projects with deliverables, subtasks, timelines, and per-semester views
- **Status tracking** - weekly status updates from project leads, with automatic red-flag detection that marks a project BEHIND when it slips past configurable thresholds (weeks behind a milestone, consecutive missed goals)
- **Action items and meetings** - assignable action items with due dates, plus meeting records per project
- **Role-based access** - two-layer RBAC: global roles (Project Manager, Project Lead, Viewer) plus per-project roles (lead, sublead, member)
- **Notifications** - rule-based engine (missing submission, project behind, action item due, goal missed) delivering in-app and email notifications (via Resend)
- **MCP server** - a built-in [Model Context Protocol](https://modelcontextprotocol.io) endpoint at `/api/mcp` so AI assistants can query the tracker, with token auth generated from the account page and OAuth support for ChatGPT connectors (via Stytch)
- **Excel export** - export project data to spreadsheets

Sign-in is email magic links, plus optional Google and GitHub OAuth. For local development a dev-only mock login lets you sign in as any email without sending anything (it 404s in production builds).

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Prisma v7 on Supabase Postgres, Auth.js (NextAuth v5), Playwright for end-to-end tests.

## Getting started

**Automated setup (recommended)** — after cloning, set up the local agent directory, then run in Claude Code:

```bash
ln -s .agents .claude    # symlink for Claude Code to find agents
/turgor-setup
```

The agent asks whether you want local development or a live production site (Supabase + Vercel), then handles environment setup, database initialization, deployment guidance, and first sign-in — you just supply credentials and click through the dashboards it points you to. Read more in [the setup skill](./.agents/skills/turgor-setup/SKILL.md).

**Deploy a live instance** (free Supabase + Vercel, ~15 min) - [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ja-zoe/turgor&env=DATABASE_URL,AUTH_SECRET,AUTH_URL,PM_ADMIN_EMAIL,ALLOWED_EMAIL_DOMAINS,RESEND_API_KEY,EMAIL_FROM&envDescription=Database%2C%20auth%2C%20and%20email%20settings%20-%20see%20the%20setup%20guide&envLink=https://github.com/ja-zoe/turgor/blob/main/SETUP.md) then follow [SETUP.md Part A](SETUP.md) to create the tables and sign in.

**Run it locally** (manual setup — see [SETUP.md](SETUP.md)):

```bash
git clone --recurse-submodules git@github.com:ja-zoe/turgor.git
cd turgor
pnpm install
docker compose up -d   # local Postgres (or use a free Supabase project — see SETUP.md)
cp .env.example .env   # fill in DATABASE_URL + AUTH_SECRET (see comments in the file)
pnpm db:migrate        # create the tables
pnpm db:seed           # seed built-in roles and settings
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). For a zero-email trial, use the mock login at `/dev-login` - enter any email (your `PM_ADMIN_EMAIL` to land as the Project Manager), no Resend key needed. It's dev-only and 404s in production. Full walkthrough in [SETUP.md Part B](SETUP.md).

Other useful commands:

```bash
pnpm db:studio             # browse the database with Prisma Studio
pnpm db:migrate:status     # show applied vs pending migrations
pnpm notifications:run     # run the notification engine once
pnpm exec playwright test  # run the e2e suite
```

## Development workflow

Changes are tracked as spec-driven revision sets under `changes/` (see `changes/CONTEXT.md`), using the [spec-driven-dev skill](https://github.com/ja-zoe/agent-skill-spec-driven-dev) vendored as a submodule. `AGENTS.md` documents the architecture in depth.

## License

[GNU AGPL v3](LICENSE). You are free to self-host, modify, and use this software at no cost. If you offer a modified version to others as a network service (for example, hosted tracker access), the AGPL requires you to publish the source of your modifications.

Copyright (C) 2026 Julian V

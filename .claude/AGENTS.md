---
name: agents
description: Always-loaded project anchor. Read this first. Contains project identity, non-negotiables, commands, and pointer to ROUTER.md for full context.
last_updated: 2026-03-31
---

# MagicSync

## What This Is
A social media scheduling platform built with Nuxt 4 monorepo — enables scheduling posts across multiple social platforms (Facebook, Twitter, Instagram, Bluesky, LinkedIn, etc.) with AI-powered content generation.

## Current Focus: Episode 5 - Advanced Tool Use

Episode 4 (Agent Skills & Sandbox) is complete with 193 Python tests passing.

Now implementing **Episode 5 - Advanced Tool Use** — enhanced tool capabilities for agents.

See `.agent/plans/candidates/09-advanced-tool-use.md` for the plan.

**Episode Roadmap:** [Claude Code Agentic RAG Series](https://github.com/theaiautomators/claude-code-agentic-rag-series)
- Ep 1: Agentic RAG Layer (complete)
- Ep 2: Knowledge Base Explorer (complete)
- Ep 3: PII Redaction (complete)
- Ep 4: Agent Skills & Sandbox (complete)
- Ep 5: Advanced Tool Use (in_progress)
- Ep 6: Agent Harness

**Database:** Using Turso (libSQL) with native vector support - no separate PostgreSQL needed

**See [PROGRESS.md](./PROGRESS.md) for current module status.**

## Non-Negotiables

- Never write database queries directly in route handlers — use the service layer in `packages/db/server/services/`
- Service methods must return `ServiceResponse<T>`, never throw exceptions
- All new Vue components must use Composition API (`<script setup>`)
- Never commit secrets or API keys — use `.env` files only
- Follow the layer package structure — pages go in layer packages, not in site

## Commands

- **Dev server:** `pnpm site:dev` — starts on port 3000
- **Build all:** `pnpm build`
- **Build site:** `pnpm site:build`
- **Database:** `cd packages/db && pnpm db:generate` / `db:migrate`
- **Lint UI:** `pnpm ui:lint`
- **Python backend:** `cd python-backend && pnpm dev` — starts FastAPI on port 8000

## Session Commands

- **Onboard:** `/onboard` — Scan codebase structure, read key files, provide project summary
- **Build from plan:** `/build link-to-plan` — Execute a saved plan with validation

## Scaffold Growth
After every task: if no pattern exists for the task type you just completed, create one. If a pattern or context file is now out of date, update it. The scaffold grows from real work, not just setup. See the GROW step in `ROUTER.md` for details.

## Navigation
At the start of every session, read `ROUTER.md` before doing anything else.
For full project context, patterns, and task guidance — everything is there.

### Must do every time (per-task verification gate)
Run these checks after every task, before presenting the result. All must pass:

1. **Cyclomatic complexity** — every new/changed function ≤ 5 branches
   (`if`/`else if`/`case`/`catch`/loops/`&&`/`||`/ternary each count 1;
   `??`/`?.` null-defaults don't count). Extract helpers instead of adding
   branches. No `complexity` eslint rule is configured repo-wide yet, so
   count manually and state the max you found.
2. **i18n** — no hardcoded user-facing strings. Pages/components carry a locale
   JSON alongside (`<i18n src="./x.json">` first line, `const { t } = useI18n()`),
   all copy via `t()` with interpolation (`{name}`, `{count}`), and every used
   key exists in the JSON. Grep template text nodes to prove nothing is left.
3. **Event handlers** — prefer named functions; never bare state assignment
   (`@click="x = 'y'"` is forbidden). Arrow wrappers only to forward
   arguments (`@click="saveUser(user.id)"`).
4. **Conventions checklist** — walk `context/conventions.md` Verify Checklist
   item by item and report each explicitly.
5. **Patterns** — check `patterns/INDEX.md` for a matching pattern and follow
   it; leave no `console.*` or dead code behind.
6. **Interaction feedback** — every user-triggered change shows feedback:
   async buttons carry `:loading`, outcomes raise toasts (failures never
   silent), conditionally rendered UI animates on enter via `@vueuse/motion`
   (see `context/conventions.md` Motion section).
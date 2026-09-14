---
name: agents
description: Always-loaded project anchor. Read this first. Contains project identity, non-negotiables, commands, and pointer to ROUTER.md for full context.
last_updated: 2026-09-13
---

# MagicSync

## What This Is
A social media scheduling platform built with Nuxt 4 monorepo — enables scheduling posts across multiple social platforms (Facebook, Twitter, Instagram, Bluesky, LinkedIn, etc.) with AI-powered content generation.

## Current Focus: Nuxt-Native Agent Layer + Content Board

All remaining work is defined in the single implementation PRD:
**`.aiContext/PRD.md`** (supersedes the Business Content Agent PRD set and the
implementation tracker; both removed 2026-09-13). Work one task at a time;
each task carries
its own verification gate. The original Python service is decommissioned (removed 2026-09-13); an optional, user-run Python tools sidecar (`packages/python-tools`) can be configured from AI settings and is never a deploy dependency;
agent execution moves to the pi SDK (`@earendil-works/pi-coding-agent`) inside
a new `packages/agent` Nuxt layer, with a per-business content board and a
single chat surface.

**Episode Roadmap (historical):** [Claude Code Agentic RAG Series](https://github.com/theaiautomators/claude-code-agentic-rag-series)
- Ep 1–5 complete; Ep 6 (Agent Harness) is re-homed into `.aiContext/PRD.md`.

**Database:** Using Turso (libSQL) with native vector support - no separate PostgreSQL needed

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
- **Agent tests:** `pnpm --filter @local-monorepo/agent test`
- **Python tools (optional sidecar):** `pnpm python-tools:dev` — starts FastAPI on port 8100; configure its URL in AI settings
- **DB service tests:** `pnpm --filter @local-monorepo/db test:services`

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
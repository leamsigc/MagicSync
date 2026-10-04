---
name: architecture
description: How the major pieces of this project connect and flow. Load when working on system design, integrations, or understanding how components interact.
triggers:
  - "architecture"
  - "system design"
  - "how does X connect to Y"
  - "integration"
  - "flow"
edges:
  - target: context/stack.md
    condition: when specific technology details are needed
  - target: context/decisions.md
    condition: when understanding why the architecture is structured this way
  - target: context/setup.md
    condition: when understanding the dev environment setup
  - target: patterns/add-endpoint.md
    condition: when adding new API endpoints
  - target: patterns/add-service.md
    condition: when adding new database services
last_updated: 2026-09-13
---

# Architecture

## System Overview

This is a Nuxt 4 monorepo with a layered architecture. The main `site` package extends 12 other packages as Nuxt layers:

Request flow: Browser → Nuxt site (hybrid SSR) → API routes in layer packages → Services in `db` package → Drizzle ORM → Turso (SQLite)

The site is composed of multiple Nuxt layers (auth, db, ui, content, scheduler, etc.) that are extended via the `extends` config in nuxt.config.ts.

`site` is the **composition root and the only route owner**: every product page
lives in `packages/site/app/pages/`, at the URL its layer used to own. Layers
contribute components, composables, utils, server routes and database schema.
Feature layers (`tools`, `scheduler`, `connect`, `templates`, `bulk-scheduler`,
`ai-tools`, `assets`) never import from one another and never own an
`app/pages/` tree; shared code is sunk into `shared`, `db` or `ui`. The only
layers that keep pages are `auth` (identity flows), `ui` (`ui-preview/`) and
`content` (the CMS `[...slug].vue` catch-all).

Layering has two shapes in Nuxt 4 and both matter:

- `#layers/Base<Name>` is the absolute, cross-package specifier.
- `~` / `@` are **per-layer** (`LayerAliasingPlugin` resolves them against the
  importing layer's own `srcDir`, i.e. `<pkg>/app`). The same `~/assets/x` means
  something different in two layers.

## Key Components

- **@local-monorepo/site** — Main Nuxt 4 application, combines all layers, handles SSR and client-side navigation
- **@local-monorepo/db** — Database layer with Drizzle ORM, contains schema.ts, services, and migrations. Exposes `#layers/BaseDB` alias
- **@local-monorepo/auth** — Authentication layer using Better Auth, provides auth endpoints and composables (`useUser`)
- **@local-monorepo/ui** — UI component library with shadcn-vue, Nuxt UI, Tailwind CSS, and VueUse
- **@local-monorepo/scheduler** — Post scheduling layer with cron jobs for publishing
- **@local-monorepo/connect** — Social media platform connections (Facebook, Twitter, Instagram, Bluesky, etc.)
- **@local-monorepo/bulk-scheduler** — Bulk post generation and scheduling features
- **@local-monorepo/ai-tools** — AI-powered content generation; LLM config/test routes now run on the pi ModelRuntime in `@local-monorepo/agent`
- **@local-monorepo/agent** — The only Agent Layer: hosts the Flue runtime (`@flue/runtime`) with `MagicSyncAgent` + four specialist subagents, the capability registry (`runCapability`), the single Flue skill set, per-agent Valibot tool mounts, chat SSE, the content board, workflows, RAG, and yt-dlp. Flue is the sole orchestration runtime; pi remains only as the transport Flue builds on and for bounded completions inside skills.
- **@local-monorepo/content** — Nuxt Content for blog/documentation pages

## Flue Migration Ownership Contract

The Flue migration keeps `packages/agent` as the only Agent Layer. Application
packages own authentication, authorization, businesses/brands, billing,
database access, repositories, domain models, external credentials, social
connections, jobs, queues, rate limits, persistence, audit logs, and external
mutations. The Agent Layer owns goal understanding, planning, agent behaviour,
skills, subagents, tool orchestration, context selection, agent state, AI
workflows, verification, recovery, and approval logic.

Application entry points authenticate, authorize, resolve tenant context, and
validate input before calling the Agent Layer. They do not build prompts, select
skills, run orchestration loops, or call models directly. Agent tools receive
server-resolved tenant identity and call existing application services; they do
not recreate domain or persistence logic.

Flue is the sole orchestration runtime (migration T01–T24 complete). The
deterministic goal-routing table remains only as bounded pre-routing logic; it
is not a second orchestrator. Business context has one source
(`agentic/context-selector.ts`), and no PII subsystem exists — the
`AGENT_AI_LOG` content policy governs sensitive payloads.

### Capability layer (one entry, one registry)

```text
HTTP route · MCP tool · Nitro job · board action · pipeline node
   ↓ auth → validate → tenant resolve
runCapability(id, input, ctx)          ← the only entry
   ↓ capability registry (14 declared capabilities)
Flue agent + per-agent tool mounts + skills (progressive)
   ↓
existing services (db · scheduler · publishing · RAG · analytics · assets)
```

Routes are adapters: parse, authorize, `runCapability`, shape the response.
They contain no prompt, no loop, no skill selection, and no model call. Every
model call emits one evlog `ai.call` event (`metadata` default | `redacted` |
`payload`). Consequential capabilities require an explicit approval
transition on the existing `agent_goal_runs` row. Full report: PRD §19.

## Agent Platform Flow

1. **Chat** — `POST /api/v1/agent/chat` authenticates, checks business access,
   resolves the current Brand Playbook edition, then streams pi events over SSE
   (`message.started → tool.* → text.delta* → message.completed`). The runner
   builds a pi session from durable entries in `agent_chat_entries`, injects
   server-owned tools, enforces `AGENT_*` limits, and records `agent_runs`.
2. **Tools** — `packages/agent/server/agent/tools/*` are `defineTool` +
   typebox definitions that only receive server-resolved context; tenant IDs in
   model arguments are ignored. ScrapeGraphAI is the default scraper; an
   optional Python tools sidecar can be proxied when configured.
3. **Board** — cards live in `content_items` and move through the state machine
   in `contentBoardService`; every move appends `content_item_events`. Agents
   stop at `review_required`; humans approve through the artifact service.
4. **Chain** — `content_chain` runs research → write → humanize → checks and
   submits an artifact, then parks the card in review. Checks write
   `content_checks`; runs write `content_runs`.
5. **Delivery** — scheduling/publishing require an approved artifact;
   publishing always goes through `publishingService` jobs.

## External Dependencies

- **Turso (libSQL)** — Primary database, accessed via Drizzle ORM from the db layer
- **Social Media APIs** — Facebook, Twitter/X, Instagram, Bluesky, LinkedIn, TikTok, YouTube, Threads, Reddit, Dribbble, WordPress via OAuth
- **OpenAI API** — AI content generation
- **Google Generative AI** — Additional AI capabilities
- **Pexels API** — Stock image search
- **Mailgun** — Transactional email
- **Umami** — Analytics tracking

## What Does NOT Exist Here

- No separate backend API server — all APIs are in Nuxt server routes within layer packages; the old FastAPI `packages/python-backend` was deleted and agent execution runs in-process via the pi SDK (`@local-monorepo/agent`)
- Optional user-configured tool backends — ScrapeGraphAI (`scrapegraph-js`, default scraper) and a `packages/python-tools` FastAPI sidecar the operator runs themselves; configured in Account → AI settings, secrets encrypted at rest
- No Redis — sessions handled by Better Auth with database storage
- No build pipeline beyond pnpm/turbo monorepo tooling
- No separate worker processes — scheduler runs as part of the Nuxt server


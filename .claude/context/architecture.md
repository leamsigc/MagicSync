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

The site is composed of multiple Nuxt layers (auth, db, ui, content, scheduler, etc.) that are extended via the `extends` config in nuxt.config.ts. Each layer can contribute pages, components, composables, server routes, and database schema.

## Key Components

- **@local-monorepo/site** — Main Nuxt 4 application, combines all layers, handles SSR and client-side navigation
- **@local-monorepo/db** — Database layer with Drizzle ORM, contains schema.ts, services, and migrations. Exposes `#layers/BaseDB` alias
- **@local-monorepo/auth** — Authentication layer using Better Auth, provides auth endpoints and composables (`useUser`)
- **@local-monorepo/ui** — UI component library with shadcn-vue, Nuxt UI, Tailwind CSS, and VueUse
- **@local-monorepo/scheduler** — Post scheduling layer with cron jobs for publishing
- **@local-monorepo/connect** — Social media platform connections (Facebook, Twitter, Instagram, Bluesky, etc.)
- **@local-monorepo/bulk-scheduler** — Bulk post generation and scheduling features
- **@local-monorepo/ai-tools** — AI-powered content generation; LLM config/test routes now run on the pi ModelRuntime in `@local-monorepo/agent`
- **@local-monorepo/agent** — Nuxt-native agent layer: pi SDK sessions, chat SSE contract, tool registry, content board, workflows, RAG, PII private mode, yt-dlp (no Python)
- **@local-monorepo/content** — Nuxt Content for blog/documentation pages

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


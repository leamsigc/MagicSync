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
last_updated: 2026-03-30
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
- **@local-monorepo/ai-tools** — AI-powered content generation using OpenAI/Google Generative AI
- **@local-monorepo/content** — Nuxt Content for blog/documentation pages

## External Dependencies

- **Turso (libSQL)** — Primary database, accessed via Drizzle ORM from the db layer
- **Social Media APIs** — Facebook, Twitter/X, Instagram, Bluesky, LinkedIn, TikTok, YouTube, Threads, Reddit, Dribbble, WordPress via OAuth
- **OpenAI API** — AI content generation
- **Google Generative AI** — Additional AI capabilities
- **Pexels API** — Stock image search
- **Mailgun** — Transactional email
- **Umami** — Analytics tracking

## What Does NOT Exist Here

- No separate backend API server — all APIs are in Nuxt server routes within layer packages
- No Redis — sessions handled by Better Auth with database storage
- No build pipeline beyond pnpm/turbo monorepo tooling
- No separate worker processes — scheduler runs as part of the Nuxt server


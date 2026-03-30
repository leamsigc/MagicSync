---
name: stack
description: Technology stack, library choices, and the reasoning behind them. Load when working with specific technologies or making decisions about libraries and tools.
triggers:
  - "library"
  - "package"
  - "dependency"
  - "which tool"
  - "technology"
edges:
  - target: context/decisions.md
    condition: when the reasoning behind a tech choice is needed
  - target: context/conventions.md
    condition: when understanding how to use a technology in this codebase
  - target: context/setup.md
    condition: when setting up the development environment
  - target: patterns/add-service.md
    condition: when working with Drizzle ORM
last_updated: 2026-03-30
---

# Stack

## Core Technologies

- **Nuxt 4** (future compatibility version 5) — Full-stack Vue framework with SSR, auto-imports, and file-based routing
- **Vue 3** — Composition API only, avoid Options API
- **TypeScript** — All code in TypeScript, strict mode
- **pnpm** — Package manager with workspace support for monorepo

## Key Libraries

- **Drizzle ORM** — Database access layer, preferred over raw SQL. Use Query API (`db.query.table.findMany`) for reads
- **Better Auth** — Authentication framework (not yet fully integrated but available)
- **Nuxt UI v4** — 125+ accessible Vue components with Tailwind CSS theming
- **VueUse** — Composables for common utilities (useFetch, useStorage, etc.)
- **Tailwind CSS** — Utility-first CSS framework
- **Echarts** — Charts and data visualization
- **Embla Carousel** — Carousel/slider component
- **Zod** — Data validation for API endpoints
- **dayjs** — Date/time manipulation
- **Nuxt Content** — Markdown-based documentation/blog system

## What We Deliberately Do NOT Use

- No Options API — must use Composition API with `<script setup>`
- No class components — functional components only
- No enums — use `const` objects instead
- No Redux/Pinia for global state — prefer VueUse composables and local state
- No raw SQL in route handlers — all database access through service layer

## Version Constraints

- Nuxt 4 with `future.compatibilityVersion: 5` — targeting Nuxt 5 API
- Drizzle ORM v1.x via catalog
- Vue 3.4+ via catalog
- Node.js 20+ required for native fetch and other modern APIs

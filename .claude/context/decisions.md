---
name: decisions
description: Key architectural and technical decisions with reasoning. Load when making design choices or understanding why something is built a certain way.
triggers:
  - "why do we"
  - "why is it"
  - "decision"
  - "alternative"
  - "we chose"
edges:
  - target: context/architecture.md
    condition: when a decision relates to system structure
  - target: context/stack.md
    condition: when a decision relates to technology choice
  - target: context/conventions.md
    condition: when understanding coding patterns
  - target: context/setup.md
    condition: when setting up environment
last_updated: 2026-03-30
---

# Decisions

## Decision Log

### Use Nuxt Layers for Package Architecture
**Date:** 2024-09-15
**Status:** Active
**Decision:** All feature packages are Nuxt layers that the main site extends.
**Reasoning:** Nuxt layers allow sharing pages, components, composables, server routes, and database schema across packages while maintaining separation. This enables independent development of features while composing them into a single application.
**Alternatives considered:** Independent microservices (rejected — too complex for this scale), npm packages (rejected — no auto-import of components/composables)
**Consequences:** All packages must follow Nuxt layer directory structure

### Use Turso (libSQL) for Database
**Date:** 2024-09-20
**Status:** Active
**Decision:** Use Turso with libSQL as the primary database.
**Reasoning:** Turso provides edge-ready SQLite with replication capabilities. Drizzle ORM has first-class libSQL support. Good fit for social media scheduling use case with moderate write load.
**Alternatives considered:** PostgreSQL (rejected — overkill for current scale), MongoDB (rejected — relational data fits better in SQL)
**Consequences:** Database migrations must be run explicitly with `drizzle-kit`

### Use Drizzle ORM Query API
**Date:** 2024-09-20
**Status:** Active
**Decision:** Prefer Drizzle Query API (`db.query.table.findMany`) over raw `db.select()`.
**Reasoning:** Query API provides better type safety and cleaner syntax for common queries. Use `db.select()` only for complex aggregations.
**Alternatives considered:** Raw SQL (rejected — no type safety), query builder only (rejected — Query API is cleaner)
**Consequences:** All new queries should use Query API pattern

### Composition API Only
**Date:** 2024-09-15
**Status:** Active
**Decision:** Use Vue Composition API exclusively, avoid Options API.
**Reasoning:** Better TypeScript inference, more flexible code reuse via composables, aligns with Nuxt 3/4 best practices.
**Alternatives considered:** Options API (rejected — less flexible, poorer TypeScript support)
**Consequences:** All Vue components must use `<script setup>` syntax

### Service Layer Pattern for Business Logic
**Date:** 2024-09-25
**Status:** Active
**Decision:** All business logic lives in service classes in the db package, accessed via API routes.
**Reasoning:** Separation of concerns — route handlers are thin wrappers around services. Services return typed `ServiceResponse<T>` objects for error handling without throwing exceptions.
**Alternatives considered:** Fat route handlers (rejected — hard to test, duplicate logic), domain-driven modules (rejected — over-engineering for this project size)
**Consequences:** Route handlers must not contain business logic, only validation and service calls

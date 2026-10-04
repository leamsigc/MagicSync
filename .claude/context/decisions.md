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

### In-process pi SDK Agent Runtime (Python removed)
**Date:** 2026-09-13
**Status:** Active
**Decision:** Agent execution runs in `packages/agent` via `@earendil-works/pi-coding-agent` in the Nuxt process; the FastAPI `packages/python-backend` service was deleted.
**Reasoning:** One deployable runtime, one auth/tenant boundary, typed tools with server-injected context, and durable pi sessions in Turso. The pi SDK's in-memory session/settings managers plus a server-owned temp `cwd` keep tenants isolated.
**Alternatives considered:** Keeping a separate Python agent service (rejected — duplicate infra, JWT bridging), child-process harness (rejected — no durable session store)
**Consequences:** Model routing goes through pi `ModelRuntime`; tools are `defineTool` + `typebox`; limits come from `AGENT_*` env vars; the optional Python sidecar below is the only remaining Python.

### Turso-native RAG (no separate vector database)
**Date:** 2026-09-13
**Status:** Active
**Decision:** Document chunks store float32 embeddings as blobs and search uses `vector_distance_cos` in libSQL.
**Reasoning:** Turso already backs the app; a vector extension removes a second datastore and keeps tenancy scoping in SQL.
**Consequences:** Embeddings are provider-specific (OpenAI/Google via AI SDK); retrieve tools are scoped by user; PDF/DOCX parsing uses `unpdf`/`mammoth`.

### Custom PII Private Mode Removed
**Date:** 2026-09-18
**Status:** Retired
**Decision:** The custom ONNX/regex anonymization subsystem, private-mode toggle, surrogate mappings, and `pii_scan` agent surface are removed. Flue is the sole agent integration; application-owned publication validation remains separate.
**Reasoning:** The Flue migration explicitly removes the duplicate in-process PII boundary and governs sensitive AI-call capture through the capability log content policy.
**Consequences:** The `pii_mappings` table and `agent_chat_sessions.private_mode` column are removed by migration `0013_past_typhoid_mary`.

### External Tool Backends Are User-Configurable and Optional
**Date:** 2026-09-13
**Status:** Active
**Decision:** ScrapeGraphAI (Node SDK) is the default scraper; users can also point MagicSync at their own Python tools service. Both live in **Account → AI settings → Tool backends**, stored in an `entity_details` KV row with AES-256-GCM encrypted secrets.
**Reasoning:** Scraping keys and Python-only tooling are user/operator concerns, not platform dependencies. The Node SDK avoids a mandatory service hop; the sidecar stays available for Python-only libraries (ScrapeGraphAI Python, etc.).
**Alternatives considered:** Hard-wiring a Python scraping service (rejected — extra deploy dependency), bundling the Python ScrapeGraphAI library into the Nuxt image (rejected — heavy LLM stack)
**Consequences:** `scrape_url` falls back to raw fetch with a warning when ScrapeGraphAI is unconfigured or fails; `python_tools_*` return typed `PYTHON_BACKEND_*` errors when the sidecar is absent. Secrets never leave the server; routes expose presence booleans only.

### Human Approval Gates Before External Side Effects
**Date:** 2026-09-13
**Status:** Active
**Decision:** Scheduling, publishing, and materialization require an approved artifact version; agents can only move cards up to `review_required`.
**Reasoning:** Agents generate drafts; humans own external side effects. The board service and delivery tools both enforce the gate.
**Consequences:** `review_required → approved` requires a human review decision; `scheduled`/`published` require an approved artifact (and publishing jobs go through `publishingService`).

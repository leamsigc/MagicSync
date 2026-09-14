---
category: Contributing
---

# Architecture

<FunctionInfo fn="architecture"/>

This guide provides an overview of the MagicSync architecture to help you understand how the application works.

## Overview

MagicSync is a **Nuxt 4 layer monorepo**. One Nuxt application (`packages/site`) extends feature layers; every API route, service, database schema, and page lives in the layer that owns it. There is no separate backend for application logic — the agent platform, RAG, and media tooling all run in the Nuxt server process.

- **Frontend**: Nuxt 4, Vue 3 (Composition API), Nuxt UI v4
- **Backend**: Nuxt server routes + service layer
- **Database**: Turso (libSQL) via Drizzle ORM, including native vector search
- **Agent runtime**: [pi SDK](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) in-process (`packages/agent`)
- **Optional sidecar**: FastAPI Python tools service (`packages/python-tools`), user-run and user-configured

## Monorepo Structure

```
magicsync/
├── packages/
│   ├── site/            # Main application (layer merge point)
│   ├── db/              # Drizzle schema, migrations, services (business logic)
│   ├── agent/           # Agent runtime: pi sessions, tools, workflows, RAG, PII, video
│   ├── auth/            # Better Auth, account pages, AI settings UI
│   ├── ui/              # Base UI components (@nuxt/ui wrappers, motion directives)
│   ├── connect/         # Social platform connections + content board UI
│   ├── scheduler/       # Post scheduling, calendar, machine routes
│   ├── ai-tools/        # Chat UI, LLM config routes, tool-backend settings
│   ├── assets/          # Media upload & management
│   ├── templates/       # Content templates
│   ├── bulk-scheduler/  # Bulk creation and CSV import
│   ├── email/           # MJML email templates & service
│   ├── content/         # Marketing site and blog
│   ├── tools/           # In-browser tools (image editor, etc.)
│   ├── shared/          # Shared types, errors, service contracts
│   ├── doc/             # This documentation site (VitePress)
│   └── python-tools/    # Optional Python tools sidecar (FastAPI)
└── scripts/             # Asset installers (TTS, PII model, yt-dlp)
```

Layers are wired through `extends` in `packages/site/nuxt.config.ts`. Shared types and helpers go to `packages/shared`; all database access goes through services in `packages/db/server/services/` (and the agent layer's own services) and returns `ServiceResponse<T>`.

## Request Flow

```text
Browser → Nuxt pages/components
        → Nuxt server routes (auth middleware, zod validation, business access)
        → Service layer (db services / agent services)
        → Drizzle ORM → Turso (libSQL)
```

Machine-to-machine flows (GitHub Actions, internal analytics) use HMAC-signed routes validated with `MACHINE_BRIDGE_SECRET`.

## Agent Platform

The agent layer runs pi sessions in-process. Key pieces:

| Piece | Location | Responsibility |
|---|---|---|
| Runner | `packages/agent/server/services/agent-runner.service.ts` | Builds sessions, normalizes pi events to the SSE contract, enforces limits, persists entries and `agent_runs` |
| Sessions | `agent-session.service.ts` | Durable pi entries in `agent_chat_entries` with monotonic `seq`; owner-scoped |
| Workflows | `agent-workflow.service.ts` | `trend_scan`, `content_chain`, board batch |
| Chain | `content-chain.service.ts` | research → write → humanize → SEO/GEO/link checks → review artifact |
| Tools | `packages/agent/server/agent/tools/*` | Typed `defineTool` + `typebox` definitions receiving server-resolved tenant context |
| Model runtime | `packages/agent/server/utils/pi-runtime.ts` | `ModelRuntime` with in-memory credentials/models, per-run API key and base URL injection |
| Prompts | `run-config.ts` | Resolves the effective model plus the current Brand Playbook edition |

```text
POST /api/v1/agent/chat
  → authenticate + requireBusinessAccess
  → businessContextResolver (current playbook edition; loud failure)
  → agentRunnerService.run()
      → pi createAgentSession (noTools + server customTools)
      → subscribe: tool/message events → SSE (stable ids)
      → append entries to agent_chat_entries, finish agent_runs
```

Tools never trust model arguments for identity: `{ userId, businessId }` come from the authenticated request and are injected into every tool closure. Built-in shell/file tools are excluded.

### Content Board

Cards live in `content_items` and move through the state machine enforced by `contentBoardService`. Moves append `content_item_events`. Agents may advance cards up to `review_required`; only human review can approve, and scheduling/publishing require an approved artifact. See [Content Board](/guide/content-board).

### RAG and PII

- `document-ingest.service.ts` chunks, hashes, embeds, and stores chunks; search uses `vector_distance_cos` scoped to the user.
- `pii.ts` performs regex + ONNX NER anonymization with a streaming surrogate restorer; private mode fails closed without the model.

## Data Model Highlights

| Table | Purpose |
|---|---|
| `content_items` / `content_item_events` | Board cards + append-only audit |
| `content_checks` / `content_runs` | Check findings and chain step executions |
| `content_artifacts` / `approval_records` | Draft versions and human review decisions |
| `agent_chat_sessions` / `agent_chat_entries` | pi session ↔ chat thread link and durable entries |
| `agent_runs` | Run telemetry (status, tokens, tool events, duration) |
| `pii_mappings` | Per-thread surrogate maps for private mode |
| `documents` / `document_chunks` | RAG corpus with float32 embeddings |
| `entity_details` | KV rows (business LLM overrides, user tool-backend settings) |

Schema is defined in `packages/db/db/**` and exported from `packages/db/db/schema.ts`; migrations are generated with `pnpm --filter @local-monorepo/db db:generate`.

## Authentication and Tenancy

- Better Auth manages sessions; routes call `checkUserIsLogin`.
- Business access is verified with `requireBusinessAccess` (owner or member), which also returns the owner id used for shared rows.
- Secrets (LLM keys, publishing tokens, tool-backend keys) are encrypted at rest with AES-256-GCM envelopes and decrypted only into memory.

## Deployment

A single Nuxt runtime plus Turso. Optional extras:

- **Pinned media binaries** — `yt-dlp` + `ffmpeg` are baked into the Docker image.
- **PII model** — downloaded at image build time by `scripts/pii_assets.sh`.
- **Python tools sidecar** — only if you need Python-only tools; run `packages/python-tools` and point AI settings at its URL.

See [Self-Hosting](/guide/self-hosting) and [Coolify Deploy](/guide/coolify-deploy).

## Testing

- `pnpm --filter @local-monorepo/db test:services` — services and schemas on a migrated file SQLite database
- `pnpm --filter @local-monorepo/agent test` — runner, tools, workflows, RAG, PII, and media with a hermetic SSE stub provider (no network or API keys)
- `pnpm dlx vite-doctor .` — structural diagnostics; new code must not add findings

## Performance Considerations

- Migrations, indexes, and vector search run in Turso/libSQL — no second datastore.
- Agent runs are bounded by `AGENT_*` limits; sessions are resumed from stored entries instead of replaying full histories.
- Nitro bundles server routes per layer; heavy optional code (embeddings, ONNX, yt-dlp) is loaded lazily.

## Security

- Tenant identity is always server-resolved; tool arguments cannot select a business or user.
- Human approval gates guard every external side effect (schedule/publish/materialize).
- PII private mode is fail-closed; secrets never appear in prompts or logs.
- External scraping is SSRF-checked; machine routes use HMAC.

## Next Steps

- [Development Setup](/contributing/development-setup)
- [Adding Features](/contributing/adding-features)
- [Agent Platform guide](/guide/agent-platform)

---

## Source
<SourceLinks fn="architecture"/>

## Contributors
<Contributors fn="architecture"/>

## Changelog
<Changelog fn="architecture"/>

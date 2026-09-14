---
name: setup
description: Dev environment setup and commands. Load when setting up the project for the first time or when environment issues arise.
triggers:
  - "setup"
  - "install"
  - "environment"
  - "getting started"
  - "how do I run"
  - "local development"
edges:
  - target: context/stack.md
    condition: when specific technology versions or library details are needed
  - target: context/architecture.md
    condition: when understanding how components connect during setup
  - target: context/conventions.md
    condition: when verifying code patterns after setup
  - target: patterns/tool-backend-settings.md
    condition: when configuring ScrapeGraphAI or the Python tools sidecar
last_updated: 2026-09-13
---

# Setup

## Prerequisites

- **Node.js 22.19+** — Required by the pi SDK (`@earendil-works/pi-coding-agent`); the repo runs Node 26
- **pnpm** — Package manager (install with `npm install -g pnpm`)
- **Turso CLI** — For local database development (optional, can use cloud)
- **Docker** — For running local infrastructure (optional)
- **Python 3.11+** — Only for the optional `packages/python-tools` sidecar
- **yt-dlp + ffmpeg** — Only for video ingestion outside Docker (`scripts/install-ytdlp.sh`)

## First-time Setup

1. `pnpm install` — Install all dependencies across all packages
2. Copy `.env.example` to `.env` and fill in required values:
   - `NUXT_TURSO_DATABASE_URL` — Turso database URL
   - `NUXT_SESSION_PASSWORD` — Min 32 characters
   - `NUXT_BETTER_AUTH_SECRET` — Auth secret
   - Social media OAuth credentials (optional, for testing specific platforms)
3. `pnpm --filter @local-monorepo/db db:generate` — Generate Drizzle migrations
4. `pnpm --filter @local-monorepo/db db:migrate` — Run migrations
5. `pnpm site:dev` — Start development server

Optional, feature-specific setup:

6. `bash ./scripts/pii_assets.sh` — ONNX NER model for PII private mode (only needed to enable it)
7. `bash ./scripts/install-ytdlp.sh` — pinned yt-dlp binary for local video ingestion
8. `pnpm python-tools:dev` — Python tools sidecar on port 8100, then configure its URL in **Account → AI settings → Tool backends**

## Environment Variables

Required for basic operation:
- `NUXT_APP_URL` — Application URL (e.g., http://localhost:3000)
- `NUXT_TURSO_DATABASE_URL` — Turso database connection string
- `NUXT_SESSION_PASSWORD` — Min 32 chars, used for session encryption

Required for authentication:
- `NUXT_BETTER_AUTH_SECRET` — Secret for Better Auth
- `MACHINE_BRIDGE_SECRET` — HMAC secret for machine routes (GH Actions, internal analytics). Was `DSH_BRIDGE_SECRET` before T14

Required for specific features:
- `NUXT_OPENAI_API_KEY` / `NUXT_GOOGLE_GENERATIVE_AI_API_KEY` — Server-side provider keys (users can also bring their own per business)
- `NUXT_MAILGUN_API_KEY` + `MAILGUN_DOMAIN` — For email
- Social media OAuth credentials — Facebook, Twitter, Instagram, etc. (see `packages/site/nuxt.config.ts`)
- `SGAI_API_KEY` — Deployment-wide ScrapeGraphAI fallback when a user has not saved a key
- `PYTHON_TOOLS_URL` / `PYTHON_TOOLS_TOKEN` — Deployment-wide Python tools fallback (user settings win)
- `NUXT_PUBLISH_SECRET` — AES-256-GCM key for credential envelopes (LLM keys, publishing tokens, tool-backend secrets); the legacy `NUXT_LLM_JWT_SECRET` fallback only decrypts pre-T14 rows
- `PII_MODEL_PATH` — Override the ONNX NER asset directory (`/usr/app/.output/public/pii` in Docker)
- `PII_ALLOW_REGEX_ONLY=1` — Explicit, non-default escape hatch that allows private mode without the ONNX model
- `YTDLP_PATH` — Path to the pinned yt-dlp binary (`/usr/local/bin/yt-dlp` in Docker)

Agent limits (all optional, safe defaults):
- `AGENT_MAX_TURNS` (12), `AGENT_MAX_TOOL_CALLS` (40), `AGENT_TOKEN_BUDGET` (200000)
- `AGENT_TOOL_TIMEOUT_MS` (60000), `AGENT_MAX_CONCURRENCY` (3)
- `AGENT_DEFAULT_PROVIDER` / `AGENT_DEFAULT_MODEL` — fallback model when a user has no effective config
- `AGENT_MODELS_PATH` — deployment `models.json` override; `PI_OFFLINE=1` disables provider catalog network access

## Common Commands

- `pnpm site:dev` — Start dev server on port 3000
- `pnpm site:build` — Build for production (also validates new routes/pages)
- `pnpm site:preview` — Preview production build
- `pnpm build` — Build all packages
- `pnpm --filter @local-monorepo/db test:services` — DB service + schema tests (file SQLite, migrations applied)
- `pnpm --filter @local-monorepo/agent test` — Agent tests (stub provider + SSE stub, no network/API keys)
- `cd packages/db && pnpm db:generate` — Generate Drizzle migrations
- `cd packages/db && pnpm db:migrate` — Run migrations
- `cd packages/db && pnpm db:studio` — Open Drizzle Studio
- `pnpm python-tools:dev` — Python tools sidecar (port 8100)
- `pnpm dlx vite-doctor .` — Diagnostics; new code must not add findings

## Common Issues

**Port already in use:** `lsof -i :3000` to find the process, `kill -9 [PID]`

**Migration fails:** Check `NUXT_TURSO_DATABASE_URL` is correct and the database is accessible

**Missing layer packages:** Ensure all packages in `extends` array are built. Run `pnpm build` first.

**Hot reload not working:** Some packages may need `nuxi prepare`. Try running `pnpm --filter @local-monorepo/ui dev` first to build individual packages.

**Agent tools say `MODEL_NOT_CONFIGURED`:** Set a provider/model in Account → AI settings (global) or per-business override, or set `AGENT_DEFAULT_PROVIDER`/`AGENT_DEFAULT_MODEL`.

**`PII_MODEL_MISSING`:** Private mode is fail-closed. Run `bash ./scripts/pii_assets.sh` (or set `PII_MODEL_PATH`), or opt into `PII_ALLOW_REGEX_ONLY=1` for regex-only anonymization.

**`SCRAPEGRAPH_NOT_CONFIGURED`:** Add a ScrapeGraphAI key in AI settings → Tool backends, or set `SGAI_API_KEY`; `scrape_url` otherwise falls back to raw fetch.

**`PYTHON_BACKEND_*` errors / unreachable:** Start `pnpm python-tools:dev`, point AI settings → Tool backends at its URL, and use the Test button (`/health` probe).

**Team/legacy saves fail silently:** Tool-backend saves encrypt with `NUXT_PUBLISH_SECRET`; without it `save()` returns `{ success: false }`.

**Playwright dev-server timeout:** The first `nuxt dev` compile can exceed the 120s `webServer` timeout; run a dev server once before e2e, or scope specs to CI.

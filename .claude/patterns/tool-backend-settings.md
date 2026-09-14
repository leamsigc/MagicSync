---
name: tool-backend-settings
description: User-configurable external tool backends (ScrapeGraphAI API key, Python tools service URL) with encrypted secrets, test-connection routes, and agent proxy tools
triggers:
  - "tool backend"
  - "scrapegraph"
  - "python tools"
  - "integration settings"
  - "AI tab settings"
edges:
  - target: patterns/entitydetails-kv.md
    condition: when deciding how to persist settings without a migration
  - target: patterns/pi-agent-layer.md
    condition: when adding a tool that calls the backend from the agent
last_updated: 2026-09-13
---

# External Tool Backends (ScrapeGraphAI + Python tools service)

## Context

Users configure two optional backends from **Account → AI settings (global
mode)**: a ScrapeGraphAI API key (default scraper via `scrapegraph-js`) and a
Python tools service URL + bearer token. Agent tools resolve them per user;
nothing is required for the app to run.

## Steps

1. **Storage (no migration):** one `entity_details` row per user with
   `entity_type = 'user_tool_backends'` and a JSON `details` payload.
   Secrets go through `publish-crypto` (`encryptSecret` / `revealSecret`):
   `undefined` keeps the stored value, `''` clears it, text encrypts.
   URL fields validate `http(s)` only.
   Service: `packages/db/server/services/tool-backends.service.ts`.
2. **Agent wrappers:** `server/utils/scrapegraph.ts` (lazy `import('scrapegraph-js')`,
   `ScrapeGraphAI({ apiKey })`, env fallback `SGAI_API_KEY`) and
   `server/utils/python-tools.ts` (`/health`, `/tools`,
   `/tools/{name}/run` with bearer + 60s timeout).
3. **Tools:** `scrapegraph_*`, `python_tools_list`/`python_tool_run` in
   `packages/agent/server/agent/tools/`. `scrape_url` uses ScrapeGraphAI as the
   default scraper and falls back to raw fetch with an explicit `warning`.
   Tool context seams for tests: `scrapegraph` (fake client) and `validateUrl`.
4. **Routes (ai-tools):** `GET/POST /api/v1/integrations/tools` (masked state,
   never secrets) and `POST /api/v1/integrations/tools/test` (discriminated
   `kind: scrapegraph | python`).
5. **UI:** `AiModelSettings.vue` shows the card only in `mode === 'global'`
   with password inputs, `:loading` test buttons, latency badges, toasts, and
   `data-testid` hooks; locale keys live in `AiModelSettings.json`.
6. **Python sidecar:** `packages/python-tools/` (FastAPI) exposes
   `fetch_text`, `scrapegraph_smartscraper`, `scrapegraph_searchscraper`.
   Optional deps are separate (`requirements-scrapegraph.txt`); missing deps
   return HTTP 501 instead of crashing. Run with `pnpm python-tools:dev`.

## Gotchas

- `scrapegraph-js` is ESM-only and reads `SGAI_API_URL` at import time — set it
  before importing when stubbing the API in tests.
- The SDK never throws: check `result.status === 'success'` and map
  `result.error` to a typed tool error.
- Encryption needs `NUXT_PUBLISH_SECRET`; test setups must default it or saves
  fail silently into `{ success: false }`.
- Never send decrypted secrets to the client — routes return presence booleans.
- Tool args for `python_tool_run` are passed as `{ args }`; the backend
  response is returned verbatim (keep the contract stable).

## Verify

- [ ] `pnpm --filter @local-monorepo/db test:services` green (tool-backends suite)
- [ ] `pnpm --filter @local-monorepo/agent test` green (scrapegraph + python proxy suites)
- [ ] `rg` new code: no plaintext secrets in responses, no `console.*`
- [ ] `python3 -m py_compile packages/python-tools/app/*.py`
- [ ] Locale keys exist in all four `AiModelSettings.json` locales
- [ ] `pnpm site:build` completes

## Debug

- Save returns `success: false` → check `NUXT_PUBLISH_SECRET` and the URL
  protocol (only `http`/`https`).
- Tools return `SCRAPEGRAPH_NOT_CONFIGURED` → no key in settings and no
  `SGAI_API_KEY` env.
- Tools return `PYTHON_BACKEND_UNREACHABLE` → wrong URL/port or the service is
  not running; `/health` is the first probe.

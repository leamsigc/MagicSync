---
name: pi-agent-layer
description: Scaffolding a Nuxt layer package and integrating the pi SDK (@earendil-works/pi-coding-agent) in-process with a hermetic test seam
triggers:
  - "add layer package"
  - "new nuxt layer"
  - "packages/agent"
  - "pi sdk"
  - "createAgentSession"
  - "ModelRuntime"
  - "agent spike"
edges:
  - target: context/architecture.md
    condition: when placing the layer in the extends chain
  - target: context/conventions.md
    condition: when checking naming and service rules
last_updated: 2026-09-13
---

# pi Agent Layer / New Nuxt Layer Package

## Context

`packages/agent` (`@local-monorepo/agent`, `$meta.name: BaseAgent`) is the
Nuxt layer that runs pi SDK agent sessions in-process. The Python service is
deleted (T14); no child processes, no HTTP to a Python backend. Models come
from a deployment `server/agent/models.json` template plus per-run runtime
API keys; credentials and model catalogs stay in memory.

## Steps

### New layer package scaffold

1. `packages/<name>/package.json` — copy the shape from `packages/db`:
   `"main": "./nuxt.config.ts"`, scripts `dev/dev:prepare/build/generate/
   preview/lint`, deps `@local-monorepo/shared`, devDeps `@nuxt/eslint`,
   `eslint`, `nuxt`, `typescript`, `vue`.
2. `nuxt.config.ts` — copy `packages/db/nuxt.config.ts`; set
   `$meta.name: 'Base<Name>'` (drives the `#layers/Base<Name>/` alias) and
   `extends: ['@local-monorepo/shared']`.
3. `tsconfig.json` — `{ "extends": "../site/.nuxt/tsconfig.json" }`.
4. `eslint.config.js` — `import withNuxt from './.playground/.nuxt/eslint.config.mjs'; export default withNuxt()`.
5. Create the two tracked playground files (everything else in `.playground`
   is gitignored): `.playground/nuxt.config.ts` (extends `..`, `@nuxt/eslint`
   module) and `.playground/app.config.ts`.
6. In `pnpm-workspace.yaml` catalog, pin new third-party deps; in
   `packages/site/package.json` add `"@local-monorepo/<name>":
   "workspace:*"`; in `packages/site/nuxt.config.ts` append
   `'@local-monorepo/<name>'` to `extends`.
7. `pnpm install`. If pnpm aborts with `ERR_PNPM_IGNORED_BUILDS`, set the
   named package to `false` under `allowBuilds:` (pnpm writes a placeholder
   line for you) and re-run.

### pi runtime

1. `server/agent/models.json` — only custom/overridden providers
   (openai/anthropic/google are built into pi). OpenAI-compatible entry:
   `{ baseUrl, api: "openai-completions", apiKey, compat: { supportsDeveloperRole: false, supportsReasoningEffort: false }, models: [{ id }] }`.
2. `server/utils/pi-runtime.ts` — `ModelRuntime.create({ credentials:
   new InMemoryCredentialStore(), modelsStore: new InMemoryModelsStore(),
   modelsPath, allowModelNetwork: false })`. Never leave `authPath` unset
   with file credentials: `DefaultAuthStorage` writes an empty `auth.json`
   even when you never log in. Inject per-run keys with
   `runtime.setRuntimeApiKey(providerId, apiKey)`; resolve models with
   `runtime.getModel(providerId, modelId)`.
3. `createAgentSession({ cwd, agentDir, model, modelRuntime, noTools: 'all',
   tools: [<custom tool names>], excludeTools: ['bash','read','write','edit'],
   customTools: [...], sessionManager: SessionManager.inMemory(cwd, { id }),
   settingsManager: SettingsManager.inMemory({ compaction: { enabled: false },
   retry: { enabled: false } }) })`. `agentDir` must be server-owned.

### DB-backed services in the agent layer (T02)

1. The agent layer extends `@local-monorepo/db` (drop `@local-monorepo/shared`
   — db already cascades it) and depends on `@local-monorepo/db` +
   `dayjs` (pnpm does not hoist dayjs to the root; a test importing it fails
   with `ERR_MODULE_NOT_FOUND` until it is a direct dep).
2. Tables live with the other feature schemas (`packages/db/db/content/board.ts`),
   exported from `db/schema.ts`; generate with
   `cd packages/db && pnpm db:generate` (offline-safe: turso config falls back
   to `file:../../local.db`, generate does not connect).
3. Agent services import `#layers/BaseDB/db/schema` and
   `#layers/BaseDB/server/utils/drizzle`, return `ServiceResponse<T>`, and
   allocate ordered rows with one atomic
   `UPDATE ... SET seq = seq + N ... RETURNING` before bulk insert.
4. Agent tests need their own harness (`packages/agent/tests/register-hook.mjs`
   + `resolve-hook.mjs` + `globals.mjs` + `setup.mjs`): map `#layers/BaseDB/`
   to `packages/db`, point `#layers/BaseDB/server/utils/drizzle` at db's
   `tests/stubs/drizzle-stub.mjs`, and reuse `packages/db/db/migrations` in
   `initTestDb`. Test script:
   `node --test --import ./tests/register-hook.mjs --import ./tests/globals.mjs "tests/*.test.mjs"`.
5. SQLite cascade assertions need `PRAGMA foreign_keys = ON` first
   (`client.execute`), even though inserts work without it.

### Background pipelines + run logging

1. Long pipelines live in one orchestrator class (`topic-batch.pipeline.ts`
   `TopicBatchPipeline`: `start()` validates → run config → tracking run,
   `execute()` runs the stages). The workflow service only delegates to
   preserve its surface — never split one flow across services again.
2. The route calls `start*` (persists an `agent_runs` row, returns `runId`)
   and fires `execute*` without awaiting. The board polls `runs.get.ts`.
3. `agentRunService.touch(runId, summary)` posts stage progress for polling;
   `finish()` closes the run. `execute*` must catch everything and finish as
   `failed` — a floating promise must never reject.
4. Guarantee output with tiers, not hope: trend-scout agent → grounded
   one-shot LLM (`generateWithLlm`) → deterministic `deriveIdeasFromBrief`.
   Zero cards after all tiers is the only honest failure.
5. Observability is evlog `useLogger` info events, never `console.*`:
   `AgentRunInput.log` threads through runner → tool context. Log run
   start/finish (tokens/tools/turns/duration), `pii_scan` findings as
   type-counts with masked samples only (raw values never leave the tool),
   PII screens at pipeline stage boundaries (counts only), and
   predefined-action stages (research agent-vs-fallback, trend-scan
   cards, idea tier used). Logging helpers must never throw — guard with
   try/catch or `?.`.
6. Node runs `.ts` in tests via native type stripping: no parameter
   properties (`constructor(private x)`), no enums/namespaces in imported
   server files.
7. Put reusable intelligence (research → synthesis → generation → validation)
   in `server/content-intelligence/` behind `createContentIntelligence(deps)`
   / `generateContentIdeas()` — persistence-free, dependencies injected, no
   imports from workflow services (one-directional: workflow → pipeline →
   plugin). Orchestration and persistence stay in the pipeline.
8. Consolidate PII in `server/agent/plugins/pii/` (detectors, `pii_scan`
   tool, counts-only screen helper) following the pi extension factory
   shape; the session guard stays in `server/agent/extensions/`. Model
   prompts live in `server/agent/prompts/*.md` — never inline model-facing
   prose in services. Delete dead orchestration (e.g. uncalled `runTrendScan`)
   instead of leaving parallel implementations.

## Gotchas

- `noTools: 'all'` alone still needs `tools: [<name>]` to enable a custom
  tool; belt-and-braces `excludeTools` keeps built-ins out of the catalog.
- `ModelRuntime.create` only hits the network when `PI_OFFLINE` is unset
  **and** `allowModelNetwork: true` during create (or `refresh()`); keep both
  false in tests and server runs.
- Do not point pi at `~/.pi`; always pass a server-owned `agentDir` and
  in-memory stores so no tenant/global files are read or written.
- The deployment `models.json` is loaded from disk at runtime: `AGENT_MODELS_PATH`
  overrides it. Bundling moves `import.meta.url`, so keep the JSON an asset.
- Node runs the `.ts` util in tests via native type stripping; keep
  `pi-runtime.ts` free of extensionless relative imports (or add a resolve
  hook like `packages/db/tests/resolve-hook.mjs`).

## Test seam

`tests/stub-provider.mjs` is a `node:http` SSE stub for
`POST /v1/chat/completions`: first turn returns a streamed `tool_calls` delta
with `finish_reason: "tool_calls"`, any turn whose `messages` contain a
`role: "tool"` entry returns streamed `content` deltas with `finish_reason:
"stop"` and `usage`, then `data: [DONE]`. `tests/pi-session.test.mjs` points
`models.json` at the stub and asserts tool execution, `text_delta` events,
final text, no `bash` in the tool catalog, and
`SessionManager.inMemory(cwd, { id }, entries)` replay via
`buildSessionContext()`.

## Verify

- [ ] `node --test packages/agent/tests/*.test.mjs` passes with no network/API keys
- [ ] No new files under a layer reference `~/.pi`
- [ ] `pnpm install` exits 0 (allowBuilds updated when pnpm asks)
- [ ] `pnpm --filter @local-monorepo/db test:services` still green
- [ ] New functions ≤ 5 branches (tests included)

## Debug

- `runtime.getError()` returns the models.json parse/validation error — check
  provider/model field names against pi's schema before debugging transport.
- `ModelRuntime.create` with a custom provider that never resolves the model:
  `getModel` returns `undefined` until `setRuntimeApiKey` marks the provider
  available; check `runtime.getAvailable()`.
- SSE stub hangs: the client waits for `data: [DONE]`; every response path
  must call `finishSse`.

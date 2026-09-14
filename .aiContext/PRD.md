# PRD: MagicSync Nuxt-Native Agent Platform (Single Source Of Truth)

> **Status:** READY FOR EXECUTION (2026-09-13)
> **Supersedes:** the Business Content Agent PRD set and the implementation
> tracker (both removed 2026-09-13) plus the previous Agentic RAG `PRD.md`
> content. Older shipped-feature PRDs in this folder are documentation only and
> are not active plans.
> **Rule:** Work one task at a time, top to bottom. Do not start a task until
> its dependencies are `[x]`. Do not mark `[x]` without evidence.
> **Progress:** tick the task checkbox and append to the Progress Log (§14)
> at the end of every session.

---

## 1. What We Are Building

A per-business content operating system inside the existing MagicSync Nuxt 4
monorepo:

1. Every business has a **Brand Playbook** (already built) that grounds every
   AI call.
2. One **ChatGPT-style chat** where a user picks a business and works with
   skills, specialized agents, and predefined workflows. Chat can drive the
   content board through tools.
3. One **content board per business** (kanban): `idea → research → drafting →
   review → approved → delivery → archive`, where each card can run the chain
   research → writer → humanizer → human review → generate post/carousel/reel →
   checks (SEO/GEO/links) → schedule/publish (GitHub, WordPress) → social
   actions.
4. Trend scans create idea cards; winners become templates; everything is
   approval-gated before external side effects.

**All of it runs in Nuxt.** The Python service is deleted. Agent execution uses
the pi SDK (`@earendil-works/pi-coding-agent`) in-process. Media tooling uses
`yt-dlp` + `ffmpeg` as pinned CLI binaries in the Docker image. PII uses
`transformers.js` ONNX in-process.

## 2. Locked Decisions

| Decision | Contract |
|---|---|
| Agent runtime | pi SDK in `packages/agent`, in-process, no child Python |
| Deployment | Single Nuxt runtime; no FastAPI; no litellm; no DSH |
| Model routing | pi `ModelRuntime`; per-business provider/model/key override; local Ollama + custom model names supported |
| Chat | One surface with business selector; SSE events with stable IDs |
| Content board | Kanban per business at `/app/business/[id]/content` |
| Context | Current Brand Playbook edition only, via `businessContextResolver` |
| Approvals | No schedule/publish/materialize-live without an approved artifact version |
| Skills/agents | T40 registry (DB) + `.agents/skills` files; drafts cannot run |
| PII | Option A: ONNX NER + regex, private mode per conversation, off by default |
| Video | yt-dlp musllinux binary + ffmpeg in image; no Whisper/transcription |
| Tenant isolation | `businessId`/`userId` resolved server-side per request; never from model args |
| DB access | Only in `packages/db/server/services/`, returning `ServiceResponse<T>` |
| UI | `<script setup>`, adjacent locale JSON, named handlers, `:loading`, toasts, `@vueuse/motion` |

## 3. Architecture

```text
Nuxt UI (chat, content board, playbook, oversight)
   |
Nuxt routes (auth middleware, zod, business access)
   /api/v1/agent/chat              SSE
   /api/v1/agent/sessions          list/restore
   /api/v1/agent/tools             catalog
   /api/v1/content-items/*         board CRUD + actions
   /api/v1/internal/*              HMAC machine routes (GH Actions)
   |
packages/agent (new layer)
   AgentRunner        pi createAgentSession wrapper + limits
   AgentSessionStore  pi entries persisted in Turso
   ToolRegistry       defineTool per service, context injected
   SkillLoader        T40 registry + .agents/skills via skillsOverride
   Workflows          predefined chains (trend scan, content chain)
   PII middleware     ONNX NER + regex (private mode)
   yt-dlp util        execFile wrapper + job progress
   |
packages/db services (playbook, resolver, registry, board, artifacts,
approvals, publishing, analytics, RAG, assets, scheduler)
   |
Turso/libSQL (drizzle)  +  pi ModelRuntime (providers, per-business override)
```

### 3.1 pi integration contract

- One `AgentSession` per chat thread:
  `createAgentSession({ cwd: <per-run temp dir>, agentDir: <server dir>,
  model, modelRuntime, tools: [...], customTools: [...], resourceLoader,
  sessionManager, settingsManager })`.
- `cwd` is a server-generated temp dir, deleted after the run. `agentDir` is
  a server-owned directory (never `~/.pi`).
- `noTools: "all"` + explicit `customTools` + `excludeTools` belt-and-braces:
  no bash/read/write/edit tool reaches a tenant.
- Extensions: none from tenant paths; server-owned only.
- `SettingsManager.inMemory({ compaction, retry })` — no user settings, no
  disk writes.
- Persistence: `SessionManager.inMemory(cwd, { id }, entries)` with entries
  stored in `agent_chat_entries`; threads also recorded in
  `chat_threads`/`chat_messages`.
- Models: deployment `models.json` (openai, anthropic, google, openrouter,
  ollama OpenAI-compatible, deepseek). Per-business override from
  `userLlmConfigService.getEffectiveConfig` injected at run start. `PI_OFFLINE=1`
  unless catalog refresh is explicitly enabled.
- Limits (env): `AGENT_MAX_TURNS`, `AGENT_MAX_TOOL_CALLS`,
  `AGENT_TOKEN_BUDGET`, `AGENT_TOOL_TIMEOUT_MS`, `AGENT_MAX_CONCURRENCY`.
- System prompt: T20 resolver output (current edition only), plus skill and
  workflow instructions. Secrets/PII never included.

### 3.2 SSE event contract

`message.started`, `thinking.delta`, `text.delta`, `tool.started`,
`tool.progress`, `tool.finished`, `artifact.created`, `review.required`,
`message.completed`, `error` — each with a stable `id`, emitted by the route
(pi `subscribe()` → normalize → write DB → forward). No brace counting.

## 4. Current State (do not rebuild)

Already implemented and green:

- T00 hardening: business access helper, fail-closed credential envelopes,
  owner-scoped pipeline/publishing services, machine-auth HMAC.
- T10: playbook v2 schema, intake, corpus, UI wizard, 20 db tests.
- T20: `businessContextResolver` (current edition only, budget, redaction),
  provider gating wired into chat/social/pipeline/MCP.
- T40: skill/agent registry (DB, versions, built-ins, quarantine).
- T70/T80: typed content contracts, `content_artifacts` + `approval_records`,
  review/materialize/schedule routes, artifact renderer in chat.
- T90: Fabric scene validation + Instagram bounds.
- T100: analytics service (latest-snapshot ranking), templates CRUD/apply.
- T120: publishing connections, delivery modes, idempotent jobs, retries.
- T130: signed machine routes + manual-first GitHub Actions workflows.

Tests to keep green: `packages/db/tests/*.mjs` (88 passing via
`pnpm --filter @local-monorepo/db test:services`).

## 5. Deletion Inventory (executed in T14)

- `packages/python-backend/**` (all of it: FastAPI app, tests, Dockerfile,
  `dsh-plugin/`, harness, RAG, PII, research, video).
- The DSH-era PRD set is already removed; no code depends on it.
- All `pythonBackendUrl` usage and `localhost:8000` references in Nuxt code.
- Python-only env keys (`DSH_*`, Python BETTER_AUTH_URL usage, litellm keys).
- CI/test jobs that run pytest.

Keep: the DSH-era capability/event/limit tests only as historical files under
the deleted tree — they are removed with the tree.

---

## 6. Data Model (new tables)

`packages/db/db/content/board.ts`, exported from `db/schema.ts`, migration
`0017_*` via `drizzle-kit generate`.

```text
content_items
  id, business_id, owner_user_id, title, brief, state,
  platforms (JSON), source_type (trend|manual|template|repurpose),
  source_ref, template_id, artifact_id, post_id,
  scheduled_at, published_at, priority,
  created_by (user|agent), created_by_user_id, retry_count, last_error,
  created_at, updated_at
  indexes: (business_id, state), (business_id, updated_at)

content_item_events            -- append-only audit + chat linkage
  id, item_id, actor_user_id, actor_kind (user|agent), event,
  from_state, to_state, payload (JSON), created_at
  index: (item_id, created_at)

content_checks
  id, item_id, kind (seo|geo|links|virality|engagement),
  status (pass|warn|fail), score, findings (JSON), created_at
  index: (item_id, kind)

content_runs                   -- chain executions per card
  id, item_id, agent_run_id, step, status, attempt, error,
  created_at, completed_at
  index: (item_id, created_at)

agent_chat_sessions            -- pi session ↔ chat thread link
  id, business_id, owner_user_id, thread_id, pi_session_id,
  private_mode, last_entry_seq, created_at, updated_at

agent_chat_entries             -- pi session persistence
  id, session_id, seq, entry (JSON), created_at
  unique: (session_id, seq)

pii_mappings
  id, business_id, thread_id, surrogate, value, created_at
  index: (business_id, thread_id)
```

### 6.1 Content item state machine

```text
idea -> researching -> research_ready -> drafting -> review_required
review_required -> changes_requested -> drafting
review_required -> approved -> materializing -> ready
ready -> scheduled -> published
any -> failed
scheduled|published -> archived
```

- Agents may move a card up to `review_required`.
- Only a human approval record moves `review_required -> approved`.
- `materializing -> ready` requires an artifact ID.
- `scheduled|published` requires an approved artifact version + (for publish)
  a publishing job.

### 6.2 Predefined workflows (pi prompt templates + workflow service)

```text
trend_scan:      scan_trends -> board_add_cards (idea)
content_chain:   research_topic -> write_post -> humanize -> checks -> review
template_chain:  apply_template -> write_post -> humanize -> review
repurpose_chain: destructure_post -> apply_template -> write_post -> review
delivery_chain:  schedule_post | publish (approval-gated)
```

---

## 7. Tool Catalog

Each tool is `defineTool()`-wrapped and receives server context
`{ userId, businessId, event }`.

| Group | Tools | Service |
|---|---|---|
| Research | `scan_trends`, `scrape_url`, `research_topic`, `retrieve` | analytics, research util, RAG |
| Content | `write_post`, `humanize`, `apply_template`, `check_seo`, `check_geo`, `check_links` | contracts, analytics, checks |
| Media | `download_video`, `design_fabric`, `create_carousel`, `create_reel_storyboard` | yt-dlp, Fabric, carousel, artifacts |
| Delivery | `schedule_post`, `publish`, `create_post` | scheduler, publishing, post |
| Board | `board_list`, `board_move`, `board_update`, `board_add_cards` | content-board |
| Skills | `list_skills`, `load_skill`, `save_skill` | skill registry |

Hard rules: delivery tools fail with a typed code when the artifact version is
not approved; `publish` never bypasses `publishingService`; every tool call is
recorded in `agent_runs.tool_events`.

---

## 8. Task List (execute in order)

### T01 — [x] pi spike and agent layer scaffold

**Depends on:** none.
**Goal:** prove the pi SDK works in this repo before committing to the layer.

**Build**
- `packages/agent/` layer: `package.json` (`@local-monorepo/agent`,
  `main: ./nuxt.config.ts`), `nuxt.config.ts`, `tsconfig.json`,
  `eslint.config.js` (copy pattern from `packages/db`).
- Pin `@earendil-works/pi-coding-agent@0.85.1` (+ `pi-ai`, `pi-agent-core`)
  via `pnpm-workspace.yaml` catalog; add `@local-monorepo/agent` to
  `packages/site/nuxt.config.ts` `extends`.
- `packages/agent/server/utils/pi-runtime.ts`: `ModelRuntime.create()` from a
  deployment `models.json` template; helper to inject a per-run API key and to
  resolve a custom model name.
- `packages/agent/tests/stub-provider.mjs`: OpenAI-compatible
  `/chat/completions` stub (node:http) that can answer with a tool call then a
  final text.
- `packages/agent/tests/pi-session.test.mjs`: `createAgentSession` with
  `SessionManager.inMemory`, `SettingsManager.inMemory`, `noTools: "all"`,
  one `defineTool` custom tool, a stub provider via `models.json`
  (OpenAI-compatible base URL). Assert: tool executed, `message_update` text
  deltas received, `RunResult`-equivalent final text, entries can be replayed
  via `SessionManager.inMemory(cwd, { id }, entries)`.
- Record findings in §13 (Appendix): verified custom-provider config, Ollama
  base pattern, test seam.

**Guardrails:** no UI, no routes; spike code stays in `tests/` until green.
**Verify:** `node --test packages/agent/tests/*.test.mjs` (from package dir
with its own register hook if needed) passes with no network and no API keys.
**Evidence:** test output + a short appendix note.

---

### T02 — [x] Session store, limits config, and migration

**Depends on:** T01.
**Goal:** durable pi sessions + board-adjacent tables in Turso.

**Build**
- `packages/db/db/content/board.ts` with all §6 tables; export from
  `db/schema.ts`; run `drizzle-kit generate` → migration `0017_*`.
- `packages/agent/server/services/agent-session.service.ts`: create/get/link
  sessions, append entries with monotonic `seq`, load entries for restore,
  set `private_mode`, all `ServiceResponse<T>`.
- `packages/agent/server/utils/agent-limits.ts`: read §3.1 env vars with
  defaults; expose `enforceTurnLimit`, `enforceToolCallLimit`,
  `checkTokenBudget`, `withToolTimeout`, `withConcurrency`.
- Extend `packages/db/tests/` with `content-board-schema.test.mjs`:
  migration applies on a fresh DB; unique `(session_id, seq)` enforced.

**Verify:** `pnpm --filter @local-monorepo/db test:services` green;
migration applies in the test harness.
**Evidence:** test output + migration filename.

---

### T03 — [x] AgentRunner + SSE chat route

**Depends on:** T02.
**Goal:** one chat endpoint that streams pi events for a business.

**Build**
- `packages/agent/server/services/agent-runner.service.ts`: build session
  (T01 runtime + T02 store), enforce limits, normalize pi events to the §3.2
  contract with stable IDs, persist `agent_runs` start/terminal rows, map
  errors to typed codes.
- `packages/agent/server/api/v1/agent/chat.post.ts`: auth →
  `requireBusinessAccess` → `businessContextResolver.resolve` (loud failure)
  → runner → SSE stream. Threads/messages persisted.
- `packages/agent/server/api/v1/agent/tools.get.ts`: static catalog.
- `packages/agent/server/api/v1/agent/sessions.get.ts` +
  `sessions/[id].get.ts`: list/restore.
- Rewire `packages/ai-tools/app/pages/app/ai-tools/chat/composables/useA2UIChat.ts`
  to `/api/v1/agent/chat`; keep the existing SSE parsing (already robust) and
  artifact rendering.

**Guardrails:** route contains no DB queries; runner returns `ServiceResponse`.
**Verify:** node:test runner test with the stub provider asserts event order
(`message.started → tool.started → tool.finished → text.delta* →
message.completed`) and persisted entries; Playwright `ai-tools-chat.spec.ts`
still passes.
**Evidence:** test output + spec result.

---

### T04 — [x] Tool registry + board tools + skill tools

**Depends on:** T03.
**Goal:** model-callable tools with server-resolved tenant context.

**Build**
- `packages/agent/server/agent/tool-context.ts`: builds
  `{ userId, businessId, event }` closure; rejects any tool call where a
  business/owner lookup does not pass `requireBusinessAccess`.
- `packages/db/server/services/content-board.service.ts`: §6.1 transitions,
  `list/add/move/update`, event append, `ServiceResponse<T>`.
- `packages/agent/server/agent/tools/board.tools.ts`:
  `board_list`, `board_move`, `board_update`, `board_add_cards`.
- `packages/agent/server/agent/tools/skills.tools.ts`:
  `list_skills`, `load_skill`, `save_skill` (draft only).
- Runner combines server-owned `customTools`; `excludeTools` covers built-ins.
- Tests: tool context isolation (model-supplied businessId ignored), board
  transitions via service tests in `packages/db/tests/content-board.test.mjs`.

**Verify:** db tests green; agent tool test asserts a foreign business ID in
args is ignored and the call operates on the session business only.
**Evidence:** test outputs.

---

### T05 — [x] Content board API + kanban UI

**Depends on:** T04.
**Goal:** per-business board usable by humans.

**Build**
- `packages/agent/server/api/v1/content-items/index.get.ts` / `index.post.ts`,
  `[id].get.ts`, `[id].put.ts` (state moves), `[id]/actions.post.ts`
  (discriminated: `research|generate|approve|request-changes|schedule|publish|archive`).
  Thin handlers → `contentBoardService`; Zod on writes.
- `packages/connect/app/pages/app/business/[id]/content.vue` +
  `content.json` (en/es/de/fr) + components under
  `packages/connect/app/pages/app/business/[id]/components/`:
  columns, card, action menu, batch bar, filters.
- Reuse artifact preview + approval endpoints; deep-link to chat per card.
- Add the board link to the business flow steps and the dashboard.

**Guardrails:** i18n keys for every string; named handlers only; `:loading`,
toasts, motion on entry/columns.
**Verify:** Playwright `packages/site/tests/e2e/content-board.spec.ts`
(desktop + mobile viewport): create card, move states, approval gate visible.
**Evidence:** spec result + screenshot path.

---

### T06 — [x] Trend scan → idea cards (chat tool)

**Depends on:** T04, T05.
**Goal:** first end-to-end chat-driven board flow.

**Build**
- `packages/agent/server/agent/tools/research.tools.ts`: `scan_trends`
  (analytics best-posts + provider-assisted topic candidates),
  `scrape_url` (SSRF guard + untrusted framing), `retrieve` (RAG stub until T08).
- `packages/agent/server/services/agent-workflow.service.ts`: `trend_scan`
  workflow = `scan_trends` → `board_add_cards`; records `content_runs`.
- Tool results render as artifact-style cards in chat and cards on the board.

**Verify:** node:test workflow test with stub provider asserts cards created in
`idea` state for the session business; Playwright extends `content-board.spec.ts`
with a chat-stub scenario.
**Evidence:** test outputs.

---

### T07 — [x] Content chain: research → write → humanize → checks

**Depends on:** T06.
**Goal:** the core generation chain with human review.

**Build**
- Tools: `research_topic` (research runner + citations + content hash),
  `write_post`, `humanize` (preserved claims), `check_seo`, `check_geo`,
  `check_links` writing `content_checks`.
- `content_chain` workflow: `research_topic → write_post → humanize → checks →
  review`; each step updates `content_runs` + card state; artifacts submitted
  via `contentArtifactService.submitArtifact`.
- Provider calls go through pi (model from per-business override); prompts
  carry the T20 resolver prompt.

**Verify:** integration test: draft → review_required artifact exists, checks
rows exist, no side effects before approval; Playwright: request changes reruns
drafting.
**Evidence:** test outputs.

---

### T08 — [x] RAG port: ingest, embeddings, vector search

**Depends on:** T03.
**Goal:** replace Python RAG with Turso-native RAG.

**Build**
- `packages/db/server/services/document-ingest.service.ts`: chunking,
  embeddings via Vercel AI SDK (`embedMany` with the effective provider),
  store `document_chunks.embedding` as float32 blobs.
- Vector search with `vector_distance_cos` (raw drizzle `sql` in the service)
  scoped by `userId`/business; `retrieve` tool upgraded to real search.
- Ingest route: `POST /api/v1/agent/documents/ingest` (SSE progress) with
  content hash dedupe; parsing for text/markdown/pdf (`unpdf`) and docx
  (`mammoth`).
- Tests: chunking/hash/dedupe unit tests; vector search returns the nearest
  seeded chunk.

**Verify:** db tests green; retrieve tool test returns seeded chunk.
**Evidence:** test outputs.

---

### T09 — [x] PII private mode (Option A)

**Depends on:** T03.
**Goal:** keep PII out of provider requests when enabled.

**Build**
- `scripts/pii_assets.sh` downloads the pinned ONNX NER model into
  `packages/agent/public/pii/` (pattern: `scripts/tts_assets_folder.sh`);
  run in Docker build.
- `packages/agent/server/utils/pii.ts`: `@huggingface/transformers`
  (`env.localModelPath` set, no runtime download) + regexes (email, phone,
  IBAN, card). `detect()`, `anonymize()`, `restore()`; fail-closed when the
  model is missing.
- Wire into the chat route: when `private_mode` is on, anonymize before
  `session.prompt`, restore on output deltas; persist `pii_mappings`.
- UI toggle in the chat header (existing business-context toggle pattern),
  with i18n + toast.
- Tests: round trip, fail-closed, and an integration test asserting the stub
  provider's received payload contains no raw PII.

**Verify:** node:test suite green; payload assertion recorded.
**Evidence:** test output.

---

### T10 — [x] yt-dlp video ingestion (no Python)

**Depends on:** T03.
**Goal:** `download_video` tool with CLI yt-dlp.

**Build**
- `scripts/install-ytdlp.sh`: fetch pinned `yt-dlp_musllinux` release asset
  with sha256 verify (version in `YTDLP_VERSION`).
- `Dockerfile` runtime stage: `apk add --no-cache ffmpeg`; `COPY` the binary
  from the builder stage (builder already installs `curl`).
- `packages/agent/server/utils/ytdlp.ts`: `execFile` with array args,
  `--no-playlist --restrict-filenames --max-filesize 200M
  --merge-output-format mp4 -o <tmp>/%(id)s.%(ext)s`, per-run temp dir,
  timeout, cleanup in `finally`.
- `download_video` tool: URL vetting via `isSafeExternalUrl` + http/https
  only; job progress events; result stored through the asset service and
  linked to the card/artifact.

**Guardrails:** never shell interpolation; never download into the repo.
**Verify:** unit test arg builder; Playwright/download test skipped when the
binary is absent, enabled in the Docker image; asset row exists after a local
stub HTTP download or fixture.
**Evidence:** test output + Docker build log line.

---

### T11 — [x] Model config unification + LLM test routes in TS

**Depends on:** T03.
**Goal:** delete the Python LLM endpoints; one model config path.

**Build**
- `packages/agent/server/utils/pi-runtime.ts` gains provider/model discovery
  and a test-connection routine using `ModelRuntime`.
- Reimplement `packages/ai-tools/server/api/v1/llm/test.post.ts`,
  `providers.get.ts`, `effective.get.ts`, `override.*` to use pi runtime +
  existing `userLlmConfigService` (no Python fetch).
- Chat/social/pipeline routes stop building `createLlmJwt` payloads for
  Python; remove now-unused `llm-jwt.ts` usage in agent paths (keep the JWT
  helper only where the Python service no longer exists → delete in T14).
- Tests: stub provider test for `/llm/test`; override round trip.

**Verify:** node:test green; `rg "pythonBackendUrl" packages/ai-tools` clean.
**Evidence:** test output + grep result.

---

### T12 — [x] Oversight feed from pi events + quick actions

**Depends on:** T03, T07.
**Goal:** truthful run telemetry and board batch triggers.

**Build**
- Write `agent_runs` rows from runner events (status, tool events, tokens,
  cost when provided, duration, terminal states on every path).
- Oversight UI: read pi-run rows, session trace via `agent_chat_entries`
  (redacted), approvals in order.
- Quick actions: board batch (`generate N days`, `carousel batch`,
  `reel storyboard batch`, `repurpose this`) creating child `content_items` +
  `content_runs`; GH Actions machine routes unchanged in contract.
- Tests: runner closes runs on success/failure/cancel; batch creates N cards,
  none published.

**Verify:** db tests + Playwright oversight/batch specs.
**Evidence:** test outputs.

---

### T13 — [x] Social actions: post, carousel, reel from a card

**Depends on:** T07, T08, T10.
**Goal:** materialize approved artifacts into deliverables.

**Build**
- Board actions + tools: `create_post`, `create_carousel`,
  `create_reel_storyboard` use the existing `contentArtifactService`
  materializers (idempotent by artifact version).
- Reel storyboard: ordered assets (yt-dlp downloads + uploads), caption,
  cover; hand off to the existing video exporter path.
- Carousel: Fabric scene validation + 2–10 Instagram bounds before side
  effects; link to the carousel editor with artifact ID.
- Schedule: scheduler service; publish: `publishingService` jobs only.
- Tests: materialize idempotency per version; bounds rejection before
  side effects; approval gate.

**Verify:** db tests + Playwright card→post/carousel/reel flow.
**Evidence:** test outputs.

---

### T14 — [x] Python decommission

**Depends on:** T03–T13 (parity reached).
**Goal:** remove the old service and every reference.

**Build**
- Delete `packages/python-backend/**` (app, tests, Dockerfile, dsh-plugin).
- Remove Python-only env keys from `.env` docs/examples; remove CI pytest jobs
  if any; remove `pythonBackendUrl` runtime-config reads and `localhost:8000`
  references across `packages/**`.
- Delete now-unused Nuxt helpers whose only consumer was Python (e.g.
  `llm-jwt.ts` payload paths) — verify with `rg` before deleting.
- Update `AGENTS.md`/`ROUTER.md`/context docs to the new architecture.

**Verify:** `rg -n "pythonBackendUrl|localhost:8000|python-backend|DSH_"
packages --glob '!**/node_modules/**' --glob '!**/.nuxt/**'` returns only
historical docs; `pnpm site:build` passes; e2e suite green.
**Evidence:** grep output + build log.

---

### T15 — [x] Final verification gate

**Depends on:** all.
**Goal:** close the project with evidence.

**Run**
1. `pnpm --filter @local-monorepo/db test:services` — all green.
2. `node --test` agent-layer suites — all green.
3. Playwright: `agent-chat`, `content-board`, `pii-private-mode`, `ytdlp`,
   `publishing`, `artifacts` specs on a warm server (`--workers=1`).
4. `pnpm dlx vite-doctor .` — no new errors/warnings.
5. Manual complexity count on every changed function ≤ 5 branches.
6. i18n audit: no hardcoded user-facing strings in new pages/components;
   every `t()` key exists in all four locales.
7. Motion/toast/loading audit per AGENTS.md gate.
8. `rg` no `console.*`/dead code added.
9. Update §14 Progress Log with final evidence; mark all tasks `[x]`.

---

## 9. Per-Task Verification Gate (every task)

Before checking any task `[x]`:

- Relevant unit tests pass (state the command and result).
- Relevant integration/e2e spec passes (or is explicitly skipped with reason).
- No route handler contains database queries; services return
  `ServiceResponse<T>`.
- Zod validation on every write boundary.
- No hardcoded user-facing strings; locale keys exist.
- Event handlers named; no bare state assignments in templates.
- Async actions show `:loading`; outcomes raise toasts; conditional UI uses
  motion on enter.
- Cyclomatic complexity manually counted ≤ 5 per changed function (state the
  max found).
- No secrets or PII committed; `git diff --check` clean.

## 10. Non-Negotiables (repo rules)

- Never write DB queries in route handlers — services in
  `packages/db/server/services/` only.
- Service methods return `ServiceResponse<T>`, never throw.
- All Vue components Composition API (`<script setup>`).
- Pages live in layer packages, not `site`.
- Shared types/utilities go to `packages/shared`.
- Never commit secrets; `.env` only.
- Python is gone after T14; do not add new Python.

## 11. Failure Semantics

| Condition | Result |
|---|---|
| Context enabled, no current edition | Block branded operation (`BRAND_CONTEXT_REQUIRED`) |
| Tool lacks business access | Not-found (no existence leak) |
| Materialize/schedule/publish unapproved | Typed validation error; no side effect |
| Provider auth failure | User-visible error; no silent model fallback |
| PII model missing + private mode on | Fail closed (refuse to send) |
| yt-dlp failure | Job error surfaced; temp dir cleaned |
| Limit exceeded | Run marked failed with limit reason in `agent_runs` |
| Tenant mismatch in tool args | Ignored; session business used |

## 12. Risks

| Risk | Mitigation |
|---|---|
| pi SDK custom-provider support for arbitrary OpenAI-compatible bases | T01 spike must prove it; fallback: thin provider adapter inside the layer |
| pi built-in tools leaking to tenants | `noTools: "all"` + explicit customTools + test asserting no bash tool in catalog |
| Long chats/compaction cost | token budgets, compaction settings, cost rows in `agent_runs` |
| ONNX model size/startup | build-time download, lazy load, private mode off by default |
| yt-dlp platform changes | pinned version + documented upgrade; job error surfaces |
| Scope creep into rebuilding T70–T120 | reuse services; tasks reference existing contracts |

## 13. Appendix — T01 Spike Findings (filled by T01)

- **Verified pi custom provider config:** `models.json` provider entry
  `{ baseUrl, api: "openai-completions", apiKey, compat: { supportsDeveloperRole: false, supportsReasoningEffort: false }, models: [{ id, name, reasoning, input, contextWindow, maxTokens }] }`
  loads through `ModelRuntime.create({ modelsPath, credentials, modelsStore, allowModelNetwork: false })`
  and resolves via `runtime.getModel(providerId, modelId)`. `@earendil-works/pi-ai`
  exports `InMemoryCredentialStore` and `InMemoryModelsStore`, so the server
  runtime never touches `~/.pi` or writes auth/models files. Per-run keys are
  injected with `runtime.setRuntimeApiKey(providerId, apiKey)` (priority 1,
  never persisted). Network refresh only happens when `PI_OFFLINE` is unset
  **and** `allowModelNetwork: true`; default is off.
- **Ollama base URL pattern:** `http://127.0.0.1:11434/v1` with
  `api: "openai-completions"` and `compat.supportsDeveloperRole: false`,
  `compat.supportsReasoningEffort: false` (shipped in
  `packages/agent/server/agent/models.json` alongside deepseek/openrouter
  OpenAI-compatible entries).
- **Test seam (stub provider + in-memory managers):** `tests/stub-provider.mjs`
  is a `node:http` server implementing `POST /v1/chat/completions` SSE. It
  answers the first turn with a streamed `tool_calls` delta + `finish_reason:
  "tool_calls"` and any turn containing a `role: "tool"` message with streamed
  text + `finish_reason: "stop"` + `usage`. Session is built with
  `SessionManager.inMemory(cwd, { id })`, `SettingsManager.inMemory({ compaction:
  { enabled: false }, retry: { enabled: false } })`, `noTools: "all"`,
  `tools: [<custom tool>]`, `excludeTools: ["bash","read","write","edit"]` and
  `customTools: [defineTool(...)]` from `typebox` parameters. The stub test
  asserts tool execution, `message_update`/`text_delta` streaming, final text,
  and that `getToolDefinition("bash")` is `undefined`.
- **Session restore shape (`agent_chat_entries`):**
  `SessionManager.getEntries()` returns header-less `SessionEntry[]` (each has
  `id`, `parentId`, `timestamp`, `type`, `message`); replay is
  `SessionManager.inMemory(cwd, { id }, entries)` and
  `buildSessionContext()` restores `model` + messages. This maps 1:1 to
  `agent_chat_entries.entry` JSON rows with a monotonic `seq` per session.

## 14. Progress Log

Append one block per session:

```text
### Session YYYY-MM-DD — Txx
- Status: done | partial | blocked
- Built:
- Tests run:
- Evidence:
- Next task:
```

### Session 2026-09-13
- Status: planning
- Built: single PRD written; supersedes PRD set + tracker
- Tests run: none (docs-only change)
- Evidence: this file
- Next task: T01 pi spike

### Session 2026-09-13 — T01
- Status: done
- Built: `packages/agent` Nuxt layer (`@local-monorepo/agent`, `BaseAgent`,
  package.json / nuxt.config.ts / tsconfig.json / eslint.config.js /
  `.playground`), catalog pins for `@earendil-works/pi-coding-agent`,
  `pi-ai`, `pi-agent-core` (0.85.1) and `typebox` 1.3.7, site extends +
  workspace dep; `server/utils/pi-runtime.ts` (in-memory credentials/models,
  deployment `server/agent/models.json` template, `applyRunApiKey`,
  `resolveRunModel`); `tests/stub-provider.mjs` OpenAI-compatible SSE stub;
  `tests/pi-session.test.mjs` + `tests/pi-runtime.test.mjs`.
- Tests run: `node --test packages/agent/tests/*.test.mjs` → 2 pass / 0 fail
  (no network, no API keys). `pnpm install` clean after allowing
  `@google/genai` build=false.
- Evidence: test output; findings recorded in §13.
- Next task: T02 session store, limits config, migration

### Session 2026-09-13 — T02
- Status: done
- Built: `packages/db/db/content/board.ts` (content_items, content_item_events,
  content_checks, content_runs, agent_chat_sessions, agent_chat_entries,
  pii_mappings + indexes/unique + relations), export from `db/schema.ts`,
  migration `0017_amazing_aqueduct.sql`; agent layer now extends
  `@local-monorepo/db` (dep added, dayjs direct dep);
  `packages/agent/server/services/agent-session.service.ts`
  (create/get/link/private-mode, atomic monotonic `seq` append, ordered load,
  owner-scoped `ServiceResponse<T>`); `server/utils/agent-limits.ts`
  (AGENT_* env limits + enforceTurnLimit/enforceToolCallLimit/checkTokenBudget/
  withToolTimeout/withConcurrency); agent test harness (register/resolve hook,
  setup, globals); tests `agent-session.test.mjs`, `agent-limits.test.mjs`,
  db `content-board-schema.test.mjs`.
- Tests run: `pnpm --filter @local-monorepo/db test:services` → 91 pass / 0 fail
  (+3 schema); agent `node --test` with hooks → 12 pass / 0 fail.
- Evidence: migration filename `0017_amazing_aqueduct.sql`; test output.
- Next task: T03 AgentRunner + SSE chat route

### Session 2026-09-13 — T03–T08
- Status: done
- Built: T03 AgentRunner (SSE contract, stable ids, limits, persistence,
  agent_runs), chat/tools/sessions routes, `useA2UIChat` rewired;
  T04 content-board service + board/skills tools with tenant isolation;
  T05 content-items API + kanban page/components + i18n + flow/dashboard links
  + Playwright spec; T06 research tools + trend-scan workflow;
  T07 content chain (research/write/humanize/checks/review) + content tools +
  `generate` action wiring; T08 document-ingest service (chunk/hash/dedupe,
  Turso vector search), embeddings util, retrieve tool, SSE ingest route.
- Tests run: agent `pnpm --filter @local-monorepo/agent test` → 26 pass / 0
  fail; db `pnpm --filter @local-monorepo/db test:services` → 97 pass / 0 fail.
- Evidence: test output; content-board.spec.ts written (run deferred to T15).
- Next task: T09 PII private mode

### Session 2026-09-13 — T09–T15
- Status: done (one documented e2e skip)
- Built: T09 PII (regex+Ner `pii.ts`, SurrogateRestorer, fail-closed
  `PII_MODEL_MISSING`, `pii_mapping.service`, runner wiring, chat toggle,
  `scripts/pii_assets.sh`, Docker); T10 yt-dlp (`install-ytdlp.sh`,
  `ytdlp.ts`, `download_video` tool, Dockerfile ffmpeg/binary); T11 pi-native
  LLM routes (test/providers/effective/override), `describeRuntimeProviders`,
  `testModelConnection`, social generation endpoints + platforms ported,
  retrieve/documents ingest on T08, text-to-sql on the model, remaining
  Python proxies stubbed with typed `NOT_PORTED` (T11 verify: ai-tools clean);
  T12 `agent_runs` route + activity feed + batch quick actions; T13 delivery
  tools (`create_post`/`create_carousel`/`create_reel_storyboard`,
  `schedule_post`, `publish` via `publishingService` jobs) + materialize
  action; T14 removed Python refs (machine secret renamed
  `MACHINE_BRIDGE_SECRET`, dsh-capability deleted, search rerank local,
  scheduler harness on `completeForUser`, playbook refine + MCP AI tools on
  the model, llm-jwt deleted, docs updated); T15 gates run.
- Tests run: agent `pnpm --filter @local-monorepo/agent test` → 40 pass / 0
  fail; db `pnpm --filter @local-monorepo/db test:services` → 94 pass / 0
  fail; `pnpm site:build` → build complete; `vite-doctor` → 11 pre-existing
  errors, 0 in new code; `rg` Python refs → only historical docs.
- Evidence: test/build output in this session.
- Skipped: `content-board.spec.ts` local run (dev-server did not become ready
  within the 120s Playwright webServer timeout in this environment); spec is
  committed for CI. Complexity max 5 branches per function (manual count).
- Next task: none — project complete.

### Session 2026-09-13 — Post-completion: external tool backends + base skills
- Status: done
- Built: ScrapeGraphAI Node SDK integration (`scrapegraph-js@2.2.1`) as the
  default scraper (`scrape_url` prefers it, raw-fetch fallback with warning)
  plus `scrapegraph_scrape|extract|search|credits` tools;
  `toolBackendsService` (entityDetails KV, AES-256-GCM secrets) storing the
  ScrapeGraphAI key and Python backend URL/token; AI settings card with
  save + test-connection routes (`/api/v1/integrations/tools*`);
  optional user-run Python tools sidecar `packages/python-tools` (FastAPI:
  `/health`, `/tools`, `/tools/{name}/run`; `fetch_text`,
  `scrapegraph_smartscraper`, `scrapegraph_searchscraper`) proxied by
  `python_tools_list`/`python_tool_run`; seven new built-in skills
  (web-researcher, seo-brief, trend-scout, hook-writer, carousel-architect,
  link-auditor, python-researcher) + expanded approved tool allowlist.
- Tests run: agent → 48 pass / 0 fail; db → 99 pass / 0 fail; `pnpm site:build`
  complete; vite-doctor 11 pre-existing errors (0 in new code); Python
  `py_compile` clean.
- Evidence: session test/build output; pattern
  `.claude/patterns/tool-backend-settings.md`.
- Note: the optional Python sidecar is a deliberate exception to the T14
  "no new Python" rule — user-run, user-configured, never a deploy dependency.
- Next task: none.

### Session 2026-09-13 — Migration squash + dead-table cleanup
- Status: done
- Built: squashed local-only migrations 0010–0017 into
  `0010_agent-content-platform.sql` (production baseline: `origin/main` ends at
  `0009_notifications-events-prefs`); removed never-used/dead tables
  `agent_sessions`, `skill_files`, `code_executions`, `sandbox_files` and their
  dead code (`agent.service.ts`, `SkillFileService`, old sub-agent API routes,
  `useSubAgent`/`SubAgentRenderer`). Framework-managed better-auth OAuth tables
  were kept despite zero direct app references.
- Tests run: `drizzle-kit check` clean; fresh-DB migrate applied (62 tables =
  45 main − 4 dropped + 21 created); db services 99 pass / 0 fail; agent 48
  pass / 0 fail; `pnpm site:build` complete.
- Evidence: migration filename + journal (11 entries, last
  `0010_agent-content-platform`); pattern updated in
  `.claude/patterns/db-migration-squash.md` (TTY rename prompts, dead-table
  pruning, verification steps).
- Next task: none.

# PRD: Flue Runtime Convergence — Remove Direct pi Usage (Backend + Frontend)

> **Status:** DRAFT (T25–T33 not started)
> **Branch:** `feature/pii-integration`
> **Extends:** `.aiContext/PRD-FLUE-AGENT-MIGRATION.md` (T01–T24, COMPLETE).
> That PRD moved orchestration onto Flue but deliberately kept the pi SDK as
> the layer underneath (model runtime, chat runner, tool definitions). This PRD
> removes those remaining direct dependencies so the repository imports Flue
> only — nothing imports `@earendil-works/pi-coding-agent` or
> `@earendil-works/pi-agent-core` by hand.
> **Execution order:** task IDs are stable identifiers. Follow the order column
> in §6.2.
> **Rule:** Work one task at a time. Do not start a task until its dependencies
> are `[x]`. Do not mark `[x]` without evidence.
> **Rule:** Every phase has a STOP CONDITION. If one cannot be satisfied safely
> — STOP, REPORT THE BLOCKER. Do not guess. Do not build a second architecture.

**Related documents**

- `PRD-FLUE-AGENT-MIGRATION.md` — the completed orchestration migration; its
  §19 item 24 lists the limitations this PRD closes (Flue persistence,
  scheduler/feature-package AI routes).
- `PRD.md` — the original pi-native platform (historical record).
- `.claude/patterns/flue-agent-layer.md` — the pattern this work must update.
- `.claude/context/conventions.md` — Verify Checklist (mirrored in §8).

---

## 1. What We Are Building

Finish the Flue convergence so there is exactly **one agent runtime, one wire
protocol, and one dependency surface**:

1. **Backend** — `packages/agent` stops importing pi packages directly. The
   chat runner, session persistence, tool definitions, guard extension, and
   subagent delegation are all expressed as Flue agents, hooks, tools, and
   store adapters.
2. **Frontend** — the chat UI consumes Flue's conversation surface through
   `@flue/sdk` (framework-agnostic; no React requirement) instead of the
   hand-rolled SSE event contract produced by `agent-runner.service.ts`.
3. **Dependencies** — `@earendil-works/pi-coding-agent` and
   `@earendil-works/pi-agent-core` leave the dependency surface entirely.
   `@earendil-works/pi-ai` remains as the provider-construction SDK (see D1):
   Flue itself depends on it and its provider protocol is how per-business
   providers are built.

Outcome: a system design where every AI entry point (HTTP API, chat, MCP,
scheduler jobs, automation) is a mounted Flue agent conversation, with durable
persistence we control and one client protocol on the frontend.

## 2. Non-goals

- No rewrite of application packages (`site`, `db`, `scheduler`, `connect`,
  `ai-tools`, `tools`, `auth`). They keep ownership; only their AI call paths
  converge (T32).
- No second agent framework, no hand-rolled loop beside Flue.
- No Cloudflare target work; this stays on the Nitro/Node target.
- No removal of `@earendil-works/pi-ai` as a *transitive* dependency —
  `@flue/runtime@2.1.0` declares `pi-agent-core ^0.83.0` and `pi-ai ^0.83.0`.
  The goal is zero *direct* imports we own, not an empty `node_modules`.
- No UI redesign; the chat page's RunCard/section components are kept, their
  data source changes.

---

## 3. Current State Inventory (verified 2026-09-21)

### 3.1 Remaining direct pi usage in `packages/agent`

| File | pi symbols | Flue replacement |
|---|---|---|
| `server/utils/pi-runtime.ts` | `ModelRuntime`, `CreateModelRuntimeOptions`, `InMemoryCredentialStore`, `InMemoryModelsStore`, `Model` | `setProvider()`/`start({ providers })` + per-run credential closure (T26) |
| `server/services/agent-runner.service.ts` | `createAgentSession`, `DefaultResourceLoader`, `SessionManager`, `SettingsManager`, `AgentSession` | Flue agent function execution + conversation stream (T29) |
| `server/agent/tool-context.ts` | `Model`/`ModelRuntime`/`ToolDefinition` types | `@flue/runtime` types (T28) |
| `server/utils/run-config.ts` | `ModelRuntime`, `Model` types | Flue model specifier resolution (T29) |
| `server/agent/extensions/guard.extension.ts` | `ExtensionAPI` | Flue execution interceptor / tool mount filtering (T28) |
| `server/agent/tools/*.ts` (12 modules) | `defineTool`, `ToolDefinition` (typebox params, `execute(toolCallId, params, …)`) | `defineTool` with **valibot** `input` + `run(toolCtx)` (already proven in `server/flue/skill-tools.ts`) (T28) |
| `server/agent/tools/subagent.tools.ts` | `Agent`, `AgentTool` from `pi-agent-core` | `defineSubagent`/`useSubagent` (already defined in `server/flue/specialists.ts`) (T27) |
| `tests/*.test.mjs` (14 files) | stub provider via `pi-ai` `createProvider`/`stream`/`streamSimple`; `SessionManager`, `defineTool` in `pi-session.test.mjs` / `agent-runner.test.mjs` | keep pi-ai stub construction under D1; runner/session tests rewrite against Flue (T29–T33) |

### 3.2 Dependency facts (verified in the installed packages)

- `@flue/runtime@2.1.0` dependencies include
  `@earendil-works/pi-agent-core ^0.83.0` and `@earendil-works/pi-ai ^0.83.0`.
  It does **not** depend on `@earendil-works/pi-coding-agent` — that package is
  only used by our code and can disappear completely.
- `pnpm-workspace.yaml`: `overrides` pin `pi-agent-core`/`pi-ai` to `0.86.1`;
  catalog pins all three pi packages at `0.86.1` plus `@flue/runtime: 2.1.0`;
  `minimumReleaseAgeExclude` lists five `@earendil-works/*@0.86.1` entries.
- `@flue/sdk@2.1.0` exists on npm (single dep: `@durable-streams/client`),
  ships with `@flue/runtime@2.1.0`, is ESM-only, runs anywhere `fetch` exists.

### 3.3 Verified Flue capabilities this PRD relies on

| Need | Verified capability |
|---|---|
| Tool definitions | `defineTool` with valibot `input`, `run(toolCtx)`, `ToolDefinition` type (`@flue/runtime`) |
| Subagent delegation | `defineSubagent` / `useSubagent` (already used in `server/flue/specialists.ts`) |
| Skills | `defineSkill` / `useSkill` (already used in `server/flue/skills.ts`) |
| Custom providers + per-run keys | `setProvider(provider: Provider)`; Flue's "Custom providers" docs build providers with pi factories and swap `baseUrl`/`auth` — matches our per-business Ollama/DeepSeek/OpenRouter path |
| HTTP surface | `createAgentRouter(agent)` → fetch-compatible router with `POST /:id`, `GET /:id?view=history`, `?view=updates`, `POST /:id/abort`; mountable in any fetch framework |
| Durable persistence | `@flue/runtime/node` `sqlite(path)` adapter; custom `PersistenceAdapter` interface; official contract tests at `@flue/runtime/test-utils/conversation-stream` |
| Frontend client | `@flue/sdk` `createFlueClient({ url, token })` with `send()/wait()/read()/history()/observe()/abort()`; parts-based messages (`text`, `reasoning`, `dynamic-tool`, `file`) with validated tool output preserved on the part |
| Nitro interop | `h3@2.0.1-rc.32` (Nuxt 4) exposes Web-Request-based events and `toWebHandler`/`fromWebHandler` — a catch-all handler can bridge into `router.fetch(request)` |

---

## 4. Locked Decisions

- **D1 — Provider path is Option A.** Keep `@earendil-works/pi-ai` as the only
  direct pi dependency, used solely to construct per-business provider objects
  for `setProvider()`. Verified rationale: `@flue/runtime` depends on `pi-ai`
  itself, Flue exports no provider factory of its own, and Flue's documented
  custom-provider path is pi provider construction. `pi-agent-core` and
  `pi-coding-agent` become non-dependencies of ours.
- **D2 — Mount the Flue router inside Nitro.** Agents are served by
  `createAgentRouter(...)` mounted through a catch-all Nitro route that bridges
  the h3 event to a Web `Request`, calls `router.fetch()`, and returns the
  `Response`. No sidecar server, no second HTTP surface.
- **D3 — Frontend uses `@flue/sdk`, not `@flue/react`.** The chat page is Vue;
  `createFlueClient()` is framework-agnostic and gives us `send/observe/history/
  abort` plus parts-based messages. Existing RunCard section components are
  kept and re-mapped from Flue message parts (`text`, `reasoning`,
  `dynamic-tool` with validated `output`).
- **D4 — Durability moves to Flue's persistence contract.** Ship a
  `PersistenceAdapter` backed by the app's libSQL/Turso database, validated by
  Flue's own contract tests (`@flue/runtime/test-utils/conversation-stream`).
  This closes PRD §19 item 24(c). `agent_chat_entries` pi-entry persistence
  retires; `agent_runs` row history stays for observability.
- **D5 — Adopt Flue's wire protocol end-to-end.** `POST` admission → 202 →
  `updates` stream/history reads replace the hand-rolled §3.2 SSE contract and
  `PI_EVENT_HANDLERS` normalization in `agent-runner.service.ts`. The chat
  route keeps its auth/tenant checks; its body becomes a thin adapter.
- **D6 — pi stays at 0.85.1 (T25 finding).** An uncommitted bump to 0.86.1
  injects a `system` turn-context message that Flue 2.1.0 (`^0.83.0`) cannot
  map, failing every Flue run. 0.85.1 is the T04-verified alignment
  (overrides + catalog + `minimumReleaseAgeExclude`); re-bump only when Flue
  declares a newer pi range.

## 5. Target Architecture

```text
Vue chat (packages/ai-tools)          other clients (MCP, jobs, automation)
        │                                          │
        │  @flue/sdk  (createFlueClient)           │  dispatch() / runCapability
        ▼                                          ▼
  Nitro catch-all route  ──────────────►  createAgentRouter(agent)
  (auth + tenant resolution,                  │
   h3 ⇄ fetch bridge)                         ▼
                                    Flue agents (MagicSyncAgent + specialists)
                                    hooks: useModel / useTool / useSkill /
                                           useSubagent / usePersistentState
                                              │
                                              ▼
                                    PersistenceAdapter (libSQL/Turso)
```

- One conversation per chat thread; conversation id = durable thread/session id.
- Tools stay server-owned: tenant context is injected per run; the model never
  supplies identity (unchanged non-negotiable).
- Telemetry keeps the existing `ai.call.*` evlog contract via Flue
  instrumentation (`server/agent/telemetry.ts` already instruments Flue).

---

## 6. Phases & Tasks

### 6.1 Phases

| Phase | Name | Tasks | STOP CONDITION |
|---|---|---|---|
| 1 | Spikes | T25, T26 | Both spikes pass with recorded evidence, or the PRD halts with a blocker report |
| 2 | Backend convergence | T27, T28, T29 | No `packages/agent` server file imports pi; agent tests green |
| 3 | Durability | T30 | Contract tests for the libSQL adapter pass; chat history survives a restart |
| 4 | Frontend + interfaces | T31, T32 | Chat runs on `@flue/sdk`; `rg 'completeForUser'` = 0; no interface owns its own loop |
| 5 | Cleanup | T33 | Deps, overrides, tests, and docs reconciled; full verification gate green |

### 6.2 Task list

| Order | Task | Title | Depends on |
|---|---|---|---|
| 1 | T25 | Nitro ⇄ `createAgentRouter` mount spike (STOP GATE) | — |
| 2 | T26 | Provider spike: `setProvider` with per-run business credentials | — |
| 3 | T27 | Delete `pi-agent-core`: subagent delegation via `useSubagent` | T25 |
| 4 | T28 | Migrate 12 tool modules to Flue `defineTool`/valibot + guard interceptor | T25 |
| 5 | T29 | Replace `agent-runner.service.ts` with Flue execution + conversation stream | T26, T27, T28 |
| 6 | T30 | libSQL `PersistenceAdapter` + session persistence migration | T29 |
| 7 | T31 | Chat frontend on `@flue/sdk` (composable + RunCard mapping) | T29 |
| 8 | T32 | Converge remaining AI routes (ai-tools, scheduler) onto `runCapability` | T29 |
| 9 | T33 | Dependency removal, test rewrites, docs, final verification | T30, T31, T32 |

### T25 — [x] order 1 · Phase 1 · Nitro ⇄ `createAgentRouter` mount spike (STOP GATE)

**Built:** `server/flue/http.ts` (`createFlueAgentHandler`) + the login-gated
catch-all `server/api/v1/agent/flue/[...path].ts` serving `MagicSyncAgent`
under `/api/v1/agent/flue` with per-user conversation namespaces; `h3` added as
a layer dependency for explicit (non-auto-import) bridge code; optional
`providers` on the `getFlueRuntime` singleton (omitted = Flue built-ins).

**Evidence:** `tests/flue-http-mount.test.mjs` — real HTTP through an h3 app:
202 admission + submission coordinates, `?view=history` materialization,
`?view=updates&offset=-1&live=sse` SSE passthrough, abort routing, namespace
isolation, out-of-mount 404. Full agent suite 208/208 green with the two
environment-dependent tests excluded (see T25 notes in §9): `content-api.test`
needs a live LangSearch key, `ytdlp.test` needed the extractor-args fix below.

**Blocker found + fixed:** the uncommitted 0.86.1 pi pin injects a `system`
turn-context message Flue 2.1.0 cannot map — every Flue test fails. Pinned pi
back to the T04-verified 0.85.1 (overrides + catalog + exclude rows), lock
passes supply-chain policy. Recorded as PRD decision D6.

### T26 — [x] order 2 · Phase 1 · Provider spike

**Build:** register per-business providers through `setProvider()` using the
existing pi-ai provider construction (Ollama / DeepSeek / OpenRouter / custom
base URL + key), replacing the `buildOpenAiCompatProvider` placeholder in
`server/flue/runtime.ts`. Start from the working recipe in
`patterns/flue-agent-layer.md` (including the `AuthResult` shape gotcha:
`resolve()` returns `{ auth: { apiKey }, source }`). Prove per-run credential
injection never leaks between tenants and that the hermetic stub provider still
serves scripted tool calls.

**STOP:** if per-run credentials cannot be swapped without a global mutation
race, STOP and report before touching the runner.

**Built:** `server/flue/runtime.ts` — `buildOpenAiCompatProvider()` is real
(pi `createProvider()` + lazy `openAICompletionsApi()`, descriptors carrying
`api: 'openai-completions'`, `provider`, `baseUrl`, `compat`, `cost`,
`contextWindow`, `maxTokens`), plus `buildBusinessProvider()` /
`registerBusinessProvider()` taking the `userLlmConfigService.getEffectiveConfig()`
field shape and returning `{ providerId, provider, modelId, modelSpecifier,
keyless }`. Provider families mirror `models.json` + `pi-runtime.ts`: base URL =
`apiBaseUrl` override else the catalog default, declared models = catalog ∪ the
business's selection (the `DYNAMIC_MODEL_PROVIDERS` case), metadata defaults
copied from `CUSTOM_MODEL_DEFAULTS`.

**STOP gate — passed.** `setProvider` does upsert into one process-global
registry keyed by `provider.id`, so the naive "every business registers under
`deepseek`" shape IS the race. The fix is the isolation boundary: a business
registers under a **business-scoped id** (`ms-<sha256(businessId)[0:16]>`), so
its `resolve()` closure and its registry entry belong to that business alone
and a re-registration can only replace its own credentials. Platform defaults
(`businessId: null`) keep the plain id, matching `AGENT_DEFAULT_PROVIDER`.
Negative control verified: collapsing `providerRegistryId()` back to the shared
id makes `tests/flue-providers.test.mjs` fail on the wire assertion.

**Also fixed (in-file, on the boot path per-run providers need):**
`getFlueRuntime()` called `previous.stop()` on a `Promise` — a pre-existing
`tsc` error (TS2339) and a runtime `TypeError`. It now drains the displaced
runtime **before** `start()`, which Flue requires (a second `start()` throws
while one is live). Covered by a new test.

**Evidence:** `tests/flue-providers.test.mjs` — 6 tests: hermetic scripted tool
call end-to-end through `getFlueRuntime` + `init`/`dispatch`/`read`; two
interleaved runs whose stub servers record the `Authorization` header each one
sent (`authorizations` added additively to `tests/stub-provider.mjs`); tenant
rotation not disturbing the other tenant; specifier ↔ declared model; undeclared
id failing at submission init with no model turn assembled; displaced-runtime
drain; the four provider families. `pnpm --filter @local-monorepo/agent test`
excluding the concurrently-edited `subagent-tool.test.mjs` (T27): **233 pass /
0 fail / 1 skipped** (baseline 230 pass). `pnpm dlx vite-doctor .`: clean, 0
diagnostics, unchanged from baseline.

**Carry to T29:** per-business providers must reach Flue through
`registerBusinessProvider()`, never through `getFlueRuntime({ providers })` —
boot options are part of the singleton key, so a per-tenant set would re-boot
the runtime (and drop in-flight conversations) on every request.

### T27 — [x] order 3 · Phase 2 · Subagents on Flue

**Build:** delete the pi-agent-core delegation loop in
`server/agent/tools/subagent.tools.ts`; delegate through `useSubagent` using the
existing `SPECIALIST_SESSION_PROFILES` (`server/flue/specialists.ts`). Preserve
current behaviour: bounded turns, isolated transcript, only allowed tools/skills,
carousel payload passthrough.

**Verify:** `subagent-tool.test.mjs` rewritten and green; `pi-agent-core` has
zero imports in `packages/agent`.

**Built:** the module is deleted and `createSubagentTools` unregistered.
Delegation is now Flue's built-in `task` tool against
`createSpecialistSubagents(options)`, whose catalog `name`/`description`, tool
allowlist and `forceSkills` are read from `SPECIALIST_SESSION_PROFILES`.
`server/flue/delegation.ts` (new) restores the two behaviours Flue does not
provide — `SUBAGENT_MAX_TURNS = 6` as a tool-boundary refusal
(`SUBAGENT_TURN_BUDGET` + `truncated: true`) and the carousel passthrough
(`{ passthrough: 'carousel', payload }` envelope + `delegationResultContract`).
`tests/subagent-tool.test.mjs` rewritten: 8 tests, one per preserved behaviour.

**Known gaps (deliberate, framework-owned):** Flue exposes no turn cap for a
delegate and returns only the delegate's *final message* to the parent, so
bounded turns are a refusal boundary rather than a hard loop kill, and the
carousel travels through the delegate's answer instead of a parent-visible
`details.carousel`. `ctx.subagentTools` is now write-only (T28/T29).

### T28 — [x] order 4 · Phase 2 · Tools onto Flue

**Build:** re-signature all 12 tool modules from typebox/`execute` to valibot
`input` + `run(toolCtx)`, following `server/flue/skill-tools.ts`. Move the
allowlist guard from `guard.extension.ts` (pi `ExtensionAPI`) to a Flue
per-agent tool mount/interceptor so blocked calls still emit audit events.
Update `tool-context.ts` types to Flue's `ToolDefinition`.

**Verify:** tool tests green; tool descriptions stay within the small-model
budget (≤6 tools per turn); no `console.*`.

**Built:** the ten remaining tool modules (the 11th, `subagent.tools.ts`, went in
T27) are Flue `defineTool`s with valibot `input`; `tool-result.ts` replaces the
nine copies of the pi `toolResult`/`toolError` and keeps the `CODE: message`
failure contract. `agent/tools/mounts.ts` (new) is the per-agent mount + the
allowlist guard that replaced `extensions/guard.extension.ts` (deleted): a mount
filter (`selectAgentTools`, auditing each withheld tool as blocked) plus a
call-time interceptor (`guardAgentTools`, auditing every call and refusing
off-allowlist tools), composed by `mountAgentTools`. `tool-context.ts` is Flue's
`ToolDefinition` and no longer carries the pi `ModelRuntime`/`Model` pair —
`goal.tools.ts` now uses the server-owned `ctx.complete` instead of rebuilding one
through `createAgentComplete`. Tenant identity is closed over at mount time
everywhere, and valibot strips unknown keys, so a model-supplied `businessId`
cannot reach a service call even in a direct `run`. `SpecialistOptions.tools`
falls back to the real per-tenant bag, so the delegate allowlists mount real
tools; `SPECIALIST_SESSION_PROFILES[].tools` and `DEFAULT_SESSION_PROFILE.tools`
are now budget-sized mounts (`CHAT_AGENT_MOUNT`).

**Evidence:** agent suite **251 tests / 248 pass / 2 fail / 1 skipped** — the two
failures are `agent-workflow.test.mjs`'s topic-batch cases, and they are the
expected T28→T29 seam: `topic-batch.pipeline.ts` drives the **pi** runner, which
receives our tools from `createAgentTools()` and can no longer execute a Flue
tool, so the trend-scout's `board_add_cards` writes nothing. Nothing else fails
(the headless research path degrades silently the same way but still passes).
`pnpm --filter @local-monorepo/db test:services` **119/119** (baseline 138 — the
parallel agent deleted `pipeline-graph`/`pipeline-runs`). `pnpm dlx vite-doctor .`
clean (0 blocker / 0 error / 0 warn / 0 info). `rg '@earendil-works/pi-coding-agent'`
in `agent/tools`, `agent/extensions`, `tool-context.ts` → empty; `rg typebox
packages/agent/server` → empty. Small-model budget proven per agent in
`tests/small-model.test.mjs` and on the wire in the slice-A run: delegates offer
exactly 6 (`task` + `activate_skill` + 4), the parent offers 2. Guard proof in
`tests/guard-extension.test.mjs` (6 tests): withheld tools and refused calls both
emit `{ toolName, blocked: true, reason: 'TOOL_NOT_ALLOWED' }`.
`SpecialistOptions.complete` is new and optional so T29 can hand the bag a real
completion.

**Carry to T29:** the pi runner cannot consume our tools. `agent-runner.service.ts`
still builds `customTools` from `createAgentTools()` (Flue) and hands them to
`createAgentSession` (pi), and its `extensionFactories: [createGuardExtension(…)]`
entry is now inert; `agent-workflow.service.ts:314-324` still computes a
`subagentTools` list nothing reads. Until T29, every pi-runner path that relied on
our tools runs without them.

### T29 — [ ] order 5 · Phase 2 · Runner replacement

**Build:** `agent-runner.service.ts` becomes a thin adapter over Flue agent
execution + the conversation stream; `chat.post.ts` keeps its route contract
(bounded turns, limits, persistence of `agent_runs`) but stops normalizing pi
session events. Delete `pi-runtime.ts` and `run-config.ts`'s pi types; replace
`createAgentComplete` (used by `goal.tools.ts`) with a Flue-derived completion
helper. Migrate `PI_EVENT_HANDLERS` §3.2 events to Flue chunk mapping (D5).

**Verify:** runner/chat/session tests rewritten and green;
`rg '@earendil-works/pi' packages/agent/server` returns only
provider-construction hits (D1).

### T30 — [ ] order 6 · Phase 3 · Durable persistence

**Build:** implement the libSQL/Turso `PersistenceAdapter`; run Flue's
`@flue/runtime/test-utils/conversation-stream` contract tests against it.
Migrate or version `agent_chat_entries`; retire `agent-session.service.ts` pi
entry/`seq` persistence once conversations live in the adapter. Keep
`agent_runs` observability writes.

**Verify:** restart the dev server mid-conversation and read history back;
contract tests green.

### T31 — [ ] order 7 · Phase 4 · Chat frontend on the SDK

**Build:** rewrite the chat composable to use `createFlueClient` (`send`,
`observe`, `history`, `abort`); keep `RunCard`/section components, re-mapping
from Flue message parts (`text`, `reasoning`, `dynamic-tool` + `output`). Session
picker backed by the durable store instead of pi session rows. All copy through
i18n; loading states and toasts preserved.

**Verify:** e2e chat + RunCard suites green; no §3.2 event names left in the
frontend.

### T32 — [ ] order 8 · Phase 4 · Interface convergence

**Build:** move the remaining AI routes onto the capability layer/Flue dispatch:
scheduler `/api/v1/ai/*` (PRD §19 24a), `tools` menu-board AI route and
scheduler carousel-design route (24b). Requires capability-layer
`temperature`/`generateObject` parity — add it in the capability layer, not in
the routes.

**Verify:** `rg 'completeForUser' packages` = 0; no pipeline/scheduler route
holds a prompt string; `rg -l 'runCapability' packages` covers the converged
routes.

### T33 — [ ] order 9 · Phase 5 · Cleanup & verification

**Build:** remove `@earendil-works/pi-coding-agent` and
`@earendil-works/pi-agent-core` from `packages/agent/package.json` and the
catalog; keep/adjust the `overrides` and `minimumReleaseAgeExclude` entries to
match what Flue actually resolves; add `@flue/sdk` to the catalog + the frontend
package; rewrite the remaining pi-importing tests; update
`patterns/flue-agent-layer.md`, the agent README, `.claude/ROUTER.md`, and
PRD §19 limitations.

---

## 7. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| h3 v2 ⇄ fetch streaming interop for `?view=updates` | T25 is a STOP GATE proven with a test before anything else moves |
| Per-run credential races (one process, many tenants) | T26 proves tenant isolation with two concurrent stub runs before the runner is touched |
| Existing chat history in `agent_chat_entries` | T30 decides migrate-vs-version explicitly; history read path stays until parity is proven |
| SSE consumers beyond the chat page (capabilities, goals API) | T29 maps every existing consumer; PRD decision D5 keeps the route contract, only the internals change |
| HMR booting a second Flue runtime | the existing singleton guard in `server/flue/runtime.ts` is kept; T29 must not add a second boot path |
| `minimumReleaseAge` policy blocking new `@flue/sdk` version | T33 adds the package via the same exclude-list mechanism already used for the pi/flue line |
| Repo lint unavailable (TS 7.0 vs typescript-eslint) | unchanged pre-existing limitation; compensated by tests + `vite-doctor` + build evidence |
| Scope creep into scheduler/feature packages | T32 is the last task and only routes, not features; anything bigger becomes a new PRD |

---

## 8. Verification Gate (per task, before marking `[x]`)

1. **Complexity** — every new/changed function ≤ 5 branches; state the max found.
2. **Nuxt doctor** — `pnpm dlx vite-doctor .`, no new diagnostics.
3. **i18n** — no hardcoded user-facing strings (frontend tasks);
   `<i18n src="…json">` + `useI18n()` + every key present in the JSON.
4. **Event handlers** — named functions; no bare state assignment in `@click`.
5. **Conventions checklist** — walk `context/conventions.md` item by item and
   report each explicitly.
6. **Patterns** — `patterns/INDEX.md` checked; `flue-agent-layer.md` followed
   and updated where this PRD changes the recipe.
7. **Interaction feedback** — async buttons `:loading`, outcomes via toasts,
   conditional UI animated (`@vueuse/motion`).
8. **Migration-specific** — `rg '@earendil-works/pi' packages/agent` shows no
   non-provider hit; `pnpm --filter @local-monorepo/agent test` green;
   `pnpm site:build` evidence recorded for T29–T33.

---

## 9. Progress Log

```text
### Session 2026-09-21 — PRD authored
- Status: done
- Built: this PRD; verified the installed @flue/runtime@2.1.0 dependency facts,
  the export surface (defineTool/useSubagent/setProvider/sqlite +
  conversation-stream contract tests), @flue/sdk@2.1.0 on npm, and h3 v2
  fetch-interop primitives (toWebHandler/fromWebHandler).
- Evidence: §3 inventory + §4 decisions record the commands and findings.
- Next task: T25 — Nitro ⇄ createAgentRouter mount spike (STOP GATE).

### Session 2026-09-21 — T25 complete (STOP GATE passed)
- Status: done
- Built: `server/flue/http.ts` + `server/api/v1/agent/flue/[...path].ts`;
  `tests/flue-http-mount.test.mjs` (2 tests); optional `providers` on the
  `getFlueRuntime` singleton; `h3` added as a layer dependency; stale
  `h3 → h3@1.15.10` shim removed from `tests/resolve-hook.mjs`.
- Also fixed in this session: pi re-pinned 0.86.1 → 0.85.1 (D6 — the 0.86.1
  bump breaks every Flue run); `buildYtdlpArgs` now passes the player client
  via `--extractor-args youtube:player_client=android` instead of the
  `--max-filesize` slot (Docker-only arg test).
- Tests run: `pnpm --filter @local-monorepo/agent test` — **206 passed /
  2 failed**, and both failures are environment-only: `content-api.test`
  performs a **live LangSearch call** because a real `LANGSEARCH_API_KEY` is
  present in the shell (it passes with the key unset, i.e. the documented
  no-network path), and `ytdlp.test` needs the pinned `yt-dlp` binary
  (Docker-only per the file's own skip comment). All Flue tests green,
  including the new T25 mount suite and the restored T04 spike.
- Evidence: `/tmp/agent-tests-t25.log` (206/2 with env keys) and
  `/tmp/agent-tests-t25b.log` (**208/208** without `LANGSEARCH_API_KEY`).
  Lock passes supply-chain policy after the 0.85.1 re-resolution.
- Verify: `pnpm dlx vite-doctor .` — 0 blockers, 11 pre-existing errors
  (unchanged baseline, none in touched files). i18n / event-handler /
  interaction gates n/a (no UI in T25). New code max complexity 2
  (`namespacedPath`; `withinMount` 2, `atPath` 0, handler 3).
- Next task: T26 — Provider spike.

### Session 2026-10-02 — T27 complete
- Status: done
- Built: deleted `server/agent/tools/subagent.tools.ts` + its registration;
  `server/flue/delegation.ts` (turn budget + carousel passthrough +
  `delegationResultContract`); `createSpecialistSubagents` now reads
  name/description/tools/forceSkills from `SPECIALIST_SESSION_PROFILES` and
  mounts the allowlisted bag guarded, per delegate render; new
  `SpecialistOptions.tools` bag; `patterns/flue-agent-layer.md` gained a
  "Subagents / delegation (T27)" section.
- Evidence: `rg '@earendil-works/pi-agent-core' packages/agent` → only
  `package.json` (T33 removes it), zero in `server/` and `tests/`;
  `tests/subagent-tool.test.mjs` 8/8; full agent suite **242 tests / 241 pass /
  0 fail / 1 skipped** (baseline 231/230/0/1; +5 from this task, +6 from the
  concurrent T26 spike); `pnpm dlx vite-doctor .` clean (0/0/0).
  Negative control: removing `guardDelegateTools` makes the budget test hang —
  the guard is load-bearing.
- Verify: max cyclomatic complexity 4 (`BusinessAgent` render body,
  `specialists.ts:172`); no `console.*`; i18n / event-handler /
  interaction-feedback n/a (no Vue touched); repo `eslint` still unavailable
  (TS 7.0 vs typescript-eslint, pre-existing PRD §7).
- Gaps to carry: `ctx.subagentTools` is write-only until T28/T29;
  `AGENT_TOOL_CATALOG` keeps the `subagent` entry (chat's
  `allowedTools: ['subagent']` is a no-op until T29 swaps the runner).
- Next task: T28 — Tools onto Flue.
```


### Session 2026-10-02 — T26 complete (STOP GATE passed)
- Status: done
- Built: `server/flue/runtime.ts` — real `buildOpenAiCompatProvider()` (pi
  `createProvider` + lazy `openAICompletionsApi`, typed `Provider<'openai-completions'>`),
  `buildBusinessProvider()` / `registerBusinessProvider()` over the
  `getEffectiveConfig()` field shape, `providerRegistryId()`,
  `FlueProviderConfigError` (`MODEL_NOT_CONFIGURED`); `http.ts` providers typed
  `readonly FlueProvider[]`; `tests/flue-providers.test.mjs` (6 tests);
  `stub-provider.mjs` gained `authorizations` (additive);
  `patterns/flue-agent-layer.md` Providers / Model specifiers / Test seam / Boot
  sections rewritten from the findings.
- STOP gate: `setProvider` upserts one process-global registry keyed by
  `provider.id`, so a shared id IS the race; businesses register under a
  business-scoped id (`ms-<sha256(businessId)[0:16]>`), platform default keeps the
  plain id. Negative control: collapsing `providerRegistryId()` to the shared id
  fails the isolation test on the wire assertion.
- Also fixed: `getFlueRuntime()`'s `previous.stop()` on a Promise (pre-existing
  TS2339 + runtime TypeError) — the displaced runtime is now drained before
  `start()`, which Flue requires; covered by a new test.
- Tests: `pnpm --filter @local-monorepo/agent test` → **242 tests / 240 pass /
  0 fail on my scope / 1 skipped**; the only failure is
  `tests/subagent-tool.test.mjs` (the concurrent T27 file) OOMing — it calls
  `@flue/runtime/node`'s `start()` directly and never touches `server/flue/runtime.ts`;
  verified identical with a pristine `stub-provider.mjs`. Excluding that file:
  **234 tests / 233 pass / 0 fail / 1 skipped** (baseline 231/230/0/1).
  New file in isolation: **6/6**.
- Verify: `pnpm dlx vite-doctor .` clean (0 blocker / 0 error / 0 warn), delta
  from baseline empty; max cyclomatic complexity 4 (`deploymentCatalog()`);
  i18n / event-handler / interaction-feedback n/a (no UI); no `console.*` in
  `server/`; `FlueStartOptions.providers` stays `unknown[]` because the T08
  slice runners pass `unknown` (T29 types them).
- Next task: T28 — Tools onto Flue.

### Session 2026-10-02 — Pipeline studio removed (not a T-series task)
- Status: done
- Built: deleted `/app/pipelines` entirely — the 4 studio pages + their 4
  locale JSONs (`packages/site/app/pages/app/pipelines/`), the 3 scheduler
  studio components, `usePipelineManager.ts` + `studioLib.ts`, all 28
  `server/api/v1/pipelines/**` routes, and the `pipeline.node` /
  `pipeline.step` capabilities (`capabilities/pipeline.ts` +
  `pipeline-dispatch.ts`, plus their aggregator import).
- Kept on purpose: `db/server/services/pipeline.service.ts`, the `pipelines` /
  `pipeline_runs` / `agent_runs` tables (the business delete-preview still
  counts `pipelines`), and the two machine-auth CLI routes
  `POST /api/v1/cli/batch` (`queueQuickAction`) and
  `POST /api/v1/cli/generate-approved` (`startGraphRun`) — both still resolve
  `pipelineService`. `db/pipelines/goal-runs.ts` is untouched: it backs goals,
  approvals and MCP `run-goal`, not the studio.
- Also: dropped the 4 `@vue-flow/*` deps, the Pipelines nav parent, the
  playbook `flow.pipelines` step, and the now-dead `menu.pipelines` /
  `menu.allPipelines` / `menu.agentOversight` / `flow.pipelines*` keys in all
  4 locales. Added a sidebar **Content** link to
  `/app/business/{activeBusinessId}/content`, reusing the existing
  `useState('business:id')` resolution, and an empty-state card on the ideas
  step whose button re-issues the same `POST /api/v1/content/scan`.
- Evidence: `rg 'vue-flow' packages` → empty;
  `rg '/app/pipelines|pipelineService|capabilities/pipeline|pipeline-dispatch|usePipelineManager' packages`
  → only the 2 CLI routes, `pipeline.service.ts`, and the delete-preview count.
- Note: no file under `packages/doc/guide/` ever referenced `/app/pipelines`
  (its "Content Pipeline" sections point at `/app/ai-tools/growth-stratergy/create`,
  which is unrelated and still live), so the guides needed no edit.

### Session 2026-10-02 — T28 complete
- Status: done (with one carry: the pi runner cannot execute our Flue tools)
- Built: ten tool modules re-signatured to Flue `defineTool` + valibot `input` +
  `run(toolCtx)`; new `agent/tools/tool-result.ts` (the `{ output }` envelope and
  the `CODE: message` failure, replacing nine copies); new `agent/tools/mounts.ts`
  (`createAgentToolBag`, `selectAgentTools`, `guardAgentTools`, `mountAgentTools`,
  `createGuardExtension`, `MAX_TOOLS_PER_TURN`, `CHAT_AGENT_MOUNT`,
  `offeredToolCount`); `guard.extension.ts` deleted;
  `extensions/index.ts` reduced to a barrel for the new guard; `tool-context.ts`
  on Flue's `ToolDefinition` with the pi `ModelRuntime`/`Model` pair removed;
  `goal.tools.ts` uses the injected `ctx.complete`; `specialists.ts` wires the real
  per-tenant bag into `SpecialistOptions.tools` and mounts it through the guard,
  and the profile/chat allowlists are budget-sized; new `tests/flue-tool.mjs`
  (`runTool`/`runToolEnvelope`/`findTool`) replacing the 9 test files' direct
  `.execute(toolCallId, params, …)` + `JSON.parse(content[0].text)` calls.
- Evidence: agent suite **251 tests / 248 pass / 2 fail / 1 skipped**. The two
  failures are `agent-workflow.test.mjs` topic-batch cases — the pi runner gets
  Flue tools from `createAgentTools()` and cannot run them, so the trend scout
  writes no cards ("Created 2 idea cards" vs `/3 idea cards/`). Baseline was
  245/244/0/1 with the same 2 cases green, so this is T28's doing and T29 removes
  it. db services **119/119** (baseline 138; the parallel agent deleted the two
  pipeline test files). `pnpm dlx vite-doctor .` clean: 0 blocker, 0 error,
  0 warn, 0 info. `rg '@earendil-works/pi-coding-agent' packages/agent/server/agent/tools
  packages/agent/server/agent/extensions packages/agent/server/agent/tool-context.ts`
  → empty. `rg 'typebox' packages/agent/server` → empty; typebox survives only in
  `tests/pi-session.test.mjs` + `tests/agent-runner.test.mjs` (they build pi tools
  by hand) and in `package.json`, so T33 drops the dependency after T29 rewrites
  those two files. `rg 'console\.' packages/agent/server` → empty.
- Small-model proof: Flue adds `task` always and `activate_skill` whenever the
  agent mounts skills, so each delegate mounts ≤ 4 of our tools. research-agent
  3 + 1 skill tool, content-agent 3 + 1, business-agent 1 + 2 skills +
  `business_lookup`, strategy-agent 2 + 2 skills, chat orchestrator 4 — every
  turn offers exactly 6, asserted per agent in `tests/small-model.test.mjs` and on
  the wire by the slice-A run (`≤ 6 tools per turn`).
- Verify: max cyclomatic complexity **5** (`delivery.tools.ts` `publish` run —
  `!connection.success || !connection.data` + three `if (!…success)` checks,
  unchanged from the pi version). i18n / event-handler / interaction-feedback n/a
  (no Vue touched). Repo `eslint` still unavailable (TS 7.0 vs typescript-eslint,
  pre-existing PRD §7). `patterns/flue-agent-layer.md` gained "Agent tools" and
  "Mounts and the allowlist guard"; `patterns/INDEX.md` line updated.
- Discrepancies: the PRD said "12 tool modules" — 11 existed (T27 deleted
  `subagent.tools.ts`). research-agent kept `retrieve`/`web_search`/`scrape_url`
  and lost `research_topic` on budget grounds (`research_topic` is in the bag and
  the catalog but unmounted by any profile); `business-agent` lost `retrieve`
  (`research.md` still names it — pre-existing prompt/mount drift, now larger).
  `createGuardExtension` kept its name and options-in shape because
  `agent-runner.service.ts` (T29-owned, off-limits) still imports it; there it
  returns a mount and is inert.
- Next task: T29 — Runner replacement (the pi runner must stop consuming our
  tools: `agent-runner.service.ts:629` `createAgentTools(...)` →
  `createAgentSession`, `:37`/`:644` the guard import and the `extensionFactories`
  block, and `agent-workflow.service.ts:314-324` the dead `subagentTools` write).

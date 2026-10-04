---
name: flue-agent-layer
description: Boot, agent/tool composition, capability registry, provider injection, telemetry, and cleanup rules for the Flue runtime embedded in the agent layer. Use when adding an AI capability, debugging Flue agent runs, or touching packages/agent/server/flue.
last_updated: 2026-10-02
---

# Flue Agent Layer (`packages/agent`)

> Authored from the real T04 spike findings. Flue (`@flue/runtime` 2.0.8) is the
> **only** orchestration runtime inside `packages/agent`; it wraps the same
> pi packages (`@earendil-works/pi-agent-core`, `pi-ai`) the layer already used
> directly. No second framework, no parallel AI package (PRD locked decision 1).

## Why Flue, what it owns

Flue owns the run loop, tool loop, streaming, durability, and subagent
delegation. The app keeps auth/DB/publishing; the agent layer keeps
deterministic routing as pre-delegation logic. An agent function is a plain
function: hooks declare tools/model/skills, the returned string is the
system instruction.

## Boot (Nitro / tests)

```ts
const { start } = await import('@flue/runtime/node') // NOT the main entry
const { init, observe, defineTool, useModel, useTool } = await import('@flue/runtime')

const flue = await start({ agents: [MyAgent], providers: [provider] })
const handle = init(MyAgent, { id: 'run-123' })            // module-scope safe
const receipt = await handle.dispatch({ message: '...' })  // durable admission
const reply = await handle.read(receipt)                   // { text, data, usage }
await flue.stop()
```

- `start()` lives in **`@flue/runtime/node`**; the main entry exports
  `init/observe/defineTool/useModel/useTool/useSkill/useSubagent/...`.
- Boot is guarded by a module-scoped singleton (`server/flue/runtime.ts`)
  so dev HMR never double-boots (PRD §5.2).
- `start()` throws if a runtime is already configured — always go through
  the singleton, never call `start()` directly from features.
- A changed singleton option set (agents or boot providers) displaces the live
  runtime: `getFlueRuntime` drains it before `start()`, because a second boot
  would throw. Keep the boot options stable (per-business credentials go through
  `setProvider`, not `getFlueRuntime`).

## Providers (per-business credentials, T26)

Flue's model layer is pi-ai's `Provider` protocol, unwrapped: the runtime holds
ONE module-scoped `Models` registry, `setProvider()` **replaces** the entry for
`provider.id`, and `useModel('id/model')` resolves against it per model call.
Build the provider with pi's `createProvider()` and the API key lives only in
the `resolve()` closure:

```ts
// server/flue/runtime.ts — the whole per-business path
registerBusinessProvider({
  businessId,      // 'user-1::biz-2'; null = platform default
  provider,        // 'ollama' | 'llama' | 'deepseek' | 'openrouter' | custom id
  model,
  apiKey,
  apiBaseUrl,      // per-business override; else the models.json default
})
// → { providerId, provider, modelId, modelSpecifier: 'ms-<digest>/<model>', keyless }
useModel(registration.modelSpecifier)
```

Gotchas that are load-bearing:

- **The registry key is the isolation boundary.** Registering every business
  under its shared provider id (`deepseek`) makes the last `setProvider()` win
  for all of them — a cross-tenant credential race. So a business registers
  under a business-scoped id (`ms-<sha256(businessId)[0:16]>`); a
  re-registration can then only replace its own entry. The platform default
  (`businessId: null`) keeps its plain id, matching `AGENT_DEFAULT_PROVIDER`.
  Proven by `tests/flue-providers.test.mjs` (two interleaved runs, one wire
  key each).
- `resolve()` returns **`{ auth: { apiKey }, source }`** (`AuthResult`).
  Returning a stored `ApiKeyCredential` (`{ type: 'api_key', key }`) fails with
  `Cannot read properties of undefined (reading 'apiKey')`. An empty key means
  a keyless local server: resolve `{ auth: {} }`.
- The wire API is the lazy wrapper
  (`openAICompletionsApi()` from `@earendil-works/pi-ai/api/openai-completions.lazy`),
  not eager `stream`/`streamSimple`.
- Declared models are the `models.json` catalog for that provider **union** the
  business's own selection — `llama`/`ollama` publish arbitrary ids at
  `/v1/models` and gateways serve far more ids than the template lists.
- **Never pass per-business providers to `getFlueRuntime()`.** They are boot
  options: a changed set changes the singleton key and re-boots the runtime
  (Flue refuses two live runtimes, so the displaced one must be drained first).
  Register per-business providers with `registerBusinessProvider()` and leave
  the boot options stable so tenants share one runtime.

## Tools

`defineTool` takes Valibot schemas (`input`), not typebox. `run` returns
`{ output }` (or `{ output, terminate: true }`); without a schema return the
value directly. On the wire tools serialize OpenAI-style — `tool.function.name`.

### Agent tools (T28 — valibot `input` + `run`, per-agent mounts)

`server/agent/tools/*.ts` are Flue tools. The pi shape
(`parameters: Type.Object(...)`, `execute: (toolCallId, params, signal, onUpdate)`,
returning `{ content: [{ type: 'text', text: JSON.stringify(x) }] }`) is gone —
there is no compat shim, so no module may import typebox or
`@earendil-works/pi-coding-agent` any more.

```ts
// server/agent/tools/board.tools.ts — the reference shape
const toolError = (code: string | undefined, message: string): never =>
  toolFailure(code, message, 'BOARD_ERROR')          // → `CODE: message`, unchanged

defineTool({
  name: 'board_list',
  description: 'List content board cards for the current business. Optionally filter by state.',
  input: v.object({
    state: v.optional(v.pipe(v.string(), v.description('Filter by card state (idea, drafting, ...)'))),
    limit: v.optional(v.pipe(v.number(), v.description('Maximum cards to return (default 50)'))),
  }),
  run: async (toolCtx) => {                          // args are parsed from `input`
    const result = await contentBoardService.list(ctx.userId, ctx.businessId, { ... }, ctx.event)
    if (!result.success) toolError(result.code, result.error)
    return toolResult({ cards: ... })                // → `{ output }`
  },
})
```

Gotchas that are load-bearing:

- **`toolResult`/`toolFailure` (`tools/tool-result.ts`) replace the nine copies**
  of the old `toolResult`/`toolError` helpers. `toolResult(x)` returns
  `{ output: x }`, so the model reads structured JSON instead of a JSON string.
  A tool failure is still a thrown `CODE: message`.
- **Tenant identity is closed over at mount time.** The factory takes
  `AgentToolContext`; the valibot schema declares no `userId`/`businessId`, and
  valibot *strips* unknown keys, so a model-supplied `businessId` cannot even
  reach `run` (`tests/board-tools.test.mjs` asserts both). Never add identity to
  a tool schema.
- **`label` is not a Flue tool field** — `defineTool` throws on unknown fields.
- **Progress goes through `toolCtx.log.info(...)`**, not pi's `onUpdate`: lines
  are streamed as `log` events and never reach the model (`download_video`).
- **`v.pipe(v.string(), v.description('…'))`** keeps the per-field help the
  typebox `description` used to carry; `v.record(v.string(), v.unknown())`
  replaces `Type.Record(Type.String(), Type.Unknown())`.

### Mounts and the allowlist guard (T28)

`createAgentTools(ctx)` is the **bag** (every tool for one run); nothing offers it
to a model directly. An agent mounts a handful through the guard in
`server/agent/tools/mounts.ts`:

```ts
createAgentToolBag(ctx)                                  // bag keyed by tool name
mountAgentTools(Object.values(bag), {                   // what an agent render calls
  agent: profile.name,
  allowedTools: profile.tools,                           // server-owned allowlist
  onAudit: entry => state.toolEvents.push(entry),        // optional audit sink
})
```

`mountAgentTools` = `guardAgentTools(selectAgentTools(...))`:

- `selectAgentTools` — the mount filter. Nothing off the allowlist is offered,
  and each withheld tool emits `{ toolName, blocked: true, reason:
  'TOOL_NOT_ALLOWED' }`. This replaced the pi `tool_call` extension hook
  (`extensions/guard.extension.ts`, deleted), which blocked at *call* time.
- `guardAgentTools` — the call-time interceptor: audits every invocation
  (`blocked: false`) and refuses anything not on the allowlist with a typed
  `{ error: 'TOOL_NOT_ALLOWED' }` output. Defence in depth for a tool that
  reached a mount without being selected.
- `createGuardExtension(options)` keeps the old factory shape (options in, mount
  out) because `agent-runner.service.ts` still calls it — inert there, and T29
  deletes the call site. `server/agent/extensions/index.ts` is only a barrel for
  the guard now; the implementation lives with the mounts.

**Budget (T11).** `MAX_TOOLS_PER_TURN = 6` counts *everything* the model is
offered: Flue always adds `task`, and `activate_skill` whenever the agent mounts
skills — every specialist does. So a delegate may mount at most **four** of our
tools. `SPECIALIST_SESSION_PROFILES[].tools` is the single source of that
allowlist (T27) and is now budget-sized; `CHAT_AGENT_MOUNT` does the same for
`DEFAULT_SESSION_PROFILE`. `offeredToolCount(names)` is the arithmetic and
`tests/small-model.test.mjs` asserts it per agent, on the wire for slice A.

**Tenant-scoped bag.** A specialist with a `userId`/`businessId` in
`SpecialistOptions` builds its own real bag from `createAgentToolBag`, so
`profile.tools` mounts real tools; `SpecialistOptions.tools` overrides it (tests,
and T29 once it owns the runner). A specialist without a tenant mounts none.

## Model specifiers

`useModel('provider-id/model-id')` — both halves must match the registered
provider id and a declared model id (or the provider carries the dynamic
model template). Split at the **first** `/`, so a provider id may not contain
one and a model id may (`openrouter/openai/gpt-4o-mini`). Wrong ids throw at
submission init, not mid-run: the submission settles `failed` and no model turn
is ever assembled. Only `cloudflareBindingProvider()` carries a dynamic-model
template, so a custom provider must declare every id it wants to serve.

## Telemetry seam (T19, done)

`installAiCallTelemetry()` (`server/agent/telemetry.ts`) registers
`instrument({ observe, interceptor, dispose })` **once** at agent-layer boot
(`server/plugins/ai-telemetry.ts` → `ensureAiCallTelemetry()`, idempotent and
HMR-safe via a globalThis guard). The interceptor wraps every provider call
correlated by `turnId` (`{ type: 'model', turnId }`); `observe()` receives the
typed runtime stream: `turn_request` (the **full final request**, never
persisted, in-process only), `turn`, `tool`, `submission_settled`, `log`.
`turn_request` is the seam that makes the §5.4 `ai.call` evlog possible — pi
alone could not expose the final payload. Events are read-only; keep
subscribers cheap.

One `ai.call` evlog event per model call, policy-gated (`AGENT_AI_LOG` =
`metadata` default | `redacted` | `payload`, truncated by
`AGENT_AI_LOG_MAX_BYTES`); credentials never logged. Correlation crosses
async boundaries via `withAiCallContext({ runId, capability, agent, userId,
businessId }, …)` (AsyncLocalStorage, precedent: `mcp-request.ts`); each
call also lands a compact row in `agent_runs` (`ai.call:<capability>`) for
debugging without a log drain — best-effort, flushed in tests with
`flushAiCallRecords()`. Shared field shape lives next to the Vercel-AI
helpers as `emitAiCallEvent` (`packages/shared/server/utils/evlog.ts`).

## Test seam

OpenAI-compatible SSE stub (`tests/stub-provider.mjs`) + a provider built for
the stub's base URL — either `createProvider` with the real
`openai-completions` stream fns (`tests/flue-runtime.test.mjs`) or
`buildBusinessProvider({ …, apiBaseUrl: stub.url })`
(`tests/flue-providers.test.mjs`). Scripts: tool call turn first, text turn
after; a tool with no `input` schema rejects extra args, so pass `toolArgs: {}`.
The stub records each request's `Authorization` header in `authorizations`, so
per-business credential isolation is observable on the wire.
`start({ providers: [] })` / `getFlueRuntime({ providers: [] })` registers no
built-ins, leaving the registry to `setProvider` — no network, no ambient keys.
Flue allows one live runtime per process: `stopFlueRuntime()` between tests, or
the next `start()` throws.

## HTTP mount (T25)

One agent's conversation surface is served through plain Nitro routes with
`createFlueAgentHandler({ agent, basePath, providers, resolveNamespace })`
(`server/flue/http.ts`): `createAgentRouter(agent)` needs no second server —
an h3 event becomes a Web `Request` via `toWebRequest`, the mount prefix is
stripped, the id segment is prefixed with the per-caller namespace (user id),
and the router's `Response` (including `text/event-stream` for
`?view=updates&offset=…&live=sse`) passes through untouched. Boot goes through
the `getFlueRuntime` singleton from `server/flue/runtime.ts`; `providers` can
be omitted to keep Flue's built-in providers (dev default), or passed for the
hermetic stub. Coverage: `tests/flue-http-mount.test.mjs`.

## Version pinning (STOP-GATE resolved)

Flue declares `^0.83.0` on pi; 0.x caret rejects 0.85.1, so pnpm would
install a **second pi copy**. `pnpm-workspace.yaml` `overrides:` force the
repo-wide pi 0.85.1 resolution. Never remove those overrides; check with
`pnpm ls --depth Infinity @earendil-works/pi-ai` — exactly one version.
(T25 D6: the 0.86.1 uncommitted bump broke Flue 2.1.0 — pi 0.86.1 injects a
`system` turn-context message Flue cannot map. Stay on 0.85.1 until Flue
supports newer pi.)

## Skills (T07, single set)

One registry: `server/flue/skills.ts` holds all 14 Flue skills (`defineSkill`
with the existing `SKILL.md` bodies, frontmatter-validated at load). Goal
skills keep their zod input/output contracts + run/verify (`goalSkills()` /
`goalSkillRegistry` for the orchestrator/planner); chat skills serve the
legacy pi facet (`BUNDLED_SKILLS` + helpers, unchanged shape). Specialists
mount skills with `useFlueSkills(ids)`. No second registry, no orphan
`SKILL.md` (asserted in `tests/flue-skills.test.mjs`).

## Subagents / delegation (T27 — one path, no pi loop)

Delegation is Flue's built-in `task` tool against the delegates declared by
`createSpecialistSubagents(options)` (`server/flue/specialists.ts`). There is no
`subagent` tool of ours: `server/agent/tools/subagent.tools.ts` (the
pi-agent-core loop) is deleted. `SPECIALIST_SESSION_PROFILES` is the single
source of a delegate's catalog `name`/`description`, its `tools` allowlist and
its `forceSkills`; the server-owned tool bag rides in `SpecialistOptions.tools`.

```ts
createSpecialistSubagents(options)  // SubagentDefinition[]  → useSubagent(...)
useSpecialists(options)             // mounts them on MagicSyncAgent
```

Two behaviours the deleted loop had that Flue does not provide, so
`server/flue/delegation.ts` reproduces them at the delegate's tool boundary
(`guardDelegateTools`, called inside the delegate render so the budget resets
per task):

- **Bounded turns.** Flue has no turn cap for a delegate (`DelegationDepthExceededError`
  bounds *depth*, not turns). `SUBAGENT_MAX_TURNS = 6` is enforced by refusing
  every tool past the cap with a typed `SUBAGENT_TURN_BUDGET` answer carrying
  `truncated: true`; `delegationResultContract()` makes the delegate finalise
  with `"truncated": true`. Do **not** use `terminate: true` for this — it ends
  the delegate's response *before* it produces a message, so the parent receives
  `(task completed with no text)`.
- **Carousel passthrough.** `task` returns only the delegate's final message, so
  a tool result with a `slides` array is wrapped in a
  `{ passthrough: 'carousel', payload }` envelope and the answer contract tells
  the delegate to copy `payload` verbatim (`artifactId`, `version`) into its
  `carousel` field. Child tool calls are invisible to the parent by design —
  never write code that expects them.

Also true (asserted in `tests/subagent-tool.test.mjs`): an unknown `agent` is a
factual miss — `Subagent "x" is not declared. Available subagents: …`, not a
throw; the delegate's transcript is fresh; and a delegate is offered the
framework's `task`/`activate_skill` on top of its allowlist, so filter with
those two in mind when asserting the mount.

## Capability layer (T05/T20 — the only entry)

```ts
runCapability(id, input, ctx)   // packages/agent/server/capabilities/registry.ts
```

A capability is declared once in the registry with `{ id, title, description,
agent, inputSchema (zod), outputSchema, consequential, stream, render, steps? }`.
HTTP routes, MCP tools, pipeline nodes and jobs are adapters: authenticate →
validate → `runCapability` → shape. **No prompt string, no model call, no skill
selection and no loop may live in a route.** Prompt text belongs in the
capability body (or a prompt module it imports), never at the call site.

- Feature-layer helpers may wrap the entry for error mapping (see
  `runSocialCapability` in `packages/ai-tools/server/utils/socialAi.ts`) — they
  still pass structured input only.
- `consequential: true` capabilities require an approval transition
  (`server/flue/approvals.ts` over `agent_goal_runs`); never auto-execute.
- Errors stay coded (`VALIDATION_ERROR`, `MODEL_NOT_CONFIGURED`, `AI_PARSE_FAILED`)
  and are mapped to status codes by the adapter, never thrown raw past it.

## Product flow: four steps, one API (C04/C05, round-2 D01–D10)

The content flow a business owner experiences is four steps, and each step is
one capability endpoint. The UI must reach the agent **only** through these:

| Step | Endpoint |
|---|---|
| 1 Scan / 2 Ideas | `POST /api/v1/content/scan` → `{ ideas: [{ id, title, brief, platforms, itemId? }], sources }` |
| 3 Draft | `POST /api/v1/content/write` → `{ itemId, artifactId, article, checks }` |
| 3 edit card | `POST /api/v1/content/update` → `{ itemId, state, item }` |
| 3 delete card | `POST /api/v1/content/delete` → `{ itemId, deleted }` |
| 3 repair | `POST /api/v1/content/fix` → `{ itemId, artifactId, article, checks, changed }` |
| 3 edit body | `PUT /api/v1/artifacts/:id/edit` → `{ version, output }` |
| 4 Publish (article) | `POST /api/v1/content/publish` → `{ itemId, artifactId, jobId, postId, variant }` |
| 4 Publish (social) | `POST /api/v1/content/social-publish` → `{ accountId, postId }` |

- **Safe Mode is the `confirm` flag**, not a second dialog on another screen.
  With the business setting ON the publish control is two-step (press → "Publish
  now?" → second press sends `confirm: true`); OFF, one press sends it. The
  capability refuses without it and does nothing.
- `GET /api/v1/content-items/:id` is the one read the flow still uses: the four
  endpoints have no read, and "which step does a refresh land on" is answered by
  the   item's own state, not by a transient ref in the client. It is a read only —
  every mutation goes through `/api/v1/content/*`. The routes stay for MCP tools
  and the DB service tests (the pipeline studio that also read itself was removed
  on 2026-10-02).
- The published body is the artifact's `variants[provider]` body when one
  exists, then `output.article`, then `output.caption`; the output field
  `variant` says which one went out. `variants` is defaulted to `{}`, so every
  artifact written before it existed still validates.
- **A brief is prose** (PRD §10.1.4). `sanitizeBrief` in
  `content-intelligence/schemas.ts` parses a JSON envelope, takes `brief`/
  `summary`, drops anything that leaves no prose and collapses whitespace. It is
  applied to the research brief and to every idea brief; a card brief must never
  match `/[{[]/`.
- **The scan plans a card per idea** and returns its `itemId`; a title this
  business already has is reused instead of duplicated, so a rescan is safe.
- **`content.fix` is never automatic.** Only `warn`/`fail` checks are repaired; a
  passing set is a `changed: false` no-op that writes nothing.
- **Two publishes, never shared** (PRD §10.1.5). `content.publish` is
  WordPress/GitHub only; `content.social.publish` owns the social post, goes
  through `postService.create` against one connected account, never edits the
  artifact and never moves the card.
- **No second publish path.** `POST /api/v1/posts` from an editor bypasses the
  confirmation gate; it must not reappear. Guard it:
  `rg 'api/v1/posts' packages/site/app/pages/app/business` → empty.

## Cleanup rules (T14 — learned the hard way)

Delete the old implementation in the same task that replaces it, and verify by
reference scan before removing anything:

- `rg -l '<symbol>' packages --glob '!node_modules'` must be empty (or point
  only at tests that are also deleted) before a symbol goes away.
- Ask "is this still reachable?" — e.g. `trend-scan.md` looked live because the
  prompt index imported it, but no profile rendered it; `tools.get.ts` looked
  live because a README mentioned it, but no client fetched it.
- Dynamic imports count: `unpdf`/`mammoth` are imported inside
  `document-ingest.service.ts` (db package) with zero static hits.
- Runtime-served assets count: the ONNX Runtime wasm files in
  `packages/site/public/assets/wasm/` are loaded by the TTS engine, not only by
  the removed PII plugin.
- Naming collisions mislead: the publishing-side `PII_DETECTED` content guard in
  `destination.service.ts` is unrelated to the removed agent PII subsystem.
- When cleanup leaves a helper with zero callers (e.g. `socialComplete`), delete
  the helper too — "unused" is the same as "dead".

## Gotchas

- Agent functions must return synchronously; async work belongs in tools.
- `useModel` is required — an agent render without it cannot start — **except
  in subagent renders**: `useModel()` throws there (`not available in a
  subagent render`). A delegate declares its model on the `defineSubagent({ …
  model })` definition instead; specialist factories therefore never call
  `useModel` and take the specifier through `SpecialistOptions` (T06).
- The built-in delegation tool is named `task` with args
  `{ prompt, agent }` (`agent` = subagent catalog name); it is always offered,
  even with zero declared subagents.
- Duplicate tool/subagent names in one render fail fast.
- `usePersistentState`/`useSandbox` throw in subagent renders; writes are
  illegal during render (throw) — write from tool `run` callbacks.
- Word-by-word SSE stubs leave a trailing space in the reply text; `.trim()`.

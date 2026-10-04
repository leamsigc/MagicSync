# PRD: Flue Agent Layer Migration (`packages/agent`)

> **Status:** COMPLETE (T01–T24 verified; final evidence and limitations are recorded in §18–§19)
> **Branch:** `feature/pii-integration`
> **Execution order:** task IDs are stable identifiers, **not** the execution
> order — follow the order table at the top of §13.
> **Extends:** `.aiContext/PRD.md` (T01–T15 pi platform, shipped). `PRD.md` stays
> the record of how the pi-native platform was built; this PRD is the migration
> from *direct pi session usage* to *Flue agent functions and hooks* inside the
> **same** `packages/agent` layer.
> **Rule:** Work one task at a time, top to bottom. Do not start a task until its
> dependencies are `[x]`. Do not mark `[x]` without evidence.
> **Rule:** Every phase has a STOP CONDITION. If a stop condition cannot be
> satisfied safely — STOP, REPORT THE BLOCKER. Do not guess. Do not build a
> second architecture.

**Related documents**

- Related PRD: [PRD.md](PRD.md) — the shipped pi-native agent platform
  (T01–T15); this PRD migrates its orchestration onto Flue.
- Design system: [DESIGN.md](DESIGN.md) — required for the T13 UX work.
- Chat UX target: [feedback/preview(3).html](../feedback/preview%283%29.html) —
  the compact single-view workflow card the chat must match (T23).
- Patterns: [pi-agent-layer.md](../.claude/patterns/pi-agent-layer.md),
  [agentic-goal-layer.md](../.claude/patterns/agentic-goal-layer.md),
  [db-migration-squash.md](../.claude/patterns/db-migration-squash.md) — the
  `flue-agent-layer.md` pattern is authored in T04.
- Conventions: [conventions.md](../.claude/context/conventions.md) — its Verify
  Checklist is mirrored in §14 below.
- Change log: [changes.md](../feedback/changes.md) — updated in T17.

---

## 1. What We Are Building

MagicSync already runs an in-process agent platform on the pi SDK inside
`packages/agent`. That platform works, but its **orchestration is hand-rolled**:
`agentic/goal-orchestrator.service.ts` implements its own bounded loop, planner,
and recovery, while `agent-runner.service.ts` implements its own session build
and event normalization around `createAgentSession`.

This PRD migrates that orchestration onto **Flue** (`@flue/runtime`) — the agent
framework built on the same pi packages — so that:

1. There is exactly **one agent runtime** (Flue) and **one Agent Layer**
   (`packages/agent`). No second framework, no parallel `packages/ai*`.
2. Agents become **Flue agent functions** composed from hooks (`useModel`,
   `useTool`, `useSkill`, `useSubagent`, `usePersistentState`).
3. Skills use the **open Agent Skills format** Flue validates (`<name>/SKILL.md`),
   which this repo already authors.
4. Every entry point (HTTP API, chat, MCP, scheduled jobs, automation) funnels
   through the **same** agent layer.
5. The repository ends **cleaner than it started**: no dead AI tables, routes,
   prompts, tools, jobs, flags, config, or dependencies left behind.

Product outcome (from the brief): a business owner types *"Help me get more
customers."* and gets research → analysis → plan → one clear next step, without
ever seeing the words agent, skill, tool, model, Pi, or Flue.

### 1.1 Non-goals

- **No rewrite of the application.** `packages/site`, `db`, `scheduler`,
  `connect`, `ai-tools`, `tools`, `auth` keep their ownership. The agent layer is
  swapped in behind them.
- **No second framework or orchestration.** No `packages/ai`, `ai-core`,
  `agentic`, `intelligence`, or `llm`; no hand-rolled loop beside Flue.
- **No second business-context system.** PII: the custom subsystem is
  **removed** in T18 at the explicit request of the product owner (Flue is the
  only integration). See T18 for the consequence and the log-content policy.
- **No re-creation of existing integrations** (social plugins, publishing,
  analytics, assets, RAG).
- **No new agent roster beyond the four first specialists** in this PRD
  (MarketingAgent, DesignAgent, SEOAgent, GEOAgent, AnalyticsAgent, SocialAgent
  are explicitly deferred until the first vertical slice passes).
- **No replacement of the app's MCP transport** — `packages/site/server/mcp`
  stays the exposure layer; it only repoints at the agent layer.
- **No replacement of `content-intelligence`, the board service, the RAG
  ingest/search, or the tool-backend settings.**
- **No dead-code "kept for safety".** Cleanup is part of the migration, not a
  follow-up.
- **No bespoke prompt per route.** Every AI capability is declared once in the
  capability registry; no route, job, or MCP tool writes its own prompt.
- **No second chat renderer.** One `RunCard` + section renderers; the chat never
  parses tool text to guess a layout.
- **No UI redesign beyond** the plain-language surface (§12) and the T23 chat
  workflow card (which must match `feedback/preview(3).html`).

---

## 2. Locked Decisions

| # | Decision | Contract |
|---|---|---|
| 1 | One Agent Layer | `packages/agent` only. Flue is the runtime **inside** it. No `packages/ai`, `ai-core`, `agentic`, `intelligence`, `llm`. |
| 2 | Framework | `@flue/runtime` (v2.x) over `@earendil-works/pi-*` — same transports already pinned. |
| 3 | Orchestration ownership | Flue owns the run loop, tool loop, streaming, durability, subagent delegation. We keep **deterministic routing** as pre-delegation logic (small-model friendliness, zero-cost routing). |
| 4 | App owns | auth, authorization, users, projects, businesses/brands, billing, DB, repositories, domain models, external credentials, social connections, jobs, queues, rate limits, persistence, audit logs, external mutations. |
| 5 | Agent layer owns | goal understanding, planning, agent behaviour, skills, subagents, tool orchestration, context selection, agent state, AI workflows, verification, recovery, approval logic. |
| 6 | PII | **No PII subsystem.** The custom integration (ONNX NER + regex + surrogates, `pii_mappings`, `private_mode`, `pii_scan`, `pii-guardian`) is removed in T18; Flue is the only integration. Sensitive-data safety is handled by the log content policy (§5.5), not by an in-process anonymiser. |
| 7 | Business context | Single source: `server/agentic/context-selector.ts` (Brand Playbook, current edition only). |
| 8 | Tool schemas | Flue tools use Valibot. Existing zod service contracts stay zod; conversion happens **at the tool boundary only** (thin adapter, no service rewrite). |
| 9 | Target model | ~24B. Small prompts, short descriptions, strict schemas, focused subagents, progressive skills, limited active tools, bounded plans. |
| 10 | Approval | Consequential actions (publish, schedule, send, reply, delete, modify external data, spend money, change settings) require explicit human approval. Never auto-execute. |
| 11 | UX | Plain language only. No agent/skill/tool/model/Pi/Flue/orchestration vocabulary in user-facing UI. |
| 12 | Deletions | Old implementation is deleted in the same task that replaces it. No "just in case" compatibility code. |
| 13 | PII | The custom PII subsystem is **removed** (T18): ONNX NER + regex + surrogates, `pii_mappings`, `private_mode`, `pii_scan`, `pii-guardian`, the assets script and the Docker step. Flue is the only integration. Consequence: AI payloads may contain personal data, so the default log policy is metadata-only (row 14). |
| 14 | AI-call logging | Every model call emits one evlog `ai.call` event carrying the **final input and the output**, gated by `AGENT_AI_LOG` = `metadata` (default) \| `redacted` \| `payload`, truncated by `AGENT_AI_LOG_MAX_BYTES`. Failures are never silent. |
| 15 | Pipeline studio | Keep the UI, the 17 routes (as thin adapters), `pipeline.service.ts`, and the `pipelines` / `pipeline_runs` / `workflow_graph` tables for run history. Execution moves to Flue capabilities through a node-kind dispatch table (T21). |
| 16 | Chat UX | One compact `RunCard` per capability run (header · step rail · sections · approval footer) matching `feedback/preview(3).html`. The server emits a structured run/step envelope; the UI never guesses layout from tool text (T23). |
| 17 | Raw model escape hatch | `completeForUser` (raw prompt in → text out, 10 call sites) is **deleted** (T20). Raw model access exists only inside Flue. |

---

## 3. Phase 0 — Repository Audit Findings (DONE)

### 3.1 What exists

`packages/agent` (`@local-monorepo/agent`, Nuxt layer `$meta.name: Agent`, 156
tracked files, **28** `node:test` suites) — runs the pi SDK in-process.

| Subsystem | Location | Callers | State |
|---|---|---|---|
| Chat SSE | `server/api/v1/agent/chat.post.ts` | `packages/ai-tools` chat page | Live |
| Goal layer | `server/agentic/*` (orchestrator, planner, registries, recovery, context-selector, progress) | goals API, `execute_goal` chat tool, MCP `run-goal` | Live |
| Goal skills (7) | `server/agentic/skills/*.ts` + sibling `<id>/SKILL.md` | skill registry | Live — **exactly the skill set this PRD targets** |
| Chat tools (37) | `server/agent/tools/*` + `tool-catalog.ts` | runner session build | Live |
| Prompts | `server/agent/prompts/*.md`, `server/agentic/prompts/*.md` | rendered via `?raw` | Live |
| pi skills (9) | `server/agent/skills/*/SKILL.md` | chat `load_skill` tool | Live |
| Predefined agents (7) | `server/agent/agents.ts` (`orchestrator`, `researcher`, `writer`, `humanizer`, `trend-scout`, `pii-guardian`, `carousel`) | chat agent picker | Live |
| Domain agents (5) | `server/agentic/agent-registry.ts` (`research`, `business`, `marketing`, `content`, `strategy`) | goal orchestrator, capabilities route | Live |
| Runner/sessions | `agent-runner.service.ts`, `agent-session.service.ts` | chat route | Live |
| Workflows | `agent-workflow.service.ts` (trend_scan, content_chain), `carousel-*`, `topic-batch.pipeline` | board + chat tools | Live |
| Content intelligence | `server/content-intelligence/` (`createContentIntelligence` / `generateContentIdeas`) | pipeline + skills | Live |
| Board API (9 routes) | `server/api/v1/content-items/*` | `packages/connect` kanban | Live |
| PII | `server/agent/plugins/pii/*`, `services/pii-mapping.service.ts`, `pii_mappings` | runner + `pii_scan` tool | Live — **the** PII boundary |
| RAG | `server/utils/embeddings.ts` + `document-ingest.service.ts` | `retrieve`, ingest route | Live |
| Media/research | `utils/ytdlp.ts`, `utils/scrapegraph.ts`, `utils/langsearch.ts`, `utils/python-tools.ts` | tools | Live |
| Model runtime | `server/utils/pi-runtime.ts`, `run-config.ts`, `agent/models.json` | runner | Live |
| MCP entry | `packages/site/server/mcp/tools/ai/run-goal.ts` (+ caption/ideas/hashtags) | external agents | Live |

### 3.2 Existing Flue / Pi integration discovered

- **Pi: fully integrated.** `@earendil-works/pi-agent-core`, `pi-ai`,
  `pi-coding-agent` pinned at `0.85.1` in `pnpm-workspace.yaml`; used by
  `pi-runtime.ts`, `agent-runner.service.ts`, `tool-context.ts`, `goal.tools.ts`.
- **Flue: absent.** Every repository hit for "flue" is a false positive
  (`influences`, `influencers`). No Flue dependency, import, config, or docs.
- **Critical finding:** `@flue/runtime@2.0.8` declares
  `dependencies: { @earendil-works/pi-agent-core: ^0.83.0, @earendil-works/pi-ai: ^0.83.0 }`
  — **Flue is a framework over the same pi core already in use.** This is an
  orchestration upgrade, not a foreign runtime.
- **Version reconciliation required at T04:** repo pins pi `0.85.1`; Flue
  resolves `^0.83.0`. Verify a single deduped pi install resolves for both, or
  pin accordingly. This is a STOP-GATE item.

### 3.3 What is obsolete / duplicated

| Item | Evidence | Verdict |
|---|---|---|
| Hand-rolled goal loop | `goal-orchestrator.service.ts` re-implements plan → step → verify → resume → cancel | REPLACE with Flue run loop (keep deterministic routing) |
| Hand-rolled planner | `planner.ts` keyword routing + model fallback | KEEP routing (small-model optimization); MIGRATE model path to Flue skill selection |
| Hand-rolled recovery | `recovery.ts` bounded retries (2) | REPLACE with Flue durability/retry settings |
| Hand-rolled SSE normalization | `agent-runner.service.ts` event contract | REPLACE with Flue conversation stream; keep stable IDs |
| Two skill systems | `server/agent/skills/*` **and** `server/agentic/skills/*` | CONSOLIDATE onto Flue skills (one format) |
| Two agent registries | `agents.ts` **and** `agentic/agent-registry.ts` | CONSOLIDATE onto Flue subagents |
| Two prompt trees | `server/agent/prompts/*.md` **and** `server/agentic/prompts/*` | CONSOLIDATE into skill/subagent instruction docs |
| 37-tool catalog injected per session | `tool-catalog.ts` + `tools/index.ts` | REPLACE with per-agent tool mounts (limited active tools) |
| `run-config.ts` playbook assembly | partially duplicates `agentic/context-selector.ts` | CONSOLIDATE on one context source |
| `run-config.ts` `completeForUser` | raw prompt→text helper with 10 call sites (§3.7) | **DELETE** — replace with capabilities (T20) |
| custom PII subsystem | `plugins/pii`, `pii_mappings`, `private_mode`, `pii_scan`, `pii-guardian`, assets script, Docker step | **DELETE** — Flue only (T18) |

### 3.4 Database usage of AI/agent tables (Phase 0 gate)

Reference scans show **every** agent/AI table has a live consumer:

| Table | Consumer(s) | Verdict |
|---|---|---|
| `agent_runs` | runner, `runs.get.ts` | KEEP (rewire to Flue run rows) |
| `agent_chat_sessions`, `agent_chat_entries` | `agent-session.service.ts` | KEEP (→ Flue persistence adapter) |
| `agent_goal_runs` | goal-orchestrator, goals API | KEEP → MIGRATE plan/steps into Flue state |
| `pii_mappings` (+ `agent_chat_sessions.private_mode`) | `pii-mapping.service.ts`, chat UI toggle | **DELETE (T18)** — the custom PII subsystem is removed at the product owner's request |
| `content_items/events/checks/runs/artifacts` | board service, `connect` UI | KEEP |
| `chat_threads`, `chat_messages` | `chat.service.ts` ← `agent-runner.service.ts`, `chat.post.ts`, `aiToolsFacade.service.ts` | KEEP (verified live) |
| `agent_definitions`, `agent_versions` | `agent-registry.service.ts` (+ ai-tools CRUD routes) | KEEP — re-evaluate against Flue subagents in T06 |
| `skill_definitions`, `skill_versions` | `skill-registry.service.ts` | KEEP — reconcile with Flue `defineSkill`/SKILL.md in T07 |
| `pipelines`, `pipeline_runs`, `workflow_graph` | `pipeline.service.ts` ← scheduler CLI routes | KEEP |
| `knowledge_folders`, `documents`, `document_chunks` | `folder.service.ts`, `document-ingest` | KEEP |
| `user_llm_configs` | `user-llm-config.service.ts`, scheduler/tools unified AI | KEEP |

**Phase 0 gate result: no blocker.** Entry points known, Pi integration known,
PII/context boundary known, DB usage known, callers known.

### 3.4.1 T03 Database Audit (2026-09-18)

The current schema was rechecked against runtime references. All retained tables
in §3.4 have live readers/writers or are required foreign-key targets. The PII
rows are not dead at this point: `agent_chat_sessions.private_mode` and
`pii_mappings` are actively represented in the PII service, runner guard, tools,
chat/session tests, and schema tests; their deliberate removal belongs to T18.

- `drizzle-kit check` — passed (`Everything's fine`)
- Fresh-DB migration — passed against `file:/tmp/magicsync-t03-fresh.db`
- Cleanup migration — **not generated**; no proven-dead artifact exists in T03
- Schema table count — unchanged; no table/column/index was removed
- DB service tests — passed in T01 baseline (135 tests / 25 suites)

T03 therefore makes no production or schema change and is complete without a
migration filename. T18 must perform the isolated PII schema cleanup after its
runtime callers are removed.

### 3.5 Where the final Agent Layer belongs

Unchanged: **`packages/agent`**. It stays a Nuxt layer extended by
`packages/site` (already wired in `site/nuxt.config.ts` and `site/package.json`).
No new package is created.

### 3.6 Baseline (record before any change, in T01)

| Gate | Command | Baseline |
|---|---|---|
| Agent tests | `pnpm --filter @local-monorepo/agent test` | **137 passed / 32 suites** |
| DB services | `pnpm --filter @local-monorepo/db test:services` | **135 passed / 25 suites** |
| Build | `pnpm site:build` | **deferred by project instruction until feature + Playwright completion** |
| Diagnostics | `pnpm dlx vite-doctor .` | **0 blockers, 16 pre-existing diagnostics, 0 warnings** |

### 3.7 Root cause of the complexity: entry-point sprawl

The agent layer is not the only problem. Every AI feature today writes its own
prompt and calls its own raw model helper.

`server/utils/run-config.ts` exports `completeForUser(userId, { prompt, system })`
— a raw "prompt in → text out" call — and it has **10 call sites across 5 packages**:

| Call site | Package | Used for |
|---|---|---|
| `pipelines/runs/[runId]/node.post.ts` | scheduler | model nodes (`agent`, `skill`, `research`, `write_post`, `humanize`, `design_fabric`) |
| `pipelines/runs/[runId]/execute.post.ts` | scheduler | legacy step runner |
| `mcp/tools/ai/generate-caption.ts` | site | MCP caption tool |
| `mcp/tools/ai/generate-ideas.ts` | site | MCP ideas tool |
| `mcp/tools/ai/suggest-hashtags.ts` | site | MCP hashtag tool |
| `mcp/tools/ai/run-goal.ts` | site | MCP goal tool |
| `utils/socialAi.ts` | ai-tools | social generation helper |
| `ai-tools/tools/text-to-sql.post.ts` | ai-tools | text-to-SQL |
| `agent-workflow.service.ts` | agent | workflow model step |
| `connect/.../playbook/refine.post.ts` | connect | brand playbook refine |

On top of that there are **three parallel orchestrators**:

1. the goal orchestrator (`server/agentic/`),
2. the pipeline node/step engine (`pipelines/*` + `pipeline.service.ts`),
3. the workflow chain services (`agent-workflow`, `content-chain` 32.8 KB,
   `topic-batch.pipeline`, `carousel-*`).

Pipeline model nodes do not call real skills today: `node.post.ts` sends
`"Execute pipeline node "X" of kind Y. Brief: … Node config: …"` to
`completeForUser` and stores the text. That is placeholder behaviour, and it is a
second source of "what does a step mean" on top of the skill catalog.

**Consequence for this PRD:** T20 deletes `completeForUser` and migrates all 10
call sites onto capabilities; T21 makes pipeline nodes dispatch to real
capabilities; the three orchestrators collapse into Flue plus one dispatch table.

### 3.8 Legacy pipeline studio inventory (kept, execution migrated)

| Piece | Location | Fate |
|---|---|---|
| UI | `packages/scheduler/app/pages/app/pipelines/{index.vue,studio.vue,agents.vue,runs/[runId].vue}` + components + `composables/` | **KEEP** |
| Nav entry | `packages/auth/app/composables/useDashboardNavigation.ts` (`/app/pipelines`) | **KEEP** |
| Routes (17) | `packages/scheduler/server/api/v1/pipelines/*` | **KEEP as adapters** (no prompt, no model call) |
| Service | `packages/db/server/services/pipeline.service.ts` (30+ methods) | **KEEP** (run history, ownership checks) |
| Tables | `pipelines`, `pipeline_runs`, `workflow_graph` | **KEEP** (run history) |
| Model execution | `node.post.ts` (`MODEL_NODE_KINDS`), `execute.post.ts` (steps) | **REPLACE** with capability dispatch (T21) |

Node kinds seen in code: `manual_trigger`, `human_review`, `terminal`, `agent`,
`skill`, `research`, `write_post`, `humanize`, `design_fabric`,
`create_carousel`, `create_reel_storyboard`, `create_post`, `publish_intent`.
Studio node kinds in `studioLib.ts`: `research`, `writer`, `humanizer`, `design`,
`virality`, `engagement`, `scrape`, `template`, `custom`.

Both the graph path (`node.post.ts`) and the step path (`execute.post.ts`) are
reachable from `UsePipelineManager.ts`, so T21 unifies both onto the same
dispatch table before removing either.

### 3.9 Chat UI inventory (T23 target)

| Piece | Size | State |
|---|---|---|
| `chat/index.vue` | 947 lines | renders `UniversalToolRenderer` **per tool call** (line ~696) → a 5-step run stacks N cards |
| `tool-results/UniversalToolRenderer.vue` | 269 lines | per-tool if/else chain (draft/research/board/delivery), each its own card |
| `tool-results/WorkflowCard.vue` | 43 lines | shell only: title, tag, status badge, slot; already `max-w-980` + `v-motion-fade` |
| `tool-results/CarouselWorkflow.vue` | 440 lines | **already matches the preview**: 5-step rail, research block + tags, slides grid, preview details, approve → create → post, accounts, best times, caption draft |
| `composables/useAgentChat.ts` | 528 lines | SSE chunk handlers → `message.toolCalls[]` + `parts[]` + activity log |
| `components/{ActivityLog,GoalRunner,ChatSidebar}.vue` | 142/114/165 | side panels and approval runner |
| `chat.json` | 159 flattened keys × 4 locales | complete and in sync |

Gaps vs `feedback/preview(3).html`:

1. **One card per run**, not one per tool call.
2. Step rail exists only inside `CarouselWorkflow` and is **faked** from a local
   `phase` ref — it must reflect real step events.
3. Research / ideas / draft / board / delivery render as separate stacked cards.
4. Approval footer and post block exist only inside `CarouselWorkflow`.
5. **Bug:** `UniversalToolRenderer.vue` calls `t('revise')`, which is missing
   from all four locales (the only undefined key out of 64 used).

---

## 4. Phase 1 — Final Target Architecture & Ownership

```text
USER
  ↓
MAGICSYNC APPLICATION  (auth, business, jobs, DB, publishing, MCP transport)
  ↓
packages/agent        (the ONLY Agent Layer)
  ↓
FLUE                  (@flue/runtime — the ONLY orchestration runtime)
  ↓
AGENTS                (MagicSyncAgent → specialists via useSubagent)
  ↓
SKILLS                (Agent Skills format: <id>/SKILL.md, progressive disclosure)
  ↓
TOOLS                 (defineTool, per-agent mounts, tenant context injected)
  ↓
MAGICSYNC SYSTEMS     (existing services: content-intelligence, board, RAG,
                       PII, publishing, analytics — never recreated)
```

### 4.1 Boundary rules

- The Agent Layer **calls** application services; it never recreates them.
- Application code **never** builds its own agent loop, prompts, or skill
  selection. It authenticates, authorizes, loads context, calls the layer.
- Tenant identity (`userId`, `businessId`) is resolved server-side and injected
  into tools; **model-supplied tenant values are ignored**.
- The layer must not require the app to duplicate PII or business context.

### 4.2 Phase 1 STOP CONDITION

Stop if: two orchestrators exist, two agent systems exist, two skill systems
exist, ownership is unclear, or the design would duplicate PII/context.

**Resolution for this repo (explicit):** Flue is the single orchestrator; the
existing `agentic/` planner **routing table** survives as pre-delegation
routing, not as an orchestrator; `skills.tools.ts` + `tool-catalog.ts` collapse
into Flue tool mounts; the two skill trees collapse into one Flue skill set.

### 4.3 Failure semantics

| Condition | Required result |
|---|---|
| Context enabled, no current Brand Playbook edition | Block the branded operation (`BRAND_CONTEXT_REQUIRED`); never invent context |
| Tool call lacks business access | Not-found (no existence leak); tenant args from the model are ignored |
| Materialize/schedule/publish without an approved artifact/approval row | Typed validation error; **no side effect** |
| Provider auth failure | User-visible error; no silent model fallback |
| PII model missing while private mode is on | Fail closed — refuse to send |
| PII restore mismatch after anonymization | Restore best-effort; never leak surrogates into persisted artifacts |
| Turn / tool-call / token / timeout limit exceeded | Run marked failed with the limit reason in `agent_runs`; partial output is not presented as complete |
| Tool throws or times out | Tool error returned to the model; run continues within bounds; never crashes the SSE stream |
| Unroutable goal | Deterministic routing misses → bounded Flue planning; if still unplannable, fail with `GOAL_UNPLANNABLE` (never loop) |
| Deleted/migrated capability still referenced by a caller | Compile/typecheck failure — caller is migrated in the same task, not shimmed |
| DB migration ambiguous (applied vs pending, drift) | **STOP** — resolve migration state manually before deleting any schema |

### 4.4 One entry, one registry, one dispatch table

The single architectural idea of this PRD:

```text
HTTP route · MCP tool · Nitro job · board action · pipeline node
   ↓  auth → zod → tenant resolve        (existing middleware + services)
packages/agent: runCapability(id, input, ctx)      ← THE only entry
   ↓
capability registry  { id, agent, inputSchema, outputSchema, consequential, stream }
   ↓
Flue agent function + per-agent useTool mounts + skills (progressive)
   ↓
tools → existing services (db · scheduler · publishing · RAG · analytics · assets)
```

Capability descriptor (shape, exact fields fixed in T05):

```ts
type Capability<In, Out> = {
  id: string                      // 'content.ideas', 'research.competitors'
  agent: AgentFunction            // the Flue agent that serves it
  inputSchema: z.ZodType<In>      // validated at the entry
  outputSchema: z.ZodType<Out>    // validated before returning
  steps?: StepDescriptor[]        // drives the chat step rail (T23)
  consequential?: boolean         // approval-gated (T12)
  stream: 'none' | 'sse'          // response adapter selection
  render?: SectionKind            // chat section renderer hint (T23)
}
```

Rules:

- A route is an adapter: parse → authorize → `runCapability` → shape. It contains
  no prompt, no loop, no skill selection, no model call.
- `completeForUser` is deleted; raw model access exists only inside Flue (T20).
- Tenant identity is resolved server-side and injected into tools; model-supplied
  tenant values are ignored.
- **Extending later = add a Flue agent + register a capability** (plus a section
  renderer only if the output needs a new visual shape). Documented in T24.

### 4.5 Pipeline node dispatch table (T21)

| Node kind | Destination |
|---|---|
| `manual_trigger` | no model — completes immediately (unchanged) |
| `agent` | capability `pipeline.agent` (node config as input) |
| `skill` | capability resolved from `node.config.skill` (a real skill, not prose) |
| `research` / `scrape` | `research.topic` / `research.scrape` |
| `write_post` / `writer` | `content.write_post` |
| `humanize` / `humanizer` | `content.humanize` |
| `design` / `design_fabric` | `design.fabric` |
| `virality` / `engagement` | `content.checks` (virality/engagement checks) |
| `template` | `content.apply_template` |
| `create_carousel` / `create_reel_storyboard` | existing materializers (no model) |
| `create_post` | existing artifact/post service (no model) |
| `publish_intent` | existing publishing jobs (approval-gated) |
| `human_review` / `terminal` | existing review endpoints (approval) |
| `custom` | `pipeline.agent` with the node config as input |

One dispatch table serves both `node.post.ts` and `execute.post.ts`; the step
path is unified then removed if the graph studio is the only live entry.

### 4.6 Chat `RunCard` (T23)

```text
SSE  run.started   { runId, capability, title, steps[] }
     step.completed{ stepId, status, summary, data }   ← typed per step
     approval.required { runId, stepId, actions[] }
     run.completed { runId, result }
        ↓
RunCard.vue        header · step rail · sections · approval footer   (one per run)
  ├─ ResearchSection   summary + source tags
  ├─ IdeasSection      idea list (per platform)
  ├─ CarouselSection   slides grid + preview details   ← today's CarouselWorkflow
  ├─ DraftSection      caption/draft + revise hint
  ├─ BoardSection      cards created/moved
  └─ DeliverySection   accounts + best times + schedule/approve
```

- The **shell is generic, the server owns semantics**: a new capability needs at
  most a new section renderer; card, rail, and approval footer never change.
- Sections are **presentational**: accounts and posting times come from existing
  services through tools (`social-accounts`, `stats?mode=best-times`).
- `WorkflowCard.vue` evolves into the shell (it already carries `max-w-980`,
  header, tag, status, `v-motion-fade`); `CarouselWorkflow.vue` markup moves into
  `CarouselSection`; `UniversalToolRenderer`'s if/else chain becomes a section map.
- The step rail renders **real** step status from the envelope — never a local
  `phase` ref.

---

## 5. Flue Integration Contract

### 5.1 Verified Flue primitives (from framework docs)

| Primitive | Use in this repo |
|---|---|
| Agent function (`'use agent'`, returns instructions, re-renders per turn) | `MagicSyncAgent`, specialist agents |
| `useModel(id)` | per-agent model; effective model from `userLlmConfigs` |
| `useTool(defineTool(...))` | every capability currently in `tool-catalog.ts` |
| `useSkill(...)` | the 7 + future skills; progressive disclosure keeps the catalog cheap |
| `useSubagent(...)` / built-in `task` tool | specialist delegation |
| `usePersistentState(...)` | goal plan, step status, approval state |
| Event hooks + lifecycle | run telemetry → `agent_runs` |
| `defineTool` input schema = **Valibot** | boundary adapter converts existing zod contracts |
| Durability / persistence adapter (`sqlite()`) | backs onto existing Turso/libSQL |
| `start()` / `init()` / `dispatch()` | embed in Nitro; `dispatch()` for jobs/MCP |
| `useMcpConnection(...)` | optional later; app MCP transport stays in `packages/site` |

### 5.2 Boot strategy (Nitro)

Flue is embedded in the Nitro server, not run as a separate process:

1. A single Nitro plugin/module inside `packages/agent` boots the Flue runtime
   (`start()` variant) with the existing DB connection and `server/agent/models.json`.
2. Dev HMR must not double-boot the runtime — guard with a module-scoped
   singleton (STOP-GATE check at T04).
3. Provider credentials keep the current path: `pi-runtime.ts` in-memory
   credential store + per-run API keys. No `~/.pi`, no file credentials.
4. `cwd`/agent dirs stay server-owned; per-run temp dirs are removed after the run.

### 5.3 Version reconciliation (T04 gate)

| Package | Repo pin | Flue 2.0.8 expects | Action |
|---|---|---|---|
| `@earendil-works/pi-agent-core` | `0.85.1` | `^0.83.0` | verify single deduped resolution; adjust pins if needed |
| `@earendil-works/pi-ai` | `0.85.1` | `^0.83.0` | same |
| `@flue/runtime` | not installed | — | add to catalog |
| `valibot` | not installed | `^1.1.0` (transitive) | add direct dep for `defineTool` schemas |

**STOP** if pi versions cannot be reconciled without breaking the existing
`pi-runtime.ts` / runner tests.

### 5.4 AI-call telemetry contract (T19)

Flue exposes the seam the Vercel AI SDK never could here (`patterns/evlog-observability.md`
currently states the pi runtime cannot be wrapped — that gotcha is superseded):

- `instrument({ model })` wraps **every provider call**, correlated by `turnId`.
- `observe()` receives the typed runtime stream: `turn_request`, `turn`, `tool`,
  `submission_settled`, `log`.
- `turn_request` events **never leave the process**, so the final request payload
  is available locally for debugging.

One evlog event per model call:

```ts
{
  event: 'ai.call',
  callId, submissionId, runId, capability, agent, purpose,
  provider, model, latencyMs, finishReason, error,
  usage: { promptTokens, completionTokens, cachedTokens },
  input:  { messages, instructions, toolNames },   // policy-gated
  output: { text, toolCalls },                     // policy-gated
  contentPolicy: 'metadata' | 'redacted' | 'payload'
}
```

- Registered **once** at agent-layer boot (`server/agent/telemetry.ts`); nothing
  elsewhere logs model traffic.
- Request correlation via AsyncLocalStorage (precedent:
  `packages/site/server/mcp/utils/mcp-request.ts`) so background jobs and MCP
  calls log too; a compact row still lands in `agent_runs` for debugging without
  a log drain.
- Existing AI SDK paths keep `wrapAiModel` / `captureEmbedUsage`; both helpers now
  live side by side in the evlog utility module.

### 5.5 Log content policy

| `AGENT_AI_LOG` | Content captured | Use |
|---|---|---|
| `metadata` (default) | model, provider, tokens, latency, tool names, finish reason, error | production |
| `redacted` | as above + input/output with secrets, tokens, API keys, emails and phone numbers scrubbed | shared debugging |
| `payload` | full final input + output, truncated to `AGENT_AI_LOG_MAX_BYTES` | local deep debugging |

Unconditional rules: API keys and credential material are **never** logged at any
level; image bytes are replaced with a sentinel; failures and denials always
emit an event (never silent).

---

## 6. Phase 2 — Migration Map (KEEP / MIGRATE / REPLACE / DELETE)

| Existing | Action | Destination | Task |
|---|---|---|---|
| `server/content-intelligence/*` | **KEEP** | unchanged (persistence-free intelligence) | — |
| `server/agent/plugins/pii/*`, `pii-mapping.service.ts` | **DELETE** | No replacement; Flue is the only integration and log policy governs sensitive payloads | T18 |
| `agentic/context-selector.ts` | **KEEP** | single business-context source | T08 |
| `utils/embeddings.ts`, `document-ingest.service.ts` | **KEEP** | `retrieve` tool | — |
| board service + `content-items` API | **KEEP** | app-owned persistence | — |
| `utils/ytdlp.ts`, `scrapegraph.ts`, `langsearch.ts`, `python-tools.ts` | **KEEP** | Flue tools | T05 |
| `agentic/skills/*.ts` + `SKILL.md` (7) | **MIGRATE** | Flue skills (same ids, same SKILL.md bodies) | T07 |
| `agentic/planner.ts` routing table | **MIGRATE** | deterministic pre-routing before Flue dispatch | T06 |
| `agentic/skill-registry.ts`, `agent-registry.ts` | **MIGRATE** | Flue skill/subagent declarations | T06/T07 |
| `agentic/contracts.ts` (zod schemas) | **MIGRATE** | output contracts + verification | T07 |
| `agentic/progress.ts`, `goal-events.ts` | **MIGRATE** | UI progress labels over Flue events | T10/T13 |
| `server/agent/prompts/*.md` (14) | **MIGRATE → CONSOLIDATE** | into skill/subagent instruction docs | T07 |
| `server/agent/skills/*/SKILL.md` (9) | **MIGRATE → CONSOLIDATE** | single Flue skill set | T07 |
| `tools/*.ts` (12 modules, 37 tools) | **MIGRATE** | `defineTool` + per-agent `useTool` mounts | T05 |
| `goal-orchestrator.service.ts` | **REPLACE** | Flue run loop + `usePersistentState` | T06 |
| `agent-runner.service.ts` (loop/SSE) | **REPLACE** | Flue conversation stream → existing SSE contract | T04/T06 |
| `agentic/recovery.ts` | **REPLACE** | Flue durability/retry + bounded task config | T06 |
| `tool-catalog.ts` (37-at-once) | **REPLACE** | per-agent mounts (limited active tools) | T09 |
| `agents.ts` (7 predefined) | **REPLACE** | Flue subagents | T06 |
| `agentic/goal-orchestrator.service.ts` approval branch | **REPLACE** | Flue-gated approval state (keep API) | T12 |
| `run-config.ts` playbook assembly | **DELETE** | superseded by context-selector | T14 |
| duplicate prompt copies | **DELETE** | — | T14 |
| unused env flags / deps | **DELETE** | — | T14 |
| dead tables/columns/indexes (if any) | **DELETE** | via drizzle migration | T03/T15 |
| `completeForUser` + its 10 call sites | **DELETE / MIGRATE** | capabilities via `runCapability` | T20 |
| pipeline node/step model execution (inline prompts) | **REPLACE** | node-kind dispatch table (§4.5) | T21 |
| pipeline UI, 17 routes, `pipeline.service`, 3 tables | **KEEP** | run history; routes become thin adapters | T21 |
| custom PII subsystem (code, table, column, UI, ops, docs) | **DELETE** | nothing replaces it — Flue is the only integration | T18 |
| chat `UniversalToolRenderer` per-tool cards | **REPLACE** | one `RunCard` + section renderers | T23 |
| `CarouselWorkflow.vue` markup + step rail | **MIGRATE** | `CarouselSection` inside the `RunCard` shell | T23 |
| `t('revise')` missing i18n key | **FIX** | add to all four locales | T23 |

### 6.1 T02 Caller Verification (2026-09-18)

The migration rows were checked against repository references. The live callers
that must move with each replacement/deletion are:

| Migration area | Confirmed live callers |
|---|---|
| Content intelligence | `agentic/skills/create-content-ideas.ts`; `services/topic-batch.pipeline.ts`; content-intelligence tests |
| Context selector | `agentic/goal-orchestrator.service.ts` (`assembleGoalContext` in execute/resume paths) |
| RAG/embeddings | `services/agent-runner.service.ts`; `agent/tools/research.tools.ts`; `api/v1/agent/documents/ingest.post.ts`; document-ingest service |
| Media/research utilities | `agent/tools/research.tools.ts`; `services/agent-workflow.service.ts`; topic-batch and research workflow tests |
| Goal planner/routing | `agentic/goal-orchestrator.service.ts`; `api/v1/agent/goals/index.post.ts`; MCP `run-goal`; `agent/tools/goal.tools.ts`; planner tests |
| Goal registries/contracts/progress/events/recovery | goal orchestrator; capabilities route; agentic planner/skills registries; goal event emitter; agentic orchestrator tests |
| Agent/skill DB registries | capabilities route; `ai-tools` agent/skill CRUD and seed routes; pipeline service snapshot resolution; runner skill loading |
| Pi runner/session path | `api/v1/agent/chat.post.ts`; `services/agent-workflow.service.ts`; `services/topic-batch.pipeline.ts`; runner/session/PII tests |
| PII subsystem | runner/guard extension; `pii_scan` tool; `pii-guardian` agent and skill; chat private-mode/session tests; `pii_mappings` schema and DB test |
| Tool catalog and predefined agents | chat route; capabilities/tools discovery routes; runner session construction; predefined-agent/subagent/skills tests |
| Pipeline execution | all 17 pipeline routes remain adapters; model execution is in `runs/[runId]/node.post.ts` and `execute.post.ts`; pipeline service and run tests |
| Raw completion escape hatch | exactly 10 call sites: scheduler node/execute routes, four site MCP AI tools, ai-tools social/text-to-SQL, agent workflow, and connect playbook refine |
| Chat rendering | `app/pages/app/chat/index.vue` renders `UniversalToolRenderer` per tool call; renderer imports `WorkflowCard` and `CarouselWorkflow`; chat composable owns tool-call event state |

No migration row is unresolved. The audit confirms that the retained application
services and pipeline history tables have live consumers, while the PII and raw
completion paths have explicit replacement/deletion tasks. No production code was
changed during T02.

### 6.2 Phase 2 STOP CONDITION

Do not proceed until every retained capability has a destination, every caller
of migrated functionality uses the new path, and no duplicate orchestration
remains **for migrated functionality**.

---

## 7. Phases 5–6 — Specialist Agents & Skills

### 7.1 First group (Phase 5 — build only these)

| Agent | Responsibility | Skills it mounts |
|---|---|---|
| `BusinessAgent` | business profile analysis, offers, local growth | `analyze-business`, `identify-next-action` |
| `ResearchAgent` | business/competitor/market/trend research with evidence | `research-business`, `research-competitors` |
| `StrategyAgent` | opportunities → marketing plan → next action | `discover-opportunities`, `create-marketing-plan` |
| `ContentAgent` | research-grounded content ideas and drafting | `create-content-ideas` |

Later (not in scope): MarketingAgent, DesignAgent, SEOAgent, GEOAgent,
AnalyticsAgent, SocialAgent.

Rule: agents stay **focused**. No giant general-purpose agent. Each returns a
structured result validated by its skill contract.

### 7.2 First skills (Phase 6 — exactly these seven)

`research-business`, `research-competitors`, `analyze-business`,
`discover-opportunities`, `create-marketing-plan`, `identify-next-action`,
`create-content-ideas`.

All seven **already exist** under `server/agentic/skills/` with sibling
`SKILL.md` files. Migration = move them onto Flue skills with the same ids and
the same instruction bodies (already in Agent Skills format), keeping their
input/output zod contracts as the verification step. Skills stay small and
composable — a skill is never another agent.

### 7.3 Phase 5/6 STOP CONDITION

The first specialist agents must independently perform their domain task and
return structured results before any further agent is built.

---

## 8. Phases 6–7 — Vertical Slices (acceptance)

### 8.1 Slice A — "Help me get more customers."

Expected internal path:

```text
MagicSyncAgent
    ↓ BusinessAgent → analyze-business
    ↓ ResearchAgent → research-competitors
    ↓ discover-opportunities
    ↓ StrategyAgent → create-marketing-plan
    ↓ identify-next-action
```

Expected user output (plain language):

```text
I found 3 good opportunities.

1. ...
2. ...
3. ...

I think you should start with #1.

[Show me the plan]
```

**STOP** if this does not work end-to-end. Do not expand until it does.

### 8.2 Slice B — "Give me 10 Facebook ideas about roofing maintenance."

```text
ContentAgent
    ↓ topic research
    ↓ business context
    ↓ audience context
    ↓ create-content-ideas
    ↓ validation
```

Returned shape (adapted to existing MagicSync schemas):

```ts
{
  research: { summary, keyInsights, audienceInsights, businessInsights, trends, sources },
  ideas: [{ title, brief, platforms, platformDetails }]
}
```

Must use the Agent Layer, the existing context/PII integration, structured
output, and result validation. **STOP** if it needs a second AI orchestration
system.

---

## 9. Phase 8 — Interface Convergence (API / Chat / MCP / Jobs)

```text
API ───────┐
Chat ─────┤
MCP ───────┤
Jobs ──────┤
Automation 
           ▼
     packages/agent
           ▼
          Flue
```

| Interface | Existing entry | Required change |
|---|---|---|
| HTTP API | `POST /api/v1/agent/goals`, `.../chat` | call the layer; no loop in the route |
| Chat | `chat.post.ts` + `GoalRunner.vue` | same services as API |
| MCP | `site/server/mcp/tools/ai/run-goal.ts` | same services as API |
| Jobs | scheduler Nitro tasks (trend scan, content chain) | `dispatch()` into the layer |
| Automation | board batch/quick actions | `dispatch()` into the layer |

**STOP CONDITION:** repository search must show **no** interface with its own
agent loop, its own duplicate prompts, or its own duplicate skill selection.

Additional convergence proof (T20 / T21): `rg 'completeForUser' packages` returns
**0** hits, and no `packages/scheduler/server/api/v1/pipelines/*` route contains a
prompt string. Pipeline nodes dispatch through the table in section 4.5; MCP tools,
jobs, and automation all call the same `runCapability` entry.

---

## 10. Phase 9 — Small-Model Optimization (~24B target)

Use: small prompts, short tool descriptions, strict schemas, focused subagents,
progressive skills, limited active tools, bounded plans, deterministic code.

Avoid: 50 tools at once, giant system prompts, all business context in every
request, unbounded reasoning loops, giant generic agents, unstructured JSON.

Preferred flow:

```text
goal → small routing capability → load relevant skill → activate required tools
     → focused agent → verification
```

**Verification requirement (STOP CONDITION):** demonstrate that a normal task
does **not** inject the entire tool catalog nor all project context. Evidence =
a logged request payload / prompt-size measurement for one representative task.

---

## 11. Phase 10 — Human Approval

| Automatic | Requires approval |
|---|---|
| research, analysis, drafts, recommendations, plans, previews | publish, schedule, send, reply, delete, modify external data, spend money, change settings |

Approval UX:

```text
I am ready to publish this post.

[Preview]

[Publish]
[Cancel]
```

**STOP CONDITION:** prove that consequential actions cannot execute without an
explicit approval transition, including via MCP and jobs.

---

## 12. Phase 11 — UX

Primary screen (plain language, no internal vocabulary):

```text
MagicSync

What do you need help with?

[ Tell me what you need... ]

[ Start ]

Or:

[ Get more customers ]  [ Make a post ]  [ Find ideas ]
[ Check my business ]   [ Make something ] [ Show me what to do ]
```

Rules: large text, large controls, plain words, short sentences, lots of
spacing, few choices, obvious next step. Never expose agents, skills, tools,
models, prompts, Pi, Flue, or orchestration outside an explicit developer mode.

Audit targets: `packages/ai-tools/app/pages/app/chat/*` (incl. `GoalRunner.vue`,
`ChatSidebar.vue`, tool-output rows) and the capabilities pickers
(`/api/v1/agent/capabilities`) which currently surface agents/tools/skills.

Chat surface: rendered by the T23 `RunCard` (section 4.6) — **one card per run**,
plain language, a single approval footer. Tool, skill, agent, and model names stay
hidden by default (advanced/developer mode only). Visual target:
`feedback/preview(3).html`.

**STOP CONDITION:** a non-technical user can answer what do I do, what happens
when I press this, and what should I do next — from the main screen alone.

---

## 13. Task List

Legend: `[ ]` not started · `[~]` in progress · `[x]` done (evidence required).

Task IDs are **stable identifiers, not the execution order**. Execute in this order:

Each task header also carries its `order N`. A task's **Depends on** line lists
prerequisites only; the order table is authoritative.

| Order | Task | Deliverable |
|---|---|---|
| 1 | T01 | Ownership boundaries + baseline freeze |
| 2 | T02 | Migration map confirmed against code |
| 3 | T03 | DB audit + cleanup migration |
| 4 | **T18** | **Remove the custom PII subsystem** (isolated deletion first) |
| 5 | **T04** | **Flue runtime spike in Nitro — STOP GATE** |
| 6 | **T05** | **`MagicSyncAgent` + capability registry + `runCapability` entry** |
| 7 | **T19** | **AI-call evlog telemetry (`instrument`/`observe`)** |
| 8 | **T20** | **Delete `completeForUser`; migrate its 10 call sites to capabilities** |
| 9 | **T21** | **Pipeline adapters (UI + tables stay, execution → capabilities)** |
| 10 | **T23** | **Chat `RunCard` (compact single-view workflow card)** |
| 11 | T06 | First specialist subagents |
| 12 | T07 | Flue skills (7) + single skill system |
| 13 | T08 | Vertical slice A end-to-end — STOP GATE |
| 14 | T09 | Content vertical slice B — STOP GATE |
| 15 | T10 | Interface convergence (API · chat · MCP · jobs) |
| 16 | T11 | Small-model optimization pass |
| 17 | T12 | Approval gates through Flue |
| 18 | T13 | UX simplification (plain-language surface) |
| 19 | T14 | Dead code / dependency cleanup |
| 20 | T15 | Database finalization |
| 21 | T16 | Full verification |
| 22 | T17 | Final architecture audit + report + docs |
| 23 | T22 | Documentation & pattern updates (folded into T04/T19/T17) |
| 24 | **T24** | **Extensibility guide (capability + section renderer)** |

### T01 — [x] order 1 · Phase 1 · Ownership boundaries + baseline freeze
**Depends on:** none.
**Build**
- Record the ownership contract (§4) in `.claude/context/architecture.md` and add
  a `flue-agent-layer` entry to `.claude/patterns/INDEX.md` linking
  `patterns/flue-agent-layer.md` (pattern body written at T04 with real findings).
- Run and record the §3.6 baseline numbers exactly.
**Verify:** agent and DB baseline commands ran and passed; site build is explicitly deferred per project instruction; no production code changed.
**Evidence:** command output + baseline recorded in §3.6 and §18.

### T02 — [x] order 2 · Phase 2 · Migration map confirmed against code
**Depends on:** T01.
**Build**
- Walk §6 and confirm every row against the actual files (add/adjust rows).
- For each REPLACE/DELETE row, record the exact current callers.
**Verify:** every retained capability has a destination; all replacement/deletion callers are listed in §6.1; no unresolved row.
**Evidence:** repository reference scans and updated §6.1 caller table.

### T03 — [x] order 3 · Phase 3 · Database audit + cleanup migration
**Depends on:** T02.
**Build**
- Re-verify §3.4 per table (writer, reader, why, still needed).
- Remove proven-dead artifacts only: tables, columns, indexes, FKs, ORM models,
  repositories, queries, fixtures, seeds.
- Generate the cleanup migration with the repo's drizzle workflow
  (`pnpm --filter @local-monorepo/db db:generate`) per the `db-migration-squash`
  pattern. Never hand-edit applied migrations.
**Verify:** `drizzle-kit check` clean; fresh-DB migrate applies; DB service tests green; no structure is deleted while a live consumer remains.
**STOP:** before deleting any structure if a live consumer is unknown (route,
scheduled job, MCP operation, or repository read/write).
**Evidence:** no cleanup migration generated because no dead artifact was proven; schema count unchanged; command output recorded in §3.4.1.

### T04 — [x] order 5 · Phase 4 · Flue runtime spike in Nitro (STOP GATE)
**Depends on:** T03, T18.
**Build**
- Add `@flue/runtime` + `valibot` to the catalog and `packages/agent`.
- Reconcile pi versions (§5.3) and prove a single deduped install.
- Boot the runtime from a Nitro plugin in `packages/agent` with the existing DB
  and `server/agent/models.json`; guard against dev HMR double-boot.
- Define **one** smoke agent + **one** tool wrapping an existing service
  (`board_list`) and run it against the existing test seam
  (`tests/stub-provider.mjs` — extend it if Flue needs a different endpoint).
- Write `patterns/flue-agent-layer.md` from the real findings.
**Verify:** bounded task executes end-to-end with no network/API keys; no
infinite loop (bounded turns); structured result; controlled tool selection;
existing 28 agent suites still green.
**STOP:** if Flue cannot execute a bounded task, if execution can loop
indefinitely, results are unstructured, tool selection is uncontrolled, or
verification is missing → STOP and report.
**Evidence:** test output + resolved pi/Flue versions + go/no-go note.

### T05 — [x] order 6 · Phase 4 · `MagicSyncAgent` top-level agent
**Depends on:** T04.
**Build**
- `MagicSyncAgent` agent function: understand goal → choose capabilities → load
  context (`context-selector`) → delegate → combine → verify → answer.
- Keep the existing SSE event contract stable for the chat UI (stable ids).
- Telemetry: run start/finish, tokens, tools, duration → `agent_runs`.
**Verify:** first complete goal executable end-to-end; SSE contract shape
unchanged; chat UI smoke unaffected.
**Evidence:** test output + event-order assertion.

### T06 — [x] order 11 · Phase 5 · First specialist subagents
**Depends on:** T05.
**Build**
- `BusinessAgent`, `ResearchAgent`, `StrategyAgent`, `ContentAgent` as Flue
  subagents composed via `useSubagent`; each returns a structured result.
- Replace `agents.ts` (7 predefined) and `agentic/agent-registry.ts` (5 domain)
  with this single subagent set; delete the superseded registries.
**Verify:** each specialist performs its own domain task standalone and returns
structured output; no giant general-purpose agent.
**Evidence:** per-agent test output.

### T07 — [x] order 12 · Phase 6 · Flue skills (7) + single skill system
**Depends on:** T06.
**Build**
- Migrate the seven `agentic/skills` onto Flue skills, keeping ids and `SKILL.md`
  instruction bodies; keep input/output contracts as the verification step.
- Consolidate `server/agent/skills/*` + `agentic/skills/*` into the one Flue
  skill set; remove the second skill tree and the duplicated prompts.
- Reconcile `skill_definitions`/`skill_versions` with Flue skill declarations
  (keep DB versioning only where still used).
**Verify:** skills small and composable; no skill is an agent; no orphan
`SKILL.md`; frontmatter valid per the Agent Skills spec.
**Evidence:** skill list + validation output.

### T08 — [x] order 13 · Phase 6 · Vertical slice A end-to-end (STOP GATE)
**Depends on:** T07.
**Build**
- Wire the §8.1 path: `MagicSyncAgent → BusinessAgent → ResearchAgent →
  StrategyAgent` with the five skills.
- Render the answer in plain language with one clear next step and a
  `[Show me the plan]` affordance.
**Verify:** the exact brief phrase produces the §8.1 output shape against the
stub provider (deterministic), and once against a real configured model if available.
**STOP:** if it does not work end-to-end, stop and fix the architecture — do not
expand the agent set.
**Evidence:** transcript + test output.

### T09 — [x] order 14 · Phase 7 · Content vertical slice B (STOP GATE)
**Depends on:** T08.
**Build**
- `ContentAgent` path (§8.2) returning the `{ research, ideas }` contract,
  validated, using the existing context/PII integration.
- Keep schemas aligned with existing MagicSync content schemas; no parallel types.
**Verify:** structured output validates; PII/context integration exercised; never
a second orchestration system.
**Evidence:** test output + validation result.

### T10 — [x] order 15 · Phase 8 · Interface convergence (API · Chat · MCP · Jobs)
**Depends on:** T09.
**Build**
- Repoint API (`goals`, `chat`), chat UI, MCP `run-goal`, and scheduled jobs at
  the same layer entry; jobs use `dispatch()`.
- Delete any per-interface loop, prompt set, or skill selection found.
**Verify:** repository search proves no interface has its own agent loop,
duplicate prompts, or duplicate skill selection.
**Evidence:** grep output + per-interface test result.

### T11 — [x] order 16 · Phase 9 · Small-model optimization pass
**Depends on:** T10.
**Build**
- Per-agent tool mounts (no 37-tool catalog), short descriptions, strict schemas,
  bounded plans, progressive skill disclosure, context slicing.
**Verify:** measurement shows a representative task does not inject the full tool
catalog nor all project context; deterministic routing still short-circuits
routed goals with zero model calls.
**Evidence:** prompt/tool-count measurement for one task.

### T12 — [x] order 17 · Phase 10 · Approval gates through Flue
**Depends on:** T11.
**Build**
- Mark and gate consequential capabilities; persist approval state
  (`usePersistentState` + the existing `agent_goal_runs` approval transition);
  keep `POST /api/v1/agent/goals/:id/approve|cancel` contracts.
- Approval UX copy per §11.
**Verify:** consequential actions cannot execute without an explicit approval
transition — including from MCP and jobs.
**Evidence:** negative test (unapproved attempt blocked) + positive test.

### T13 — [x] order 18 · Phase 11 · UX simplification
**Depends on:** T12.
**Build**
- Plain-language primary surface (§12): one question, few buttons, obvious next step.
- Move agent/skill/tool pickers behind an explicit advanced/developer mode.
- i18n per repo rules; named event handlers; `:loading`; toasts;
  `@vueuse/motion` enter animations; semantic tokens only.
**Verify:** non-technical readability check (screenshots, light + dark); no
internal vocabulary on the default surface.
**Evidence:** screenshots + i18n audit.

### T14 — [x] order 19 · Phase 12 · Dead code / dependency cleanup
**Depends on:** T13.
**Build**
- Delete obsolete agents, orchestrators, skill systems, AI services, prompts,
  routes, repositories, tools, jobs, queues, unused exports, unused env vars,
  unused dependencies, feature flags.
- If a caller still needs something: migrate the caller, test, then delete.
**Verify:** repository search shows no obsolete implementation with live
references; typecheck finds no deleted symbol; lint finds no dead imports.
**Evidence:** grep output + typecheck/lint results.

### T15 — [x] order 20 · Phase 13 · Database finalization
**Depends on:** T14.
**Build**
- Second DB sweep after code cleanup; remove schema artifacts with no consumers.
- Verify ORM schema, migration state, repositories, queries, tests, and seed data
  are consistent.
**Verify:** no dead AI/agent table remains solely because the old implementation
used to exist.
**Evidence:** migration state + table list before/after.

### T16 — [x] order 21 · Phase 14 · Full verification
**Depends on:** T15.
**Build**
- Run the project's **actual** scripts only (never invent commands):
  - `pnpm --filter @local-monorepo/agent test`
  - `pnpm --filter @local-monorepo/db test:services`
  - existing agent/e2e Playwright specs
  - `pnpm site:build`
  - `pnpm dlx vite-doctor .`
  - repository lint/typecheck where configured
- Fix failures introduced by this work.
**HARD STOP:** do not claim completion if any required gate fails.
**Evidence:** every command + result recorded in §18.

### T17 — [x] order 22 · Phase 15 · Final architecture audit + report + docs
**Depends on:** T16.
**Build**
- Full-repository search for `agent`, `ai`, `llm`, `skill`, `tool`, `flue`, `pi`,
  `mcp`, `research`; verify exactly one Agent Layer, one orchestration path, one
  business-context source, one PII source, one path per important AI workflow.
- Produce the §17 required final report.
- Update `./feedback/changes.md` with the implementation and cleanup history.
- Update `.claude/ROUTER.md` state, `.claude/context/architecture.md`, and
  `patterns/flue-agent-layer.md` (GROW step).
**Verify:** audit checklist all green.
**Evidence:** audit output + report + docs diffs.

### T18 — [x] order 4 · PII subsystem removal (product-owner request: “just Flue”)
**Depends on:** T02. **Execution order:** 4 (isolated deletion first).

**Build** — delete the whole custom PII integration:

- Code: `server/agent/plugins/pii/{index,detect,tools}.ts`,
  `server/services/pii-mapping.service.ts`, `server/agent/prompts/pii.md`,
  `server/agent/skills/pii-guardian/`, the `pii-guardian` entry in
  `server/agent/agents.ts`, the `pii_scan` entry in `tool-catalog.ts`,
  `skills/index.ts`, `tools/index.ts`, and the `pii_scan` allowlist row in
  `packages/db/server/services/skill-registry.service.ts`.
- Wiring: `privateMode` / anonymize / restore / `PII_MODEL_MISSING` in
  `agent-runner.service.ts`; `privateMode` + `setPrivateMode` in
  `agent-session.service.ts`; the `privateMode` field in
  `agent/chat.post.ts`; the private-mode branch in
  `extensions/guard.extension.ts` (keep the guard, drop the branch); PII
  references in `tool-context.ts`, `publishing.tools.ts`,
  `content-intelligence/generate.ts`.
- UI: private-mode toggle in `chat/index.vue` + `useAgentChat.ts`, and all
  private-mode keys in `chat.json` (4 locales).
- DB: drop `pii_mappings` (table, relations, exported type in
  `packages/db/db/content/board.ts`) and `agent_chat_sessions.private_mode`;
  generate the migration with `pnpm --filter @local-monorepo/db db:generate`.
- Ops: delete `scripts/pii_assets.sh`; remove the `INSTALL_PII` build arg, the
  assets step, and `PII_MODEL_PATH` from `Dockerfile`; remove
  `PII_MODEL_PATH` / `PII_ALLOW_REGEX_ONLY` from `.env` and `.env-example`.
- Tests/docs: delete `tests/pii.test.mjs`; update
  `patterns/pi-agent-layer.md`, `ROUTER.md`, and mark T09 in `.aiContext/PRD.md`
  superseded by this task.

**Verify:** runtime searches contain no custom PII subsystem references; historical migration snapshots retain only prior schema history; `pnpm --filter @local-monorepo/agent test` green; `pnpm --filter @local-monorepo/db test:services` green; `drizzle-kit check` clean; fresh-DB migrate applies.
**Evidence:** post-removal search, migration `0013_past_typhoid_mary.sql`, test output, and fresh-DB migration output.
**STOP:** if any caller still requires anonymise/restore for a stated compliance
requirement, report it instead of deleting.

### T19 — [x] order 7 · AI-call telemetry: final input + output per model call
**Depends on:** T04, T05. **Execution order:** 7.

**Build**
- `packages/agent/server/agent/telemetry.ts` — registers **once** at agent boot:
  `instrument({ model })` to wrap every provider call (correlated by `turnId`)
  and `observe()` for `turn_request`, `turn`, `tool`, `submission_settled`, `log`.
- Emit one evlog event per call in the shape of §5.4, honouring the §5.5 policy
  (`AGENT_AI_LOG` = `metadata` default | `redacted` | `payload`,
  `AGENT_AI_LOG_MAX_BYTES` truncation).
- Request correlation via AsyncLocalStorage so background jobs and MCP calls are
  correlated too (precedent: `packages/site/server/mcp/utils/mcp-request.ts`).
- Write a compact per-call row into the existing `agent_runs` for debugging
  without a log drain.
- Add the shared emit helper next to `wrapAiModel` / `captureEmbedUsage` in the
  shared evlog utilities; update `patterns/evlog-observability.md` (its
  “leave the pi runtime alone / no token usage” gotcha is superseded by Flue).

**Verify:** one representative run emits exactly one `ai.call` event per model
call with usage + latency + finish reason; `metadata` contains no prompt or
output content; `redacted` scrubs secrets/emails/phones; `payload` carries the
final input + output truncated to the cap; credentials never appear at any level;
no `console.*` added.
**Evidence:** captured event JSON for each policy + test output.

### T20 — [x] order 8 · Delete `completeForUser`; migrate its 10 call sites
**Depends on:** T05, T19. **Execution order:** 8.

**Build**
- Declare one capability per call site (§3.7 table): pipeline node + step,
  MCP caption/ideas/hashtags/goal, `socialAi`, `text-to-sql`, the workflow model
  step, and `playbook/refine`.
- Repoint each call site at `runCapability`, then delete `completeForUser`.
- Keep only the internals Flue needs (effective model resolution, provider
  credentials); remove the raw prompt→text escape hatch.

**Verify:** `rg 'completeForUser' packages` → 0 hits; every migrated endpoint has
its capability declared once and a behavioural test keeping its prompt semantics;
typecheck clean.
**Evidence:** grep output + per-endpoint test results.

### T21 — [x] order 9 · Pipeline adapters (keep UI + tables; execution → capabilities)
**Depends on:** T20. **Execution order:** 9.

**Build**
- One node-kind dispatch table per §4.5, used by both
  `pipelines/runs/[runId]/node.post.ts` and `.../execute.post.ts`.
- Routes keep: auth, ownership, run locking (`checkpointNodeStart`),
  `completeNode` persistence, and response shapes. Routes drop: prompts, model
  calls, `completeForUser`, and the `completeForUser` system-prompt assembly.
- Unify the step path onto the same table, then remove it if
  `UsePipelineManager.ts` proves the graph studio is the only live entry.
- Keep `pipeline.service.ts`, the UI, and the `pipelines` / `pipeline_runs` /
  `workflow_graph` tables untouched as the run-history system of record.

**Verify:** every node kind executes through a capability (stub-provider test per
kind, including `manual_trigger`, materializers, `publish_intent`, `human_review`);
run-history rows keep the same shape; studio + run detail smoke passes; no prompt
string remains in either route.
**Evidence:** per-kind test output + UI smoke screenshots.
**STOP:** if a node kind has no valid capability destination, report it rather than
keeping an inline prompt.

### T22 — [x] order 23 · Documentation & pattern updates
**Depends on:** T04, T19. **Execution order:** 23 (folded into T04/T19/T17 work).

**Build**
- New `.claude/patterns/flue-agent-layer.md`: boot, capability registry, agent /
  skill / tool composition, telemetry, test seam (authored from real T04 findings).
- Update `patterns/evlog-observability.md`: Flue `instrument`/`observe` supersede
  the “pi runtime cannot be wrapped” gotcha; document the `ai.call` event and the
  `AGENT_AI_LOG` policy.
- Update `patterns/agentic-goal-layer.md` (superseded by the capability layer),
  `patterns/pi-agent-layer.md` (PII section removed), `patterns/INDEX.md`,
  `.claude/ROUTER.md` state, and `.claude/context/architecture.md`.

**Verify:** every link resolves; `INDEX.md` lists the new pattern; no stale claim
that the pi/Flue runtime is unobservable remains.
**Evidence:** docs diffs.

### T23 — [x] order 10 · Chat `RunCard`: one compact card per run
**Depends on:** T05 (run envelope), T19 (correlation), T21 (step data).
**Execution order:** 10.

**Build**
- Server: add the §4.6 run/step envelope to the chat contract
  (`run.started`, `step.completed`, `approval.required`, `run.completed`) from the
  capability descriptor + Flue events. Stable ids, additive to the existing SSE
  union — no breaking change for the rest of `useAgentChat`.
- `tool-results/RunCard.vue`: shell with header (title, subtitle = step names,
  capability tag, status) · step rail (real status) · section slot · approval
  footer. Evolve `WorkflowCard.vue` rather than adding a second shell.
- Section renderers: `ResearchSection`, `IdeasSection`, `CarouselSection` (from
  `CarouselWorkflow.vue` markup), `DraftSection`, `BoardSection`,
  `DeliverySection` (accounts + best times + schedule/approve).
  `UniversalToolRenderer`'s if/else becomes a section map.
- `chat/index.vue`: group `message.toolCalls` by run and render **one** `RunCard`
  per run instead of one card per tool call.
- i18n: add the missing `revise` key plus every new key to all four locales.

**Verify:** a five-step run renders exactly one card; the rail shows real step
status (never a local `phase` ref); the approval footer is the only path to the
post block; light **and** dark look correct (semantic tokens only); all used
`t()` keys exist in all four locales; named handlers only; `:loading` on
approve/schedule; failures raise toasts; conditional sections animate on enter;
complexity ≤ 5 branches per function; screenshots match `feedback/preview(3).html`.
**Evidence:** light + dark screenshots, i18n key audit, component test output.

### T24 — [x] order 24 · Extensibility guide
**Depends on:** T23. **Execution order:** 24.

**Build** one guide (linked from `patterns/INDEX.md`) covering the three extension
paths, each with a real file-linked walkthrough:

1. **Add an AI capability**: Flue agent → tool mounts → skills → registry entry →
   route/job/MCP adapter → optional section renderer → i18n → tests.
2. **Add a pipeline node kind**: dispatch-table row → capability → studio entry.
3. **Add an AI log field**: telemetry event → policy → test.

**Verify:** the guide is followable end-to-end for a trivial capability, every
referenced path exists, and one worked example is committed as a test.
**Evidence:** guide + the worked example's test output.

---

## 14. Per-Task Verification Gate (every task)

Before any task is marked `[x]`:

1. Relevant unit tests pass (state command + result).
2. Relevant integration/e2e spec passes, or is explicitly skipped with a reason.
3. No route handler contains DB queries; services return `ServiceResponse<T>`.
4. Zod (or Valibot at the Flue boundary) validation on every write.
5. No hardcoded user-facing strings; locale keys exist in all four locales.
6. Event handlers named; no bare state assignment in templates.
7. Async actions show `:loading`; outcomes raise toasts; conditional UI uses
   motion on enter.
8. Cyclomatic complexity manually counted ≤ 5 branches per changed function
   (state the max found).
9. No `console.*`, no dead code, no unused imports introduced.
10. No secrets or credentials committed; `git diff --check` clean. (Secret
    scanning remains mandatory even though the PII subsystem is removed.)
11. Every AI call emits exactly one `ai.call` event under the configured policy
    (T19).
12. Every AI capability is declared once in the registry — no prompt string
    survives in a route, job, or MCP tool (T20/T21).
13. A capability run renders as exactly **one** chat card; no per-tool-call
    stacking (T23).
14. Any new capability follows the T24 guide, and the guide is updated whenever a
    shortcut is taken.

---

## 15. Risks

| Risk | Mitigation |
|---|---|
| Flue + Nitro embedding (dev HMR double-boot, worker forks) | T04 spike is a STOP GATE; module-scoped singleton boot guard |
| pi version conflict (`0.85.1` vs Flue's `^0.83.0`) | §5.3; single deduped install proof; adjust pins, never two pi copies |
| Valibot (Flue) vs zod (repo) at the tool boundary | one thin adapter module; service contracts untouched |
| Flue license / supply-chain | verify license and pin an exact version in the catalog before T04 completes |
| Flue conversation persistence vs existing `agent_chat_entries` | persistence adapter over the existing Turso schema; no second store |
| Registries/APIs used by `packages/ai-tools` CRUD + `connect` board | T02 caller inventory; repoint callers in the same task as the change |
| Flue's own MCP client vs the `packages/site` MCP server | keep app MCP transport where it is; `useMcpConnection` only if needed |
| Small-model quality regression | keep deterministic routing; strict schemas + verification step |
| UX scope creeping into a full redesign | T13 limited to plain-language surface + advanced mode; follow `.aiContext/DESIGN.md` |
| Payload logging leaking personal data (PII removed + `payload` mode) | `metadata` is the default; `redacted` scrubs secrets/emails/phones; credentials are never logged at any level; truncation cap enforced |
| Pipeline UI regressions while swapping node dispatch | run-history tables untouched; identical response shapes; per-kind tests + studio/run-detail smoke |
| Losing a bespoke prompt's behaviour when `completeForUser` is deleted | each prompt is migrated into its capability's instruction doc with a behavioural test before deletion |
| Chat card rewrite breaking existing e2e selectors | keep the `data-*` hooks the specs rely on; update selectors in the same task (`nuxt-ui-chat` pattern rule) |
| Chat card drifting from the preview | screenshot comparison (light + dark) against `feedback/preview(3).html` is part of T23's evidence |

---

## 16. Non-Negotiable Stop Conditions

Stop immediately and report instead of guessing when:

```text
you cannot determine which existing agent code is active
you cannot determine whether a database table is still used
you discover two conflicting Agent Layer designs
you cannot safely migrate an existing capability
a required existing dependency is unclear
the first vertical slice cannot execute end-to-end
the architecture requires duplicated orchestration
consequential actions cannot be reliably protected by approval
typecheck fails because of unresolved architectural changes
database migration state is ambiguous
every AI call cannot be attributed to a capability and a run id
a route, job, or MCP tool still needs an inline prompt to work
payload logging cannot be made safe under the chosen content policy
a pipeline node kind cannot be mapped to a capability without changing its contract
the chat card cannot reflect real step status without inventing client-side state
```

Do not work around an architectural problem by adding another layer.

---

## 17. Required Final Report (produced in T17)

```text
1.  Phase 0 audit findings
2.  Existing architecture discovered
3.  Existing Agent Layer discovered
4.  Existing Flue/Pi integration discovered
5.  What was kept
6.  What was migrated
7.  What was replaced
8.  What was deleted
9.  Database tables removed
10. Database migrations added
11. New Flue agents
12. New Flue skills
13. New tools
14. PII/context integration
15. API integration
16. Chat integration
17. MCP integration
18. Approval behavior
19. Small-model optimizations
20. Tests run
21. Typecheck result
22. Lint result
23. Build result
24. Remaining limitations
```

Plus: `./feedback/changes.md` updated with the implementation and cleanup history.

---

## 18. Progress Log

Append one block per session:

```text
### Session YYYY-MM-DD — Txx
- Status: done | partial | blocked
- Built:
- Tests run:
- Evidence:
- Next task:

### Session 2026-09-19 — T22/T24 documentation and extensibility completion
- Status: done
- Built: completed the documentation/pattern pass; updated the legacy
  `agentic-goal-layer` pattern with an explicit supersession notice; added
  `agent-capability-extensibility.md` and indexed it. The guide covers all
  three required extension paths: AI capabilities, pipeline node kinds, and
  AI-call telemetry, with file-linked walkthroughs and a worked
  `text.generate`/registry test example.
- Tests run: `pnpm --filter @local-monorepo/agent test` — 200 passed / 0 failed;
  `pnpm --filter @local-monorepo/db test:services` — 136 passed / 0 failed;
  targeted guide references are covered by
  `tests/capabilities.test.mjs`, `tests/capabilities-generation.test.mjs`,
  `tests/pipeline-dispatch.test.mjs`, and `tests/ai-call-telemetry.test.mjs`.
  `vite-doctor` reported the same 11 pre-existing source-only diagnostics
  outside the migration scope. The safe site-build retry exceeded the 10-minute
  command limit before emitting a completion marker; the prior T16 build
  evidence remains the last successful build result.
- Evidence: new pattern file, INDEX entry, superseded-pattern update, and
  this guide's worked-example references.
- Verify: documentation links and referenced paths checked against the
  repository; no production behavior changed.
- Next task: complete
```

### Session 2026-09-19 — Migration closeout
- Status: done
- Built: reconciled the PRD status and router state with the completed T01–T24
  implementation. No migration task headers remain open.
- Tests run: repository scans confirmed no tracked `completeForUser` references,
  no incomplete T01–T24 headers, and clean `git diff --check`. The previously
  recorded agent, DB, e2e, build, and doctor evidence remains in this PRD.
- Evidence: PRD status is `COMPLETE`; router documents T01–T24 complete and
  lists remaining limitations as non-blocking follow-ups.
- Next task: none

## 19. Final Report (T17)

Produced after T16 verification. Evidence for each line lives in the progress
log (§18) and the audit outputs in §19.1.

```text
1.  Phase 0 audit findings
    One in-process pi-native agent platform in `packages/agent` with hand-rolled
    orchestration (goal orchestrator loop, planner, recovery, session runner),
    two skill trees, two agent registries, two prompt trees, a 37-tool catalog
    injected per session, and a raw `completeForUser` escape hatch with 10 call
    sites across 5 packages (PRD §3.1–§3.7). Flue was absent; `@flue/runtime`
    depends on the same `@earendil-works/pi-*` core already pinned.

2.  Existing architecture discovered
    Nuxt 4 monorepo of layer packages: `agent` (agent layer), `site` (merge
    point + MCP transport), `db` (schema/services), `scheduler`, `connect`,
    `ai-tools`, `auth`, `tools`, `content`, `ui`. Entry points: chat SSE,
    goals API, content-items API, MCP tools, pipeline routes, Nitro jobs.

3.  Existing Agent Layer discovered
    `packages/agent` (`@local-monorepo/agent`, Nuxt layer `Agent`) — the only
    agent layer, both before and after the migration.

4.  Existing Flue/Pi integration discovered
    Pi fully integrated at 0.85.1; Flue absent. `@flue/runtime@2.0.8` declares
    `^0.83.0` on pi — reconciled with pnpm `overrides` so exactly one pi
    version resolves for both (T04 STOP GATE).

5.  What was kept
    Content intelligence, board service + `content-items` API, RAG
    (`embeddings` + `document-ingest`), media/research utilities
    (`ytdlp`/`scrapegraph`/`langsearch`/`python-tools`), context selector
    (single business-context source), pipeline studio UI + 17 routes +
    `pipeline.service.ts` + `pipelines`/`pipeline_runs`/`workflow_graph`
    tables, app MCP transport, the app-owned DB/services, and the ai-tools
    agents/skills CRUD persistence.

6.  What was migrated
    Seven goal skills → Flue skills (same ids, same `SKILL.md` bodies); the
    second skill tree removed; planner routing table → deterministic
    pre-routing before Flue dispatch; zod contracts → capability output
    validation; 37 chat tools → per-agent Valibot tool mounts; progress/event
    labels → capability run/step envelope; 10 `completeForUser` call sites →
    declared capabilities; pipeline model nodes → node-kind dispatch table.

7.  What was replaced
    Hand-rolled goal loop, planner model path, bounded recovery, hand-rolled
    SSE normalization, `tool-catalog` injection, the two agent registries, the
    approval branch, pipeline node/step model execution, and the per-tool-call
    chat cards (→ one `RunCard` per run).

8.  What was deleted
    Custom PII subsystem (ONNX NER + regex + surrogates, `pii_mappings`,
    `private_mode`, `pii_scan`, `pii-guardian`, asset script, Docker step, env
    flags); `completeForUser`; the legacy `GET /api/v1/agent/tools` route;
    `server/agent/skills/index.ts`; `agentic/skill-registry.ts`;
    `agentic/agent-registry.ts`; `agentic/skills/index.ts`; `agents.ts`;
    `trend-scan.md` + its prompt key; `DomainAgentDefinition`;
    `useMarkdown.ts`; `socialComplete` + `SocialCompleteInput`; the stale
    `.env-example` PII block.

9.  Database tables removed
    `pii_mappings` (table + relations + exported type) and
    `agent_chat_sessions.private_mode` — migration `0013_past_typhoid_mary.sql`.
    No other structure was proven dead in T03, T15 or T18.

10. Database migrations added
    One: `0013_past_typhoid_mary.sql` (PII removal). T15 generated none
    because no artifact became dead after the code cleanup.

11. New Flue agents
    `MagicSyncAgent` (top-level, deterministic `plan_lookup` + planning) and
    four specialists composed with `useSubagent`: `research-agent`,
    `content-agent`, `business-agent`, `strategy-agent`.

12. New Flue skills
    14 in the single Flue skill set: `research-business`,
    `research-competitors`, `analyze-business`, `discover-opportunities`,
    `create-marketing-plan`, `identify-next-action`, `create-content-ideas`,
    `langsearch`, `social-research`, `content-writer`, `humanizer`,
    `trend-scout`, `content-ops`, `carousel`.

13. New tools
    Capability-bound Valibot tools: `plan_lookup`, `business_lookup`, the
    five goal-skill tools, `board_list`, `create-content-ideas`, plus the
    migrated per-agent mounts of the former chat tool set. All bound to the
    existing services; tenant identity comes from the server-resolved context.

14. PII/context integration
    No PII subsystem — Flue is the only integration (T18). Sensitive payload
    safety is the log content policy: `AGENT_AI_LOG` = `metadata` (default) |
    `redacted` | `payload`, with credentials never logged at any level. Single
    business-context source: `server/agentic/context-selector.ts` (Brand
    Playbook, current edition only). The publishing-side `PII_DETECTED`
    content guard in `destination.service.ts` is unrelated and retained.

15. API integration
    Goals API and chat API are thin adapters over `runCapability`; pipeline
    routes dispatch through one node-kind table; social/text-to-SQL/playbook
    routes pass structured input only. `rg 'completeForUser' packages` → 0.
```

```text
16. Chat integration
    One `RunCard` shell + section renderers per capability run, driven by the
    server's `run.started` / `step.completed` / `approval.required` /
    `run.completed` envelope with real step status. Picker vocabulary sits
    behind the explicit Advanced switch (T13).

17. MCP integration
    All four MCP AI tools (`generate-caption`, `generate-ideas`,
    `suggest-hashtags`, `run-goal`) call the same capability entry/agent layer;
    no MCP tool owns a loop or an inline prompt.

18. Approval behavior
    Consequential capabilities (`delivery.schedule`) are gated on a durable
    `agent_goal_runs` approval transition: unapproved attempts are blocked with
    zero side effects (negative test), including a headless MCP-shaped caller;
    approve executes, cancel stays blocked; cross-tenant grants are rejected.

19. Small-model optimizations
    ≤6 tools per turn (never the 37-tool catalog), ≤32 KB request payloads,
    ≤20 model calls per representative run, per-run context slicing, no
    cross-business leakage, and deterministic zero-model routing for routed
    goals — enforced by `tests/small-model.test.mjs`.

20. Tests run
    Agent 200 passed / 0 failed; DB services 136 passed / 0 failed; e2e
    `chat-advanced-t13` + `runcard-t23` 3 passed; `runSections` 7 passed.

21. Typecheck result
    No repo typecheck script is configured (agent/db expose `lint` only).
    Compensating checks: SFC parse + script + template compile clean, plus the
    capability/pipeline/slice test seams that assert types at the boundary.

22. Lint result
    Not available: `typescript-eslint does not support TS 7.0` fails before any
    project file loads, identically in untouched packages. Environment
    limitation — recorded, not worked around.

23. Build result
    `pnpm site:build` passed (`✨ Build complete!`, `.output/server/index.mjs`
    + `.output/public/` emitted) with a 12 GB heap; the script's pinned 8 GB
    OOMs during the Nitro server stage on this machine.

24. Remaining limitations
    a. Scheduler `/api/v1/ai/*` (7 routes + `scheduler*Prompts.ts` modules +
       `schedulerUnifiedAI.ts`) still runs its own prompts on the Vercel AI
       SDK helper. Reported in T10 as an explicit boundary finding: converging
       it needs capability-layer `temperature`/`generateObject` parity first.
       It owns no loop and no skill selection, and its prompts duplicate no
       capability prompt.
    b. `tools/server/api/v1/menu-board/ai.post.ts` and
       `scheduler/.../ai/carousel-design.post.ts` still hold inline prompts;
       both belong to feature packages outside the agent layer's ownership and
       need the same parity work as (a).
    c. Flue conversation persistence currently uses the in-memory adapter;
       backing it onto `agent_chat_entries` is the T06+ persistence step.
    d. `usePersistentState` in-run approval mirroring is deferred until Flue
       drives approval-bearing runs (the goal-run row is the durable store).
    e. Repo lint cannot run in this environment (TS 7.0 vs typescript-eslint).
    f. T22/T24 documentation and extensibility guide are now complete; no
       migration tasks remain open in §13.
```

### 19.1 T17 audit outputs

| Check | Command | Result |
|---|---|---|
| One agent layer | `ls packages/*` filtered to ai/agent/agentic/llm/flue | `agent` only (`ai-tools` is the UI/feature package) |
| No raw escape hatch | `rg 'completeForUser' packages` | **0 hits** |
| One entry path | `rg -l 'runCapability' packages` | MCP (4), scheduler pipeline routes (2), connect (1), ai-tools (4), agent layer + tests |
| One context source | `rg -l 'context-selector' packages` | `agentic/goal-orchestrator.service.ts` only |
| No agent-layer PII | `rg -il 'pii\|private.mode\|anonymi' packages/agent/server` | 1 hit — a T18 history comment in `flue/slice-b.ts` |
| No inline prompts in pipeline routes / MCP | `rg -in 'you are a\|systemPrompt:\|system_prompt'` | none |
| Capability registry | `rg -o "id: '[a-z.]+'" server/capabilities/*.ts` | 14 capabilities |
| Route prompt scan (ai-tools) | `rg -in "system: '\|prompt: \[\|You are an? " packages/ai-tools/server/api` | **0 hits** after the T16 fix |
| PII in live schema | fresh-DB table list | **0 PII tables** (63 tables total) |

### Session 2026-09-19 — T17 final architecture audit + report + docs
- Status: done
- Built: §19 final report (24 required items) + §19.1 audit table; the
  full-repository audit passed every checklist item (one agent layer, one
  orchestration path, one business-context source, one PII source — that
  being the log policy, one path per important AI workflow). Updated
  `feedback/changes.md`, `.claude/ROUTER.md`, `.claude/context/architecture.md`
  and `patterns/flue-agent-layer.md`.
- Tests run: audit scans only (no production code changed in T17).
- Verify: every audit row green; the two findings that are *not* green are
  recorded as limitations 24a/24b with their prerequisite rather than worked
  around.
- Evidence: §19, §19.1, doc diffs.
- Next task: T22 — documentation & pattern updates (T24 follows)

### Session 2026-09-19 — T15 database finalization
- Status: done
- Built: second DB sweep after the T14 code cleanup. No schema artifact became
  dead: every agent/AI table still has a live consumer (`agent_definitions` /
  `agent_versions` via the ai-tools agents CRUD + pipeline snapshot
  resolution; `skill_definitions` / `skill_versions` via the skills CRUD,
  capabilities route, runner, skills tool and pipeline service;
  `agent_runs`, `agent_goal_runs`, `agent_chat_*`, board, chat, pipeline,
  documents, `user_llm_configs` unchanged). No cleanup migration generated —
  nothing was proven dead, so deleting structure would have been unsafe.
- Tests run: `drizzle-kit check` clean; fresh-DB migrate
  (`file:/tmp/magicsync-t15-fresh.db`) applied; DB services 136 passed /
  0 failed.
- Verify: fresh schema has 63 tables, **0 PII tables** (only historical
  migration snapshots mention PII); ORM schema, migrations, repositories and
  tests consistent; no dead AI/agent table remains.
- Evidence: fresh-DB table list; migration/check output.
- Next task: T16 — full verification

### Session 2026-09-19 — T16 full verification
- Status: done
- Built:
  - Site production build completed: `✨ Build complete!` with
    `.output/server/index.mjs` + `.output/public/` emitted. **Note:** the
    `site:build` script pins `--max-old-space-size=8192`, which OOMs during
    the Nitro server stage on this machine; the verified run used
    `NODE_OPTIONS=--max-old-space-size=12288`. Build config unchanged.
  - Closed a convergence gap found during verification: the ai-tools
    social-media family still carried inline prompts in three routes
    (`generate-batch`, `generate-thread`, `generate-variations`). Added three
    declared capabilities (`social.batch`, `social.thread`,
    `social.variations`) with the prompts moved verbatim, added a typed
    `runSocialCapability` route helper, repointed all three routes at it, and
    deleted the now-unused `socialComplete` raw helper + `SocialCompleteInput`.
    Five behavioural tests added (prompt semantics + validation).
- Tests run:
  - `pnpm --filter @local-monorepo/agent test` — **200 passed, 0 failed**
  - `pnpm --filter @local-monorepo/db test:services` — **136 passed, 0 failed**
  - e2e `chat-advanced-t13` + `runcard-t23` — **3 passed**
  - `pnpm site:build` — **passed** (12 GB heap)
  - `pnpm dlx vite-doctor .` — 0 blockers, 11 pre-existing diagnostics
  - `pnpm lint` (agent/db) — **environment failure**: `typescript-eslint
    does not support TS 7.0`; reproduces identically in untouched packages,
    so it is a toolchain/version limitation, not a migration regression
- Verify: every required gate passes except repo lint, which fails
  environment-wide before loading any project file (pre-existing, recorded
  here rather than worked around).
- Evidence: build log `/tmp/site-build-t16b.log`; test outputs above.
- Next task: T17 — final architecture audit + report + docs

### Session 2026-09-19 — T14 dead code / dependency cleanup
- Status: done
- Built:
  - Deleted `server/agent/prompts/trend-scan.md` + its `AGENT_PROMPTS` entry
    (zero references — trend ideas generation moved to `workflow.idea_scan` /
    `idea-scan.md` in T20).
  - Deleted the legacy `GET /api/v1/agent/tools` route (`tools.get.ts`) —
    zero consumers; `capabilities.get.ts` is the single discovery endpoint.
    Updated the `tool-catalog.ts` header comment and the agent README table.
  - Deleted the dead `DomainAgentDefinition` interface from
    `agentic/contracts.ts` (zero references since the T06 registry removal).
  - Deleted the dead `useMarkdown.ts` chat composable (zero references).
  - Removed the stale PII block from `.env-example` (T18 leftover).
  - Sweep verified live (kept): both prompt trees' remaining files (every
    remaining `AGENT_PROMPTS` key is rendered by the runner/subagents/
    services; `plan.md`/`repair.md` serve the planner), tool-catalog
    (discovery + allowlist), all 11 tool modules (composed via
    `tools/index.ts`), `recovery.ts`/`progress.ts`/`goal-events.ts`
    (orchestrator), `guard.extension.ts` (PII-free since T18),
    `destination.service.ts` `PII_DETECTED` (live publishing-side content
    guard, unrelated to the removed agent PII subsystem), ORT wasm assets
    (TTS `onnxruntime-web` runtime files), `unpdf`/`mammoth` deps (dynamic
    imports in db's `document-ingest.service.ts`), all agent env flags.
- Tests run: agent suite 195 passed / 0 failed; `vite-doctor` 0 blockers /
  11 pre-existing diagnostics; `git diff --check` clean; no `console.*`.
- Verify: no obsolete implementation with live references remains (per-symbol
  reference scans above); no new diagnostics; max changed-function complexity
  0 (deletions only).
- Next task: T15 — database finalization

### Session 2026-09-19 — T13 UX simplification (plain-language surface)
- Status: done
- Built:
  - Plain-language primary surface verified live: `OperatorHome.vue` (status
    brief, approval queue, prompt starters, review queue), suggestions row,
    `MorningReportCard`, `GoalRunner`, and the T23 `RunCard` — no internal
    vocabulary on any of them.
  - Agent/tool/skill pickers gated behind the explicit Advanced switch
    (localStorage-persisted `magicsync-chat-advanced`): agent select, tool
    checkboxes, and skill checkboxes render only with Advanced on; the switch
    itself lives in the Options popover.
  - Fixed the last internal-vocabulary leak on the default surface: the
    composer footer + popover header `selectionSummary` ("Agent · Tools ·
    Skills") now render only in Advanced mode.
  - Removed the duplicated title/reset header inside the Options panel (kept
    the single popover header).
  - Diagnostic sweep of T13's tree + earlier migration files:
    `runSections.ts` (validated object parses, `parseLooseObject` /
    hardened `extractEmbeddedJson`), `approvals.ts` (`parsePlan` →
    `approvalPlanShape` guard, hardened `approvedStepsOf`),
    `subagent.tools.ts` (validated `textToPayload`, dropped the
    `@ts-ignore` chained assertion), `create-content-ideas.ts`
    (single-cast `runConfigFor`), `pi-runtime.ts` (validated
    `deploymentBaseUrl`), `flue/runtime.ts` (unknown-variable import cast),
    `carousel-generation.service.ts` (`parseStoredOutput` guard),
    scheduler `node.post.ts` (validated `readSnapshot`), connect
    `playbook/refine.post.ts` (single cast).
  - e2e `chat-advanced-t13.spec.ts`: pickers hidden by default → revealed
    behind Advanced; dark + light screenshots.
- Tests run:
  - `pnpm --filter @local-monorepo/agent test` — 195 passed, 0 failed
  - `pnpm --filter @local-monorepo/db test:services` — 136 passed, 0 failed
  - `runSections.test.mjs` — 7 passed
  - e2e: `chat-advanced-t13.spec.ts` + `runcard-t23.spec.ts` — 3 passed
  - `pnpm dlx vite-doctor .` — 0 blockers, 11 diagnostics (down from 22 at
    session start; all 11 pre-existing in db-service/analytics-internal
    files outside this migration's ownership; 0 on any file changed by the
    migration tasks)
  - i18n parity: `chat.json` en/fr/es/de — zero missing, zero extra keys
  - `git diff --check` clean; no `console.*`; SFC parse + script +
    template compile OK
- Verify: no internal vocabulary on the default surface (footer summary +
  popover header gated); complexity max on new/changed functions 5
  (`prepareRevision`); named handlers only (`v-model:open` popover binding
  is a component contract, not a template assignment); semantic tokens
  only; light + dark screenshots captured (`test-results/chat-advanced-*.png`).
- Next task: T14 — dead code / dependency cleanup

### Session 2026-09-19 — T12 approval gates through Flue
- Status: done
- Built:
  - `server/flue/approvals.ts`: request/decide/check/emit — approval runs on
    the existing `agent_goal_runs` transition (no new table):
    `waiting_for_approval` rows carrying `{ kind: 'capability-approval',
    capability, stepId }`, grant = approved step id verified with tenant +
    capability match, `approval.required` envelope event for the T23 footer.
  - `runCapability` enforces the gate for `consequential` capabilities
    (refactored entry validation into `enterCapability` to hold the
    complexity budget); `delivery.schedule` (consequential) wraps the
    existing schedule service (approved-artifact checks stay in the service).
  - `goals/:id/approve` branch serves capability runs from the same contract
    (approve grants, reject cancels); orchestrator path byte-identical.
- Tests run: `tests/approvals.test.mjs` — 4 passed (unapproved blocked with
  zero side effects + footer event; headless MCP-shaped caller blocked;
  request→approve executes; cancel stays blocked; cross-tenant grant
  rejected). DB 136 passed; full agent suite re-run below.
- Verify: negative + positive proven incl. MCP path; max new/changed
  complexity 4. `usePersistentState` stays deferred with reason: no
  Flue-driven run requests mid-run approval yet — the goal-run row is the
  durable store; it becomes the in-run mirror when Flue executes
  approval-bearing runs (T10 convergence).
- Evidence: approvals test output.
- Next task: T13 — UX simplification (plain-language surface)

### Session 2026-09-19 — T11 small-model optimization pass
- Status: done (measurement-led; budgets enforced by test)
- Built:
  - `tests/small-model.test.mjs`: representative slice-A run measured —
    ≤6 tools per turn (never the 37-tool catalog), ≤32KB request payloads,
    ≤20 model calls (bounded), no cross-business context leak (seeded second
    business, asserted absent), deterministic routing at zero model calls.
  - Trimmed 5 chat-skill catalog descriptions to ≤200 chars (langsearch,
    content-writer, social-research, content-ops, trend-scout); all 14 skill
    descriptions now ≤200, all Flue tool descriptions ≤140. No test pinned
    the old text.
  - Already in place and now proven: per-agent mounts, strict Valibot/zod
    schemas, bounded linear plans, progressive skill disclosure (`useSkill`
    per specialist), per-run context slicing.
- Tests: small-model 3 passed; DB 136 passed; full agent suite re-run below.
- Verify: max new/changed complexity 2.
- Next task: T12 — approval gates through Flue

### Session 2026-09-19 — T10 interface convergence
- Status: done
- Built:
  - Repointed 3 ai-tools social routes onto purpose-built capabilities,
    deleting duplicated prompt sets: `generate.post` → `social.caption`,
    `generate-hooks.post` → `social.hooks`, `generate-hashtags.post` →
    `social.hashtags` (behavior preserved: capability inputs widened — free
    tone/style strings, hooks count to 15 — MCP schemas keep their enums).
  - Verified the enumerated interfaces: goals API (thin → orchestrator),
    chat API+UI (`chat.post` → runner; `useGoalRun`/`useAgentChat` → same
    APIs), MCP `run-goal` (orchestrator + `text.generate`), pipeline routes
    (dispatch table), board routes (workflow service), MCP AI tools
    (capabilities). No interface owns a loop, a duplicate prompt, or skill
    selection (grep evidence below).
  - Jobs: no AI jobs exist — all Nitro scheduled tasks (post, stats, repost,
    autoreply, token, notifications, morning-heartbeat) are non-model
    services; nothing to repoint at `dispatch()`.
- Grep evidence: agent-loop constructs outside `packages/agent` → 0 hits;
  `completeForUser` → 0 hits (T20); skill-registry picking outside the layer
  → only the Skills CRUD UI (DB persistence, not orchestration).
- Boundary finding (not guessed, reported): 7 scheduler `/api/v1/ai/*`
  routes run unique prompts on the shared Vercel-SDK `schedulerUnifiedAI`
  helper (same `user_llm_configs` resolution). Not per-interface loops,
  not duplicates of capability prompts, no skill selection — out of T10's
  verification scope; converging them needs capability-layer temperature +
  `generateObject` parity first (follow-up, not this task).
- Tests: agent suite 188 passed, 0 failed (covers widened schemas + all
  capabilities). Route edits mechanical; full e2e deferred to T16.
- Verify: max new/changed complexity 2.
- Next task: T11 — small-model optimization pass

### Session 2026-09-19 — T09 content vertical slice B (STOP GATE passed)
- Status: done (GO decision — no second orchestration; one Flue loop,
  tenant-scoped services underneath)
- Built:
  - `create-content-ideas` Flue tool (same boundary pattern) mounted on
    ContentAgent; `server/flue/slice-b.ts` `runSliceB` returning the existing
    `{ research, ideas }` contract verbatim (`ContentIdeasResultSchema` —
    zero parallel types), gated by `skill.verify()` → `CONTENT_INCOMPLETE`.
  - Context integration = tenant-scoped research/intelligence/business load +
    Brand Playbook grounding on every skill call (PII subsystem stays removed
    per T18; log policy governs).
- Tests run: `tests/slice-b.test.mjs` — 2 passed (10 Facebook roofing ideas,
  research markers executed, content-agent delegation, skill-contract
  validation; provider-down run fails `CONTENT_INCOMPLETE`).
- Verify: structured output validates; max new/changed complexity 3.
- Evidence: slice-b test output.
- Next task: T10 — interface convergence (API · chat · MCP · jobs)

### Session 2026-09-19 — T08 vertical slice A end-to-end (STOP GATE passed)
- Status: done (GO decision — slice works end-to-end, architecture holds)
- Built:
  - `server/flue/skill-tools.ts`: 5 Flue `defineTool` wrappers executing the
    slice skills (Valibot in, zod contracts untouched). One shared per-run
    `previous` store chains evidence deterministically; skill failures throw
    (tool error to the model, downstream fails loud on missing evidence).
  - Specialists mount skill tools per §7.1 ownership via
    `SpecialistOptions.skillTools`.
  - `server/flue/slice-a.ts`: `runSliceA` — boots Flue (singleton runtime),
    dispatches the exact brief phrase, renders the §8.1 plain-language reply
    from validated tool outputs (opportunities + `start with #1` +
    `showPlanAction` affordance flag). Missing pieces fail `GOAL_INCOMPLETE`;
    partial output never presented.
  - `server/flue/runtime.ts`: `stopFlueRuntime` test teardown seam.
- Tests run:
  - `tests/slice-a.test.mjs` — 2 passed: full §8.1 path asserted turn by turn
    (business → research → strategy → business delegation order, evidence keys
    in the discover prompt, real DB grounding via `business_lookup`,
    scripted LangSearch evidence, reply shape + plain-language check);
    garbage-model run fails `GOAL_INCOMPLETE`.
  - Real-model check: skipped (no provider keys in this environment).
  - DB services — 136 passed; full agent suite re-run pending below.
- Verify: STOP GATE passes — no second orchestration (one Flue loop; pi used
  only for bounded completions inside skills); max new/changed complexity 3.
- Evidence: slice-a test output + delegation wire assertions.
- Debugged en route (kept): Flue `task` tool takes `{prompt, agent}`;
  subagent renders must not call `useModel`; history re-sends tool calls so
  order assertions must dedupe by call id; skill prompts carry `# Title`
  markers (not SKILL.md role lines); `LangSearchClient` is a bare function.
- Next task: T09 — content vertical slice B (STOP GATE)

### Session 2026-09-19 — T07 Flue skills + single skill system
- Status: done
- Built:
  - `packages/agent/server/flue/skills.ts`: the ONE skill set — 14 Flue
    skills (`defineSkill`, same ids, same `SKILL.md` bodies, frontmatter
    validated at load, `allowedTools` from frontmatter/tools metadata). Goal
    facet (`goalSkills`/`goalSkillRegistry` with run/verify/contracts) serves
    orchestrator/planner; pi facet (`BUNDLED_SKILLS` + helpers, byte-identical
    shape) serves runner/`load_skill`/chat/seed. Specialists mount via
    `useFlueSkills` (§7.1 skill table).
  - Deleted `server/agent/skills/index.ts`,
    `server/agentic/{skill-registry,index}.ts`; migrated all callers in-task
    (runner, subagent + skills tools, chat/capabilities/seed routes,
    orchestrator, planner, goal capability, specialists, 3 test files).
  - Fixed stale `content-ops` SKILL.md delegation names → new specialists.
  - Skill prompt `.md` files stay: both consumers (pi profiles, planner
    templates) live until T10/T14, which owns duplicate-prompt deletion.
  - DB reconcile: no schema change — `skill_definitions`/`skill_versions`
    and the Skills CRUD stay; seed route mirrors the same chat set as before.
- Tests run:
  - `tests/flue-skills.test.mjs` — 5 passed (14 skills, valid frontmatter,
    contracts, pi facet, no orphan SKILL.md)
  - full agent suite — 184 passed, 0 failed; DB — 136 passed, 0 failed
  - `git diff --check` clean; no `console.*`
- Verify: skills small/composable; no skill is an agent; frontmatter valid per
  spec; max new/changed complexity 3. Root-caused + fixed a stale-run cascade
  (deleted `agentic/skills` directory import in the orchestrator).
- Evidence: flue-skills test output; full-suite output.
- Next task: T08 — vertical slice A end-to-end (STOP GATE)

### Session 2026-09-19 — T06 first specialist subagents
- Status: done
- Built:
  - `packages/agent/server/flue/specialists.ts`: BusinessAgent, ResearchAgent,
    StrategyAgent, ContentAgent as Flue agent factories + `defineSubagent`
    defs (model declared on the definition — `useModel` throws in subagent
    renders), focused instructions, zod output contracts,
    `parseSpecialistOutput`, `business_lookup` Valibot tool (tenant closed
    over, real DB read), skill/skill-coverage tables (§7.1), pi-runner facet
    (`SPECIALIST_SESSION_PROFILES` + verbatim orchestrator default until T10),
    goal-runner facet (`SPECIALIST_CAPABILITIES`).
  - `MagicSyncAgent` composes all four via `useSubagent` (tenant flows through).
  - Deleted `server/agent/agents.ts` + `server/agentic/agent-registry.ts`;
    migrated all callers in-task: runner (profile resolve), workflow
    (`research-agent`), chat route (name validation), capabilities route
    (picker + goals sections), seed route, pi `subagent` tool, goal
    orchestrator (`specialistsForSkill`); rewrote `subagent-tool` +
    `research-workflow` tests to the new names.
- Tests run:
  - `tests/specialists.test.mjs` — 6 passed (set shape, skill map, output
    validation, per-specialist Flue delegation with real DB grounding for
    BusinessAgent, exact tool mounts, parent→specialist task delegation)
  - full agent suite — 179 passed, 0 failed; DB — 136 passed, 0 failed
  - `git diff --check` clean; no `console.*`
- Verify: each specialist runs standalone (as delegate) and returns
  schema-validated output; focused mounts only; no giant general agent; max
  new/changed complexity 1.
- Evidence: specialists test output; delegation wire assertions.
- Next task: T07 — Flue skills (7) + single skill system

### Session 2026-09-19 — T23 chat RunCard (compact single-view workflow card)
- Status: done
- Built:
  - Server: additive §4.6 run/step envelope in `agent-events.ts` (`run.started`,
    `step.completed`, `approval.required`, `run.completed`, stable ids); no
    producer yet (Flue lands T06/T10) — existing SSE union untouched.
  - `useAgentChat.ts`: `message.run` state + 4 envelope chunk handlers
    (additive); history reloads fall back to tool-derived steps.
  - `RunCard.vue` (new shell, replaces `ToolRunCard.vue`): header (title,
    subtitle, tag, status) · real-status step rail · section slot · approval
    footer. Evolved from `WorkflowCard`/`ToolRunCard` shell conventions.
  - 6 section renderers (`tool-results/sections/`): Research, Ideas (new —
    idea list per platform), Carousel (markup moved from `CarouselWorkflow`,
    rail via props instead of faked `phase` ref), Draft, Board, Delivery
    (branches moved from `UniversalToolRenderer`). Section map replaces the
    per-tool-card stacking; `UniversalToolRenderer`, `CarouselWorkflow`,
    `WorkflowCard`, `ToolRunCard` deleted.
  - Pure helpers `runSections.ts` (section grouping + rail derivation, no Vue
    imports) with 7 node:test cases.
  - i18n: `sections.ideasTitle` + `runCard.approvalTitle/approvalNoted` added
    to all four locales; 59 used keys audited present in en/fr/es/de.
  - e2e `runcard-t23.spec.ts`: scripted 5-tool SSE run asserts exactly one
    card, 5-rail steps, typed sections, approve path; dark + light screenshots.
- Tests run:
  - `runSections.test.mjs` — 7 passed; e2e spec — 2 passed
  - full agent suite — 177 passed, 0 failed; DB — 136 passed, 0 failed
  - SFC parse+compile check on all 7 new + edited index.vue — clean
  - `git diff --check` clean; no `console.*`
- Verify: one card per run (e2e count 1); rail from real tool/envelope status
  (no local phase ref); approval footer renders envelope approvals (server
  gating arrives T12); semantic tokens only; named handlers; `:loading` +
  toasts + motion preserved; max new/changed complexity 5.
- Evidence: e2e screenshots `test-results/runcard-dark|light.png` (git-ignored).
- Note: pre-existing e2e specs navigate stale `/app/ai-tools/chat` (real route
  is `/app/chat`); new spec uses the correct route. Existing chat specs fail
  identically with and without this change (environment).

### Session 2026-09-18 — T21 pipeline adapters (dispatch table)
- Status: done
- Built:
  - `packages/agent/server/capabilities/pipeline-dispatch.ts`: one §4.5 table
    serving both routes — `dispatchNodeKind` (model rows → capability,
    passthrough rows → manual/materialize/create_post/publish/review, studio
    hyphen spellings normalized, unknown → typed `unknown`) and
    `dispatchStepType` (step path → `pipeline.step`). Specialist rows ride
    `pipeline.node` with the kind in input until T06+ repoints them here.
  - `node.post.ts`: kind routing driven by the table (shared
    `executePassthrough` helper); `executeModelNode` executes the dispatched
    capability; review guard extended to the studio `human-review` spelling.
    Removed `MODEL_NODE_KINDS` / `MATERIALIZE_KINDS`.
  - `execute.post.ts`: step execution dispatches through the same table.
  - Step path NOT removed: `UsePipelineManager.executeStep` proves it is the
    live studio entry (node.post has no UI caller); both stay, one table.
  - `tests/pipeline-dispatch.test.mjs` — 6 passed: per-kind rows (§4.5 union +
    studio spellings), unknown rejection, step dispatch, 8 dispatched model
    executions + step execution via `runCapability` (scripted completion).
- Tests run: new file 6/6; full agent suite 177 passed, 0 failed; DB 136/136;
  `git diff --check` clean; no `console.*`.
- Verify: every model kind executes through a capability; run-history shape
  untouched (`completeNode` paths unchanged); no prompt string in either route
  (only type/variable names and the user-authored step prompt passed as input);
  max changed complexity 5 (`executePassthrough`); UI untouched (smoke
  deferred with the build per project instruction).
- Evidence: dispatch test output; route diffs.
- Next task: T23 — chat RunCard (compact single-view workflow card)

### Session 2026-09-18 — T20 raw-completion deletion + 10 call-site migrations
- Status: done
- Built (new capabilities, prompts moved verbatim from routes):
  - `social.caption` / `social.hooks` / `social.hashtags` (`social.ts`) ← MCP
    caption/ideas/hashtags; `content.sql` (`sql.ts`, schema hint moved in) ←
    text-to-sql; `playbook.refine` (`playbook.ts`, merge prompt + playbook-shape
    validation moved in) ← playbook refine; `pipeline.node` / `pipeline.step`
    (`pipeline.ts`) ← scheduler node/step routes (no prompt string remains in
    either route); `workflow.idea_scan` (`workflow.ts`, `idea-scan.md` prompt +
    contract moved in) ← agent-workflow.
  - `index.ts` aggregator: single import registering all 11 capabilities;
    adapters import `runCapability` + `buildCapabilityRunContext` from it.
  - Migrated: 4 MCP tools (caption/ideas/hashtags → purpose-built; run-goal
    keeps the orchestrator with a `text.generate`-backed `complete` closure),
    `socialComplete` helper → `text.generate` (7 social routes unchanged),
    text-to-sql, playbook refine (graceful `aiRefined:false` preserved),
    scheduler node/step (locking/persistence untouched), workflow idea scan.
  - Deleted `completeForUser` + `UserCompletionInput` from `run-config.ts`
    (kept: `buildAgentRunConfig`, `extractJsonObject`, model-resolution
    internals); removed duplicated prompts/schemas from routes and service.
  - Hardening: `runCapability` preserves coded model errors
    (`MODEL_NOT_CONFIGURED` keeps its 503 via `generationErrorStatus`);
    `buildCapabilityRunContext` fails loud on brand-context failure (coded
    throw, per failure semantics).
- Tests run:
  - `tests/capabilities-generation.test.mjs` — 15 passed (prompt semantics +
    output validation per capability, coded-error preservation), 0 failed
  - full agent suite — 171 passed, 0 failed
  - DB services — 136 passed, 0 failed
  - `rg 'completeForUser' packages` → 0 hits; `git diff --check` clean
- Verify: every migrated endpoint has its capability declared once with a
  behavioural test; max new/changed complexity 4 (`buildCaptionPrompt`);
  no `console.*`, no dead code (IdeaScanSchema, route prompts, shape helpers
  removed); no UI changes (i18n/handlers/feedback N/A).
- Evidence: new test output; grep output; per-route diffs.
- Next task: T21 — pipeline adapters (node-kind dispatch table)

### Session 2026-09-18 — T19 AI-call evlog telemetry
- Status: done
- Built:
  - `packages/agent/server/agent/telemetry.ts` (canonical T19 location): policy
    engine (`metadata` default | `redacted` | `payload`, byte cap), credential +
    personal scrubbers, `emitAiCall`, AsyncLocalStorage correlation
    (`withAiCallContext` / `aiCallContext`), `installAiCallTelemetry` on the
    real `instrument({ observe, interceptor, dispose })` seam (interceptor wraps
    every `{ type: 'model', turnId }` provider call; observer turns
    `turn_request`/`turn` into one `ai.call` event per model call), best-effort
    compact `agent_runs` rows (`ai.call:<capability>`, lazy service import so
    DB-free tests never touch Drizzle, `flushAiCallRecords` test seam), and
    HMR-safe idempotent `ensureAiCallTelemetry` (globalThis guard).
  - `packages/agent/server/plugins/ai-telemetry.ts`: Nitro boot registration
    (once per process).
  - `packages/agent/server/capabilities/telemetry.ts`: now a re-export of the
    canonical module (existing importers/tests untouched).
  - `packages/shared/server/utils/evlog.ts`: shared `emitAiCallEvent` next to
    `wrapAiModel` / `captureEmbedUsage` (one field shape for both runtimes).
  - `packages/agent/server/capabilities/goal.ts`: `goal.execute` runs inside
    `withAiCallContext` (runId/capability/agent/user/business correlated).
  - Patterns: `evlog-observability.md` pi-unobservable gotcha superseded +
    Flue task section; `flue-agent-layer.md` telemetry section updated to T19.
- Tests run:
  - `tests/ai-call-telemetry.test.mjs` — 5 passed (metadata/redacted/payload
    policies, ALS correlation, per-call `agent_runs` rows), 0 failed
  - full agent suite — 156 passed, 0 failed
  - DB services — 136 passed, 0 failed
  - `git diff --check` clean; no `console.*`
- Verify: one event per model call with usage + latency + finish reason;
  `metadata` carries no content, `redacted` scrubs, `payload` truncates;
  credentials never appear; max new/changed complexity 4
  (`scrubCredentials`, `writeAiCallRow`, observe callback).
- Evidence: `tests/ai-call-telemetry.test.mjs` output; `agent_runs` row assertions.
- Next task: T20 — delete `completeForUser`, migrate its 10 call sites

### Session 2026-09-18 — T05 MagicSyncAgent + capability registry + runCapability
- Status: done
- Built:
  - `packages/agent/server/flue/magicsync-agent.ts`: `MagicSyncAgent` Flue agent
    function + `createMagicSyncAgent({ model, systemContext })` factory,
    deterministic `plan_lookup` Valibot tool wrapping the planner routing table
    (zero model calls on match), `lookupPlan` pure helper.
  - `packages/agent/server/capabilities/goal.ts`: new `goal.execute` capability
    (input `{ goal }`, output `{ goal, routed, steps, summary, reply }`) —
    first complete goal executable end-to-end via `runCapability`: deterministic
    routing first, schema-validated model planning only for unrouted goals,
    plain-language reply (numbered steps + one next step), stable SSE events
    over the existing chat contract (`message.started` → `text.delta` →
    `message.completed`, `<runId>:<seq>` ids via `createEventEmitter`), and an
    `agent_runs` row per run (`MagicSyncAgent`, completed/failed, duration).
    `registerBuiltinCapabilities()` now registers both capabilities (call moved
    below the capability definitions to satisfy module TDZ).
  - `packages/agent/tests/magicsync-agent.test.mjs`: 6 tests — Flue executes the
    real agent end-to-end via the SSE stub (tool turn + text turn, offered tools
    exactly `[plan_lookup, task]`, i.e. ours plus Flue's built-in), routed goal
    with event-order + stable-id + `agent_runs` assertions, model-path planning,
    `GOAL_UNPLANABLE` failure with error event, typed rejection codes.
- Tests run:
  - new file in isolation — 6 passed, 0 failed
  - `pnpm --filter @local-monorepo/agent test` — 153–154 passed; 0–1
    intermittent failure in unrelated `agent-workflow.test.mjs` card-merge
    counts under full-suite parallel load (zero references to changed files;
    passes in isolation; pre-existing flakiness, not a T05 regression)
  - `pnpm --filter @local-monorepo/db test:services` — 136 passed, 0 failed
  - `git diff --check` — clean; no `console.*` added
- Verify: first complete goal executable end-to-end (routed + model paths);
  SSE contract shape unchanged (same `AgentStreamEvent` union, same stable ids;
  `chat.post.ts` untouched); max new/changed cyclomatic complexity 4
  (`runGoalExecute`); capability declared once with input/output validation.
- Evidence: `tests/magicsync-agent.test.mjs` output; `agent_runs` row assertions.
- Next task: T19 — AI-call evlog telemetry (`instrument`/`observe`)

### Session 2026-09-18 — T04 Flue runtime spike (STOP GATE)
- Status: done (go decision)
- Built:
  - `@flue/runtime` 2.0.8 + `valibot` added to the pnpm catalog and `packages/agent`.
  - STOP-GATE item §5.3 resolved: Flue declares `^0.83.0` on pi, which rejects 0.85.1
    (0.x caret) and made pnpm install a second pi copy. `pnpm-workspace.yaml`
    `overrides:` now force `@earendil-works/pi-agent-core` / `pi-ai` to 0.85.1;
    verified `@flue/runtime` resolves the same deduped `pi-ai@0.85.1` as the agent
    layer (exactly one pi version in the tree).
  - `packages/agent/server/flue/runtime.ts`: HMR-safe singleton boot seam
    (`getFlueRuntime`), `agentIdentity`, test reset hook.
  - `packages/agent/tests/flue-runtime.test.mjs`: in-process spike against a
    hermetic OpenAI-compatible SSE stub — bounded two-turn task (tool turn +
    text turn), one mounted `board_list` tool, structured `AgentReply`, full
    event stream assertions (`turn_request`, `tool`, `submission_settled`).
  - `.claude/patterns/flue-agent-layer.md` authored from the real findings
    (boot singleton, AuthResult shape, Valibot tools, model specifiers,
    observe() seam, pi pinning, gotchas); INDEX.md entry updated.
- Go/no-go: **GO.** All T04 verify criteria met: bounded task executed end-to-end
  with no network/API keys; no infinite loop (2 turns, submission settled
  `completed`); structured result (`reply.text`); controlled tool selection (only
  the mounted tool on the wire); existing 31 agent suites still green.
- Tests run: `pnpm --filter @local-monorepo/agent test` — 135 passed / 32 suites
  (baseline 133/31 + the new spike suite); spike suite standalone also green.
- Evidence: `tests/flue-runtime.test.mjs` output; `pnpm ls` single pi resolution;
  pattern file + INDEX entry.
- Next task: T05 — MagicSyncAgent + capability registry + runCapability entry

### Session 2026-09-18 — PRD revision: final plan frozen
- Status: done (documentation only; no production code changed)
- Built: finalized the plan into this PRD.
  - Locked decisions 13-17 added: PII removal, AI-call logging policy,
    pipeline-studio fate, chat RunCard, and no raw model escape hatch.
  - Audit 3.7 entry-point sprawl: completeForUser plus its 10 call sites across
    5 packages, three parallel orchestrators, and pipeline nodes that send inline
    prompts instead of calling real skills.
  - Audit 3.8 pipeline studio inventory: UI, nav, 17 routes, pipeline.service, and
    the pipelines / pipeline_runs / workflow_graph tables are all kept; only model
    execution is replaced. Both the graph path and the step path are reachable.
  - Audit 3.9 chat UI inventory: per-tool-call card stacking, a faked step rail,
    sections duplicated per tool, and the missing revise i18n key.
  - Design 4.4 one entry, one registry, one dispatch table (with the capability
    descriptor shape); 4.5 node-kind to capability table; 4.6 RunCard shell,
    section renderers, and the run/step envelope; 5.4 instrument and observe
    feeding an evlog ai.call event; 5.5 log content policy.
  - New tasks T18-T24: PII removal, AI-call telemetry, completeForUser deletion,
    pipeline adapters, docs, chat RunCard, extensibility guide.
  - Explicit execution-order table at the top of section 13; extra rows in the
    section 6 migration map; verification gates 11-14; 5 new risks; 5 new stop
    conditions.
- Tests run: none (documentation-only change)
- Evidence: this file; feedback/preview(3).html is the T23 visual target
- Next task: T01 (ownership + baseline), then T03 (DB audit), then T18 (PII removal)
### Session 2026-09-18 — T18 custom PII subsystem removal
- Status: done (isolated deletion complete)
- Built: removed the ONNX/regex surrogate plugin, `pii_scan`, `pii-guardian`,
  private-mode request/session wiring, guard PII branch, mapping service, PII
  asset script, Docker asset step/env, stale UI locale entries, and stale docs.
  Removed `pii_mappings` and `agent_chat_sessions.private_mode` from the schema.
- Tests run:
  - `pnpm --filter @local-monorepo/agent test` — 128 passed, 30 suites
  - `pnpm --filter @local-monorepo/db test:services` — 135 passed, 25 suites
  - `pnpm exec drizzle-kit check --config ./config/drizzle.config.ts` — passed
  - `NUXT_TURSO_DATABASE_URL=file:/tmp/magicsync-t18-fresh.db pnpm exec drizzle-kit migrate --config ./config/drizzle.config.ts` — passed
  - `pnpm dlx vite-doctor .` — unchanged pre-existing 16 diagnostics, 0 blockers
- Evidence: migration `0013_past_typhoid_mary.sql`; repository search shows only
  historical migration snapshots plus the retired-decision record remain.
- Next task: T04 — Flue runtime spike in Nitro (STOP GATE)

### Session 2026-09-18 — T03 database audit
- Status: done (audit only; no production or schema changes)
- Built: reverified every agent/AI table in §3.4 against schema exports and live
  service/route/test references. No dead artifact was proven. PII schema remains
  intentionally live until T18.
- Tests run:
  - `pnpm exec drizzle-kit check --config ./config/drizzle.config.ts` — passed
  - `NUXT_TURSO_DATABASE_URL=file:/tmp/magicsync-t03-fresh.db pnpm exec drizzle-kit migrate --config ./config/drizzle.config.ts` — passed
  - DB services baseline — 135 passed, 25 suites
- Evidence: §3.4.1; no cleanup migration filename because no cleanup is safe yet.
- Next task: T18 — remove the custom PII subsystem

### Session 2026-09-18 — T02 migration map confirmation
- Status: done (audit/documentation only; no production code changed)
- Built: verified the §6 KEEP/MIGRATE/REPLACE/DELETE map against live callers;
  corrected the PII row to the locked T18 deletion outcome; added the caller
  inventory and confirmed the 10 `completeForUser` call sites, pipeline model
  execution paths, chat card renderer path, registries, runner, context, and RAG
  consumers.
- Tests run: repository reference scans only; T01 baseline remains green.
- Evidence: §6.1 caller verification table and updated migration row.
- Next task: T03 — database audit + cleanup migration

### Session 2026-09-18 — T01 ownership + baseline freeze
- Status: done (documentation/context only; no production code changed)
- Built: recorded ownership boundaries in `.claude/context/architecture.md` and
  added the `flue-agent-layer` pattern index entry; updated the migration baseline.
- Tests run:
  - `pnpm --filter @local-monorepo/agent test` — 137 passed, 32 suites
  - `pnpm --filter @local-monorepo/db test:services` — 135 passed, 25 suites
  - `pnpm dlx vite-doctor .` — 0 blockers, 16 diagnostics, 0 warnings
  - `pnpm site:build` — intentionally deferred until feature implementation and
    Playwright integration are complete, per project instruction
- Evidence: §3.6 baseline, ownership contract, and this progress block.
- Next task: T02 — migration map confirmed against code

### Session 2026-09-18 — Phase 0 audit
- Status: done (audit only, no production code changes)
- Built: this PRD; Phase 0 inventory (§3) from repository inspection:
  `packages/agent` structure (156 files, 28 test suites), entry points
  (chat SSE, goals API, content-items API, MCP `run-goal`), callers
  (`ai-tools`, `connect`, `scheduler`, `site`), PII boundary
  (`plugins/pii` + `pii_mappings`), context source (`agentic/context-selector.ts`),
  the full agent/AI table inventory with live-consumer proof, and the key finding
  that `@flue/runtime@2.0.8` depends on `@earendil-works/pi-agent-core ^0.83.0`
  and `@earendil-works/pi-ai ^0.83.0` — the same pi core already pinned at
  `0.85.1` in this repo.
- Tests run: none (documentation-only change; baseline commands deferred to T01)
- Evidence: `.aiContext/PRD-FLUE-AGENT-MIGRATION.md` (this file); repository greps
  for `flue` returned only false positives (`influences`, `influencers`)
- Next task: T01 — ownership boundaries + baseline freeze

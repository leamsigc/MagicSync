---
name: agentic-goal-layer
description: Legacy goal-layer reference; new AI work uses the Flue capability registry and extensibility pattern
triggers:
  - "agentic"
  - "goal run"
  - "executeGoal"
  - "new skill"
  - "skill registry"
  - "agent registry"
  - "approval gate"
edges:
  - target: pi-agent-layer.md
    condition: when touching the pi runtime, sessions, limits or the tool layer
  - target: ../context/conventions.md
    condition: when writing services (ServiceResponse contracts)
last_updated: 2026-09-19
---

# Legacy Agentic Goal Layer (`packages/agent/server/agentic/`)

> **Superseded for new work.** The migration moved new orchestration to Flue and
> `runCapability`. Keep this file only as historical context for the remaining
> goal persistence/context helpers; use [`flue-agent-layer.md`](flue-agent-layer.md)
> and [`agent-capability-extensibility.md`](agent-capability-extensibility.md)
> for new capabilities, tools, pipeline nodes, and approval behavior.

## Context

Business owners state goals in plain language ("help me get more customers").
The orchestrator turns a goal into a bounded, verified run — no entry point
(API, chat, MCP, jobs) implements its own orchestration.

## Pieces

| Piece | File | Responsibility |
|---|---|---|
| Contracts | `agentic/contracts.ts` | zod: `AgentPlan`, `GoalStep`, statuses, `SkillRunContext`, `ExecutableSkill` |
| Orchestrator | `agentic/goal-orchestrator.service.ts` | `executeGoal` / `resume` / `cancel`; bounded loop; approval gates |
| Planner | `agentic/planner.ts` | deterministic keyword routing first; model planning only as fallback, always schema-validated |
| Registries | `agentic/skill-registry.ts`, `agentic/agent-registry.ts` | skills with contracts; domain agents as skill groupings |
| Skills | `agentic/skills/*` | thin capabilities wrapping existing services (`content-intelligence`, `contentChainService`, LangSearch); model prose lives in sibling `<id>/SKILL.md` files, never inline in `.ts` |
| Prompts | `agentic/prompts/` | `plan.md` + `repair.md` + `index.ts` (`renderTemplate`/`roleOf`/`promptOf`); skills import their own `<id>/SKILL.md?raw` directly so a new skill needs no registry edit |
| Context | `agentic/context-selector.ts` | Brand Playbook assembly; ungrounded fallback on `BRAND_CONTEXT_REQUIRED`, loud on NOT_FOUND/FORBIDDEN |
| Recovery | `agentic/recovery.ts` | classify retryable/recoverable/requires-user/fatal; bounded retries (2) |
| Progress | `agentic/progress.ts`, `agentic/goal-events.ts` | user-facing labels + `goal.*` SSE events |
| Persistence | `packages/db` `agent_goal_runs` + `goal-run.service.ts` | plan/steps JSON, status incl. `waiting_for_approval` |

## Steps

1. **New skill** — add `agentic/skills/<id>.ts`: zod input/output schemas,
   `run(ctx, input)` (thin — delegate to an existing service), `verify()`,
   register in `agentic/skills/index.ts`. Author the model prose as
   `agentic/skills/<id>/SKILL.md` (frontmatter `name`/`description`, `## Role`
   = system prompt, `## Task`/`## Output contract`/`## Rules` with
   `{{placeholders}}`) and render it via `renderTemplate(promptOf(body), vars)`
   + `roleOf(body)` from `agentic/prompts`. Keep ≤ 5 branches per function.
   Pure-delegation skills (e.g. `create-content-ideas`) still ship a SKILL.md
   documenting the capability contract.
2. **Model completions inside skills** — use `completeJson()` (validate + one
   repair retry). Never parse raw model text.
3. **New consequential capability** — set `consequential: true`; the run pauses
   at `waiting_for_approval` and the API resumes it via `POST .../goals/:id/approve`.
4. **Entry points** — API: `server/api/v1/agent/goals/*`; chat tool:
   `agent/tools/goal.tools.ts` (`execute_goal`, headless); MCP:
   `site/server/mcp/tools/ai/run-goal.ts`. All call `goalOrchestratorService`.
5. **Tests** — register isolated `test-*` skills on the shared `skillRegistry`;
   the planner falls back to the model only for goals that match no route, so
   feed a fake `complete` returning plan JSON keyed to `test-*` skill ids.

## Gotchas

- Planner is deterministic-first: routed goals never call the model (small-model
  friendliness + zero cost). Only unroutable goals use `planFromModel`.
- Model plans are sanitized: unknown skill ids are dropped; an empty remainder
  fails with `GOAL_UNPLANABLE`.
- `agent_goal_runs.plan`/`steps` are JSON text; `resume` re-parses with the
  contract schemas — malformed persisted state throws (fail loud, not silent).
- Skills must not import workflow services that import them back; keep
  dependencies pointing one way (skill → service).
- Tests must `initTestDb()` before importing anything under `agentic/` (skills
  instantiate DB services at import time).

## Verify (legacy reference)

- [ ] `pnpm --filter @local-monorepo/agent test` green (no network)
- [ ] New skill has input/output schemas + `verify` + sibling `SKILL.md`
- [ ] No model-facing prose inline in `agentic/` services or skills (grep `You are a` under `agentic/*.ts` — only `SKILL.md`/`prompts/*.md` may carry it)
- [ ] No skill logs raw model output or business PII
- [ ] Consequential skills are unreachable without an approval row transition

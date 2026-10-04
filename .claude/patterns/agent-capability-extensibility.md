---
name: agent-capability-extensibility
description: Add capabilities, pipeline node kinds, and AI-call telemetry without creating a second orchestration path.
triggers:
  - "add capability"
  - "new pipeline node"
  - "AI log field"
  - "extend Flue"
edges:
  - target: flue-agent-layer.md
    condition: when implementing or debugging the Flue runtime boundary
  - target: ../context/conventions.md
    condition: when adding routes, services, or user-facing UI
last_updated: 2026-09-19
---

# Agent Capability Extensibility

`packages/agent` is the only Agent Layer. A feature package authenticates,
validates, resolves tenant context, calls `runCapability`, and maps the result;
it does not own prompts, model calls, skill selection, or an orchestration loop.
Use the existing capability registry and preserve the `ServiceResponse<T>` shape
at service boundaries.

## Simple content API surface

For business-facing content integrations, prefer the stable four-operation surface:
`content.scan`, `content.write`, `content.publish`, and `content.check`, plus
`content.move` for the board's drag-and-drop. Expose these as thin
`/api/v1/content/*` adapters and keep optional behavior behind the
`content.check` operation enum (`seo-audit`, `extend`, `rewrite`,
`internal-linking`, `social-post`, `carousel-draft`) instead of creating a new
route for every editor action. `content.publish` must preserve approval and Safe
Mode gates.

### Board drags: `content.move`

`content.move` is an adapter, never a second state machine. It reads the card and
calls `contentBoardService.move(..., { actorKind: 'user', actorUserId: ctx.userId })`,
then returns `{ itemId, state }`. `CONTENT_ITEM_TRANSITIONS` in
[`content-board.service.ts`](../../packages/db/server/services/content-board.service.ts)
is the only authority on what a drop may do — surface its coded refusal
(`INVALID_TRANSITION`, `HUMAN_ACTION_REQUIRED`, `ARTIFACT_REQUIRED`) so the UI can
toast and snap the card back instead of silently doing nothing. Never
re-implement the transition check in the capability or the route, and never
loosen `AGENT_FORBIDDEN_TARGETS` to make a drop work.

Two flags carry board intent on the existing capabilities rather than new routes:

- `content.write` takes `stopAt: 'drafting' | 'review_required'` (default
  `review_required`). The research → write → article → humanize → checks →
  `submitForReview` chain runs either way — only the final card move is skipped —
  so the artifact is always persisted.
- `content.publish` takes an optional `connectionId` to pick which of the
  business's publishing connections to deliver through. It falls back to the
  provider's active connection, and an explicit connection that is not the
  caller's, is not the run's business, does not match the provider, or is
  inactive fails with `PUBLISH_CONNECTION_MISMATCH` **before** any job or post
  exists.

`getActiveConnection(userId, businessId, provider, event)` takes a **provider** in
its third slot, not the event. Passing `event` there matches no row and fails
closed; use `getConnection(userId, connectionId, event)` for an explicit id, the
way [`destination.service.ts`](../../packages/db/server/services/destination.service.ts)
does.

## 1. Add an AI capability

Follow this order:

1. **Choose the owning agent and skills.** Add or reuse a focused Flue agent in
   [`server/flue/specialists.ts`](../../packages/agent/server/flue/specialists.ts)
   and mount only the needed skills/tools. Skill declarations live in
   [`server/flue/skills.ts`](../../packages/agent/server/flue/skills.ts); tool
   schemas at the Flue boundary use Valibot. Existing application services keep
   their existing zod contracts.
2. **Declare the capability once.** Add a module under
   [`server/capabilities/`](../../packages/agent/server/capabilities/) with:
   `inputSchema`, `outputSchema`, an agent function returning
   `ServiceResponse<T>`, and a descriptor containing `id`, `title`,
   `description`, `stream`, `render`, `steps`, and `consequential` as needed.
   Register it once in that module and import the module from
   [`server/capabilities/index.ts`](../../packages/agent/server/capabilities/index.ts).
3. **Use the shared entry.** Call
   [`runCapability`](../../packages/agent/server/capabilities/registry.ts)
   from an HTTP route, MCP tool, job, or automation adapter. The adapter must
   parse/auth/authorize, call `buildCapabilityRunContext`, then shape the typed
   outcome. Tenant ids come from the server context, never model input.
4. **Gate side effects.** Set `consequential: true` for publish, schedule,
   send, delete, external mutation, spend, or settings changes. The approval
   gate in [`server/flue/approvals.ts`](../../packages/agent/server/flue/approvals.ts)
   must reject before the service can cause a side effect.
5. **Add the UI only when needed.** Set the descriptor `render` and `steps` for
   existing `RunCard` sections. If a new visual shape is genuinely required,
   add a presentational section under
   [`packages/ai-tools/app/components/ai-tools/chat/tool-results/sections`](../../packages/ai-tools/app/components/ai-tools/chat/tool-results/sections)
   and add locale keys beside [`chat.json`](../../packages/site/app/pages/app/chat/chat.json).
   Keep handlers named, async buttons loading, failures toasted, and conditional
   content animated with `@vueuse/motion`.
6. **Test the boundary.** Use a scripted `complete` and a fresh test DB; do not
   require network access or credentials. Assert input rejection, prompt or
   behavior semantics, output validation, tenant scoping, approval behavior for
   consequential work, and the registered capability id.

### Worked example

The small `text.generate` capability in
[`server/capabilities/text.ts`](../../packages/agent/server/capabilities/text.ts)
shows the minimum registry shape: zod input/output schemas, one agent function,
registration, and a structured `{ text, json }` result. Its boundary behavior is
covered by the coded-error test in
[`tests/capabilities-generation.test.mjs`](../../packages/agent/tests/capabilities-generation.test.mjs)
(`capability error codes (T20)`), while the registry and deterministic routing
are covered by [`tests/capabilities.test.mjs`](../../packages/agent/tests/capabilities.test.mjs).
Run the worked example with:

```bash
pnpm --filter @local-monorepo/agent test
```

## 2. Add a pipeline node kind

> **REMOVED 2026-10-02.** The pipeline studio (`/app/pipelines`), its two
> `pipelines/runs/[runId]` adapters, `capabilities/pipeline-dispatch.ts` and
> `tests/pipeline-dispatch.test.mjs` were deleted with it. The table they
> described no longer has a second adapter; extend capabilities on the pattern
> used by `content` / `goal` instead. Surviving pipeline surfaces are the
> machine-auth CLI routes `cli/batch` and `cli/generate-approved`.

1. Add the normalized kind to the appropriate row in
   [`server/capabilities/pipeline-dispatch.ts`](../../packages/agent/server/capabilities/pipeline-dispatch.ts).
   Model work maps to a capability id; no-model work maps to an existing
   passthrough handler. Normalize studio spellings in `NORMALIZE_KIND`.
2. If it needs model work, make the capability accept the node's structured
   input and add its behavior test. Do not add a prompt to either pipeline
   route.
3. Keep both adapters on the same table:
   [`scheduler/server/api/v1/pipelines/runs/[runId]/node.post.ts`](../../packages/scheduler/server/api/v1/pipelines/runs/%5BrunId%5D/node.post.ts)
   and [`scheduler/server/api/v1/pipelines/runs/[runId]/execute.post.ts`](../../packages/scheduler/server/api/v1/pipelines/runs/%5BrunId%5D/execute.post.ts).
   They retain auth, ownership, locking, persistence, and response shapes.
4. Extend [`tests/pipeline-dispatch.test.mjs`](../../packages/agent/tests/pipeline-dispatch.test.mjs)
   with the new kind and its end-to-end stub-provider execution.
5. If the kind materializes, publishes, or reviews, route it through the
   existing service/approval path; never make a pipeline route perform a new
   external mutation directly.

## 3. Add an AI log field

1. Add the field to the canonical event shape in
   [`server/agent/telemetry.ts`](../../packages/agent/server/agent/telemetry.ts),
   where Flue `observe()` converts one model turn into one `ai.call` event.
2. Preserve the policy boundary: metadata mode must remain content-free,
   redacted mode must scrub personal data and credentials, and payload mode must
   honor `AGENT_AI_LOG_MAX_BYTES`. Never add API keys or credential material.
3. If the field is shared with other AI paths, add it to
   [`packages/shared/server/utils/evlog.ts`](../../packages/shared/server/utils/evlog.ts)
   through `emitAiCallEvent`; do not create a second logger.
4. Extend [`tests/ai-call-telemetry.test.mjs`](../../packages/agent/tests/ai-call-telemetry.test.mjs)
   for metadata, redacted, payload, truncation, and credential-safety behavior.
5. Keep correlation inside `withAiCallContext` so chat, MCP, and jobs retain
   `runId`, capability, user, and business attribution.

## Verify checklist

- `runCapability` is the only entry used by the new adapter.
- The capability is registered exactly once and has zod boundary schemas.
- Flue tools use Valibot; application service contracts are unchanged.
- Consequential work is blocked without an approval transition.
- No route/job/MCP adapter contains a prompt string or model call.
- No hardcoded UI copy, missing locale key, bare assignment handler, or silent
  async action is introduced.
- Changed functions have at most five cyclomatic branches.
- Relevant node tests, agent tests, DB services, `vite-doctor`, and build gates
  pass; `git diff --check` is clean and no `console.*` was added.

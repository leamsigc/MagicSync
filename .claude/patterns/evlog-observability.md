---
name: evlog-observability
description: Wiring evlog — request logging, the global log auto-import for app/server code, AI SDK telemetry, Better Auth identity, and dual-write audits
triggers:
  - "evlog"
  - "observability"
  - "audit log"
  - "AI telemetry"
  - "token usage"
  - "console.log"
  - "replace console"
  - "logging in a composable"
edges:
  - target: context/conventions.md
    condition: when checking service/endpoint requirements for instrumented code
  - target: patterns/add-endpoint.md
    condition: when the new endpoint needs logging, AI metrics, or audit events
  - target: patterns/debug-api.md
    condition: when an instrumented endpoint fails and logs must be read
last_updated: 2026-10-01
---

# evlog Observability

## Context

- `evlog/nuxt` is registered in **every** layer's `nuxt.config.ts`, not just `site`.
  So each layer boots with evlog on its own, and both `log` (global) and
  `useLogger(event)` (request-scoped) are auto-imported everywhere — never import them.
- `log` has two shapes depending on scope, and mixing them up is the main trap:
  - **global `log`** (default): `log.error({ message, ...fields })` — event object.
  - **`const log = useLogger(event)`** in a handler, which *shadows* the global and
    takes positional args: `log.error('message', { ...fields })`. No `.debug`, and
    passing an object as the first arg does not match the signature.

```ts
// server/utils/service.ts  (global — event object)
log.error({ message: 'carouselService.listForUser failed', error: String(error) })

// server/api/v1/x.get.ts   (request-scoped — positional)
const log = useLogger(event)
log.error('Failed to serve file', { error })
```

- **`log` does NOT exist in Web Workers.** `app/assets/workers/*` and anything a
  worker imports are separate Vite entries outside the auto-import transform, so a
  bare `log` there is `undefined` at runtime. `app/assets/workers/transcriptionWorker.ts`,
  `summaryWorkers.ts`, `imageBackgroundRemoverWorker.js` and
  `text-to-speech/ttsEngine.ts` (imported by `ttsWorker.ts`) therefore still use
  `console.*`. Give them a transport before converting them.
- `evlog` (catalog 2.28.1) is a dependency of every Nuxt layer package. `packages/doc`
  is a standalone VitePress site and intentionally has no evlog dependency.
- Shared helpers live in `packages/shared/server/utils/evlog.ts` (auto-imported, but
  prefer explicit `#layers/BaseShared/server/utils/evlog` imports in utils/services).
- Drains are unchanged by default: wide events go to the existing evlog/nuxt drain.
  The DB `audit_log` table stays the system of record (dual-write, never replace).

## Task: Instrument an AI call (Vercel AI SDK)

### Steps

1. Accept an optional request logger in the helper options: `log?: RequestLogger`
   (import type from `'evlog'`).
2. Wrap the model at the call site: `wrapAiModel(log, aiModel)` — no-op when `log`
   is absent (background/service-layer calls without an event).
3. For `embed`/`embedMany`, call `captureEmbedUsage(log, { tokens, model, dimensions, count })`
   after the call — embedding models cannot be wrapped with middleware.
4. Pass the route's `log` (`const log = useLogger(event)`) from every caller.
5. Central choke points already wired: `schedulerUnifiedAI.generateText/generateObject`
   (7 routes), `toolsUnifiedAI.generateText` (menu-board), `resolveEmbedder` (3 ingest
   routes; agent-runner has no request logger by design).

### Gotchas

- The repo's `ai` is v7 and some files still annotate models as `LanguageModelV1`,
  which no longer exists in `ai@7` (stale type-only import, runtime unaffected).
  `wrapAiModel` is intentionally a generic passthrough so SDK-version friction stays
  in one place — do not "fix" it by pinning SDK model types.
- Flue supersedes the old pi-runtime gotcha: `packages/agent/server/agent/telemetry.ts`
  registers `instrument({ model })` + `observe()` once at agent-layer boot
  (`server/plugins/ai-telemetry.ts`), so the final request payload IS available
  in-process via `turn_request` events — one `ai.call` evlog event per model call.
  Never wrap the pi runtime directly; use the Flue seam.
- `maxTokens`/budgets are unchanged by wrapping; the middleware only observes.

## Task: Instrument a Flue model call (agent layer)

### Steps

1. Telemetry is installed once at boot — do not install per request. For
   background jobs, MCP tools, or tests outside a request, call
   `ensureAiCallTelemetry()` (idempotent, HMR-safe) instead.
2. Correlate the run with `withAiCallContext({ runId, capability, agent,
   userId, businessId }, () => …)` — every `ai.call` event of the run then
   carries `runId`/`capability`, and a compact per-call row lands in
   `agent_runs` (debugging without a log drain).
3. Read the content policy from the environment, never from code:
   `AGENT_AI_LOG` = `metadata` (default) | `redacted` | `payload`,
   truncated by `AGENT_AI_LOG_MAX_BYTES`. Credentials are never logged at any
   level; failures always emit.
4. Share the field shape: emit through `emitAiCallEvent(log, record)` in
   `packages/shared/server/utils/evlog.ts` (next to `wrapAiModel` /
   `captureEmbedUsage`), not through ad-hoc `emitLog` calls.

### Verify

- [ ] One representative run emits exactly one `ai.call` event per model call
- [ ] `metadata` carries no prompt/output content; `redacted` scrubs
  secrets/emails/phones; `payload` truncates to the cap
- [ ] No `console.*` added; no model behavior changed

### Verify

- [ ] New AI helper options keep `log` optional; no-log callers still work (passthrough)
- [ ] Route passes its request `log` so metrics correlate onto the request event
- [ ] No `console.*` added; no prompt/model behavior changed

## Task: Record an audit event (dual-write)

### Steps

1. Keep writing the DB row via `logAuditService.logAuditEvent(data, { log })` —
   pass the route's `log` as the second arg.
2. The service emits the same fact via `log.audit()` (`auditEvent` helper):
   `action`, actor `{type:'user', id}`, optional `target`, `outcome`, `reason`.
3. DB stays the system of record; the wide event carries the fact to log drains.
4. No request logger or no actor (background/plugin contexts: SchedulerPost plugins,
   MCP tools, mcp-oauth util) → DB-only, by design. Do not thread fake loggers.

### Gotchas

- `emitDualAudit` maps DB `status: 'pending'` to evlog `outcome: 'success'`
  (evlog outcomes are only success/failure/denied).
- `target` is omitted unless BOTH `targetType` and `targetId` are present
  (`AuditTarget.id` is required).
- Audit events need `log.emit()` to reach drains — in routes the evlog/nuxt
  middleware emits at request end; in tests call `await log.emit()` explicitly
  (see `packages/db/tests/evlog-audit.test.mjs`, which uses evlog's `mockAudit()`).

### Verify

- [ ] DB row still written (admin audit UI unchanged)
- [ ] `mockAudit()`-style test or manual check shows the same action on the event
- [ ] No secrets/PII in `reason`/`details` beyond what the DB row already holds

## Task: Identify users (Better Auth recipe)

### Steps

1. Request identification runs globally in
   `packages/auth/server/middleware/002.evlog-identify.ts`
   (`createAuthMiddleware(auth, { exclude: ['/api/auth/**'] })`) — no per-route work.
2. Better Auth's internal operational logs are forwarded in `packages/auth/lib/auth.ts`
   via `forwardAuthLog` (same console sink, structured). Keep the field whitelist in
   mind — never add passwords/tokens to logged args.

### Gotchas

- Middleware order matters: `001.auth` (session enforcement) runs first; `002`
  only enriches. Anonymous/401 requests stay anonymous.
- `identify()` resolves the session once per request; timing lands on the event
  as `auth.resolvedIn` — chart it before "optimizing" it away.

### Verify

- [ ] Authenticated requests carry `user`/`session` on the wide event
- [ ] `/api/auth/**` stays excluded; no tokens or passwords in events

## Debug

- **No `ai` field on the event:** the route didn't pass `log` (or passed a
  standalone logger instead of the request one). `wrapAiModel(undefined, …)` is a
  deliberate no-op — check the call chain.
- **No `audit` field:** `log.emit()` never ran (tests), or no actor (DB-only path).
- **Missing `user`:** request went through `001.auth` bypass (`/api/v1/cli/*`) or
  has no session — expected for anonymous traffic.
- **ESLint fails with "typescript-eslint does not support TS 7.0":** pre-existing
  repo-wide environment issue, unrelated to evlog changes. Rely on service tests.

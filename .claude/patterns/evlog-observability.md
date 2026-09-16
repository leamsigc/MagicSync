---
name: evlog-observability
description: Wiring evlog request logging, AI SDK telemetry, Better Auth identity, and dual-write audits in this repo
triggers:
  - "evlog"
  - "observability"
  - "audit log"
  - "AI telemetry"
  - "token usage"
edges:
  - target: context/conventions.md
    condition: when checking service/endpoint requirements for instrumented code
  - target: patterns/add-endpoint.md
    condition: when the new endpoint needs logging, AI metrics, or audit events
  - target: patterns/debug-api.md
    condition: when an instrumented endpoint fails and logs must be read
last_updated: 2026-09-15
---

# evlog Observability

## Context

- `evlog/nuxt` is registered in `packages/site/nuxt.config.ts` (`include: ['/api/**']`).
  In the merged site build every layer route gets a request wide event; `useLogger(event)`
  is auto-imported everywhere — never import it.
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
- The pi SDK agent runtime (`packages/agent/server/utils/pi-runtime.ts`) is NOT the
  Vercel AI SDK — `evlog/ai` cannot wrap it, and it exposes no token usage.
  Leave it alone.
- `maxTokens`/budgets are unchanged by wrapping; the middleware only observes.

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

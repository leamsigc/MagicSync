---
name: request-scoped-auth-cache
description: Resolve the Better Auth session once per HTTP request and avoid blocking client navigation on redundant session fetches
triggers:
  - "slow api"
  - "get-session"
  - "navigation hang"
  - "session lookup"
edges:
  - target: "patterns/auth-session-lifecycle.md"
    condition: "when changing UseUser, route middleware, or session state"
  - target: "patterns/evlog-observability.md"
    condition: "when changing the evlog identity middleware"
last_updated: 2026-10-24
---

# Request-Scoped Auth Cache

## Context

Every authenticated `/api/v1/*` request used to resolve the same session three
times: `001.auth` (401 gate), `002.evlog-identify` (wide-event user), and the
route handler (`checkUserIsLogin`, 265 call sites). At ~100 ms per lookup the
baseline cost was ~300 ms before any handler code ran. The client route
middleware also awaited `/api/auth/get-session` on every navigation even though
the session was hydrated from the SSR payload.

## Steps

1. Put the cache in `packages/auth/server/utils/request-session.ts`. Key it on
   `event.context.authRequest` and store the **promise**, so concurrent awaiters
   share one in-flight lookup.
2. Route `useAuthApi(event).getSession()` through `resolveRequestSession(event)`.
   That fixes every handler without touching the 265 call sites.
3. In `002.evlog-identify.ts`, reuse `resolveRequestSession(event)` and call
   `identifyUser(log, session)` from `evlog/better-auth` instead of
   `createAuthMiddleware` (which calls `auth.api.getSession()` itself).
4. Enable `session.cookieCache` in `packages/auth/lib/auth.ts` with a short
   `maxAge` (60s) so most reads never touch the database. Document the
   revocation-delay trade-off.
5. On the client, add `sessionLoaded` + `sessionCheckedAt` state to `UseUser()`
   and only fetch from `01.auth.global.ts` when never loaded or older than
   ~5 minutes. Make `fetchSession()` single-flight on the Nuxt app and bound the
   client fetch with `AbortSignal.timeout(5000)`.

## Gotchas

- Never keep the in-flight promise in module scope: SSR shares modules between
  requests and would leak one user's session to another. Use `event.context` on
  the server and the Nuxt app instance on the client.
- The cache stores the promise, not the resolved value — concurrent callers must
  wait on the same lookup rather than racing.
- `cookieCache` is a security trade-off: bans, role changes and session
  revocation take up to `maxAge` to apply.
- Do not call `auth.api.getSession()` directly in new server code; use
  `resolveRequestSession`.

## Verify

- One `auth:` span per API request on the evlog wide event.
- At most one `/api/auth/get-session` per navigation, and none within the
  revalidation window.
- `pnpm audit:layers` passes; dev server serves `/api/auth/get-session` and a
  protected endpoint (200 / expected 401).
- Re-measure endpoint latency before/after; tiny responses should no longer
  take ~400 ms.

## Update Scaffold

- [ ] Update `patterns/auth-session-lifecycle.md` and
      `patterns/evlog-observability.md` if the resolution path changes.
- [ ] Update `.claude/ROUTER.md` current state for significant changes.

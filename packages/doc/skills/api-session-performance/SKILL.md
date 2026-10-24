---
name: api-session-performance
description: Diagnose and fix slow authenticated API calls and blank-feeling route navigation in MagicSync. Use when navigation hangs, backend calls take 300ms+ for tiny responses, `/api/auth/get-session` is a bottleneck, or the same request fires more than once per page.
---

# API & Navigation Performance

## When to use

- In-app navigation feels stuck; the URL changes before content paints.
- A tiny API response (a few hundred bytes) takes hundreds of milliseconds.
- `/api/auth/get-session` is called on every click, or more than once per page.
- You need to prove where the time goes before changing anything.

## Steps

1. **Measure before touching code.** With a logged-in browser (chrome-devtools
   MCP or DevTools):
   - Time `/api/auth/get-session` and 3–4 `/api/v1/*` endpoints from the page.
   - If an endpoint that returns **400/422/500 in the handler** is still slow,
     the cost is in middleware, not the handler.
   - Record SPA navigation time with `PerformanceObserver` on `/api/` resource
     entries, plus the moment `location.pathname` changes.
2. **Count session resolutions per request.** Look for `auth.api.getSession()`
   in `packages/auth/server/middleware/001.auth.ts`,
   `packages/auth/server/middleware/002.evlog-identify.ts`, and the handler
   (`checkUserIsLogin`). More than one is the bug.
3. **Check the client middleware.** `packages/auth/app/middleware/01.auth.global.ts`
   must not await `fetchSession()` on every navigation; it should trust the
   SSR-hydrated state and revalidate on a timer.
4. **Apply the fixes in this order:**
   - Keep one session resolution per request: `resolveRequestSession(event)` in
     `packages/auth/server/utils/request-session.ts` (memoized promise on
     `event.context.authRequest`). `useAuthApi().getSession()` and the evlog
     identity middleware both delegate to it.
   - Enable `session.cookieCache` in `packages/auth/lib/auth.ts` (short maxAge,
     e.g. 60s) so reads validate the signed cookie instead of the DB.
   - Gate client fetching with `sessionLoaded`/`sessionCheckedAt`, make
     `fetchSession()` single-flight on the Nuxt app, and add a 5s timeout.
   - Deduplicate identical list requests with a per-Nuxt-app in-flight map
     (`usePostManager.getPosts` is the reference implementation).
5. **Re-measure** with the same script and compare: one `get-session` per
   navigation at most, and one call per identical list URL.
6. **Watch the trade-off:** `cookieCache.maxAge` delays ban/revocation
   enforcement by up to that window. Say so in the summary.

## Verification

- `pnpm audit:layers` passes.
- `pnpm dlx vite-doctor .` reports no new diagnostics for changed files.
- `pnpm audit:i18n` stays clean.
- Dev server boots and `/api/auth/get-session` + a protected `/api/v1/*`
  endpoint respond (200 / expected 401).
- No unit tests (repo rule) — verify by running the app.

## Anti-patterns

- Calling `auth.api.getSession()` from a helper without the request cache.
- Blocking route middleware on a network call that the SSR payload already
  answered.
- Storing an in-flight promise in module scope: SSR shares modules between
  requests. Use `event.context` (server) or the Nuxt app instance (client).

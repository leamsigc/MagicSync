# API & Navigation Performance

## The symptom

In production, moving between in-app routes (calendar → posts → single post →
media) left the page blank for ~0.8 s, and some backend calls looked like they
were hanging. `/api/auth/get-session` was the most visible one because route
middleware awaited it before every navigation.

## What the measurements showed

| Call | Result |
| --- | --- |
| `GET /api/auth/get-session` (logged in) | ~187 ms p50, one 647 ms spike |
| `GET /api/v1/inbox/count` | **392 ms for a 35-byte body** |
| `GET /api/v1/business/active` | **410 ms for a 564-byte body** |
| `GET /api/v1/assets` (returned 500) | **342 ms** |
| SPA navigation (URL change) | **725–820 ms** |

The decisive clue: endpoints that failed in the handler still took ~340 ms. The
time was spent *before* the handler.

## Root cause 1 — three session lookups per API request

Every authenticated `/api/v1/*` request resolved the same session three times:

1. `packages/auth/server/middleware/001.auth.ts` → `checkUserIsLogin()`.
2. `packages/auth/server/middleware/002.evlog-identify.ts` → evlog's
   `createAuthMiddleware()` called `auth.api.getSession()` again.
3. The route handler itself → `checkUserIsLogin(event)` again (265 call sites).

Each lookup is ~100–125 ms, so ~300–350 ms of pure auth overhead preceded every
API call, and one slow query was amplified three times.

### Fix — one promise per request

`packages/auth/server/utils/request-session.ts` memoizes the session (and the
converted request headers) on `event.context.authRequest`. The cache stores the
**promise**, so concurrent awaiters share one in-flight lookup. `useAuthApi()`
delegates to it, which fixes all 265 handler call sites without touching routes.
`002.evlog-identify.ts` uses the same resolver and `identifyUser()` from
`evlog/better-auth`.

The cache lives on the H3 event, so nothing outlives the request and concurrent
requests cannot see each other's session.

## Root cause 2 — navigation blocked on a session round trip

`packages/auth/app/middleware/01.auth.global.ts` awaited `fetchSession()` on
every route change, even though the session was already hydrated from the SSR
payload. A hard load paid for the session twice (SSR + after hydration).

### Fix — trust hydrated state, revalidate cheaply

- `UseUser()` gained `sessionLoaded` and `sessionCheckedAt` state.
- Middleware fetches only when the session was never loaded or is older than
  5 minutes.
- `fetchSession()` is single-flight: the promise lives on the Nuxt app (per
  request on SSR, per tab on the client), replacing the old `watch` + 15 s
  timeout helper that could stall navigation.
- The client fetch has a 5 s `AbortSignal.timeout`; on failure the cached state
  wins and the next signal/navigation retries.

## Root cause 3 — cookie cache was disabled

`packages/auth/lib/auth.ts` had `session.cookieCache` commented out, so every
session read hit the database. It is now enabled with `maxAge: 60`: reads are
validated from the signed cookie, and a ban/role/revocation takes at most 60 s
to propagate. Better Auth rewrites the cookie on every session mutation.

## Also fixed

- Post list requests were sent three times per `/app/posts` visit
  (`PostFiltersBar` emitted both `filterChange` and `refresh`, plus the page
  setup fetch). The component now emits one event, and `usePostManager.getPosts`
  collapses identical concurrent requests through a per-app in-flight map.
- `/api/v1/social-accounts/health` fired twice per load under different
  `callOnce` keys and returned ~400 KB. The layout is now the only caller, the
  header badge reads shared state, and `?summary=1` returns only
  `{ id, platform, accountName, health }` + the summary.
- Better Auth logging is `warn` in production instead of `debug`.

## How to verify

1. Log in, open DevTools → Network, and clear it.
2. Navigate calendar → posts → media → calendar.
3. Each navigation should fire **one** `/api/auth/get-session` at most (and none
   within the 5-minute window), and `/api/v1/posts` should appear once.
4. Server-side, every `/api/v1/*` request should show a single `auth:` span on
   its evlog wide event.

## Trade-offs

- `cookieCache.maxAge: 60` means a revoked session, ban, or role change can take
  up to a minute to be enforced. Lower it if that window is unacceptable.
- A session is validated per request but not per navigation; an expired session
  surfaces as a 401 from the next API call and the next revalidation (≤5 min).

---
name: auth-session-lifecycle
description: Work with the better-auth session lifecycle (UseUser, $sessionSignal, logout) without leaking listeners or flooding get-session
triggers:
  - "logout"
  - "signOut"
  - "$sessionSignal"
  - "fetchSession"
  - "session flood"
edges:
  - target: "context/conventions.md"
    condition: "when writing or reviewing auth composable code"
last_updated: 2026-09-09
---

# Auth Session Lifecycle

## Context

- Session state lives in `packages/auth/app/composables/UseUser.ts` (`auth:user`, `auth:session`, `auth:sessionFetching` via `useState`).
- better-auth flips its internal `$sessionSignal` nanostore on `/sign-out`, `/update-user`, `/sign-in/email`, and ~10 other paths (`better-auth/dist/client/config.mjs` → `atomListeners`).
- All logout buttons share `useDashboardNavigation().userMenuItems` → `UseUser().signOut()`.

## Steps

1. Subscribe to `$sessionSignal` **exactly once** (module-level guard). Never subscribe in a composable body — `UseUser()` runs on every navigation via `01.auth.global.ts` middleware.
2. Never call composables inside `computed()` — hoist `UseUser()` / `useColorMode()` to setup scope and read the refs inside the computed.
3. `fetchSession()` must be single-flight: keep the in-flight promise on the Nuxt app (per-request on SSR, per-tab on client) and clear it in `finally`. Never use a `watch` + wall-clock timeout as the waiter — a value that settled before the watcher attached stalls for the full timeout.
4. Route middleware must trust the SSR-hydrated session. Fetch only when `sessionLoaded` is false or `sessionCheckedAt` is older than the revalidation window (~5 min); awaiting `/api/auth/get-session` on every navigation blocked each click for 170–370 ms. Bound the client fetch with `AbortSignal.timeout(5000)`.
5. Server code resolves the session through `resolveRequestSession(event)` (`packages/auth/server/utils/request-session.ts`), which memoizes one promise on `event.context`. Never call `auth.api.getSession()` directly in a second place — that was 3 lookups per API request.
6. `signOut()` must **always redirect** (`try/finally` + `reloadNuxtApp({ path })` on client): a failed sign-out request must never strand the user on a dead page.
7. Clear local state **and** `clearNuxtData('auth-session')` on logout — the cached `useFetch` payload otherwise resurrects the old session on the next fetch. Also reset `sessionLoaded`/`sessionCheckedAt`.

## Gotchas

- Hydration-deferred `useFetch` (real incident 2026-09, MCP `/consent` bounce):
  `useFetch()` issued from `onMounted` while the app is still hydrating is
  deferred to a `beforeMount` hook that never fires for the already-mounting
  component, so it resolves `{ data: null, status: 'idle' }` with NO network
  request. A session gate built on that null wrongly concludes "logged out".
  Pages whose middleware skips the SSR session fetch (e.g. `/consent`) must
  gate on the session at `<script setup>` top-level instead — setup-scope
  `useFetch` runs on `beforeMount` during hydration and populates the SSR
  payload (cookies forwarded) on direct loads.
- Middleware must never drop `?redirect=` when bouncing a logged-in user off
  `/login|/register` — resume to the same-origin redirect instead, or one
  transient `get-session` failure permanently destroys flows like OAuth
  consent (same `/consent` incident: `/consent` → `/login` → `/app`).
  Accept leading-`/` paths only, never `//` (open-redirect guard).

- Leaked `$sessionSignal` listeners turn one logout broadcast into N concurrent `/api/auth/get-session` requests. Symptom: `Fetched session`-style log spam every millisecond and a frozen tab on logout click.
- `useFetch(..., { key: 'auth-session' })` cache survives `session.value = null` — always clear it when dropping local state.
- `reloadNuxtApp` wipes all client stores (auth, business, caches); prefer it over `navigateTo` on logout so the next login starts clean.
- `redirectTo.toString()` on a `RouteLocationRaw` object yields `[object Object]` — type the param as `string`.

## Verify

- [ ] Logout emits exactly one `get-session` call (Network tab) and lands on `/`
- [ ] No repeated session-fetch logs after clicking logout
- [ ] Logging back in (same or different user) shows correct user + business context
- [ ] New code keeps branching minimal (cyclomatic complexity lint)

## Debug

- Session spam after logout → count `$sessionSignal` listeners; check for subscribes inside composable bodies or computeds.
- Click logout, nothing happens → check `/api/auth/sign-out` response; `onError` path must still clear state + redirect.
- Stale user after re-login → `clearNuxtData('auth-session')` missing, or `business:id` state not reset (full reload covers this).

## Update Scaffold
- [ ] Update `.claude/ROUTER.md` "Current Project State" if what's working/not built has changed
- [ ] Update any `.claude/context/` files that are now out of date
- [ ] If this is a new task type without a pattern, create one in `.claude/patterns/` and add to `INDEX.md`

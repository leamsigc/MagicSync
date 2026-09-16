---
name: ssr-safe-state
description: Keep SSR correct — never module-scope ref/reactive for request-varying state, always useState inside the composable
triggers:
  - "hydration mismatch"
  - "insertBefore"
  - "500 on direct load"
  - "module ref"
  - "cross-request"
edges:
  - target: "context/conventions.md"
    condition: "when writing any new code"
last_updated: 2026-09-09
---

# SSR-Safe State

## Context

Nuxt SSR runs many requests in one Node process. A `ref()`/`reactive()` at
module scope is a **process singleton**: every SSR request shares it, and it
is invisible to the hydration payload. `useState()` is per-request on the
server and hydrates consistently to the client.

## Steps

1. Request-varying state (user data, lists, selections, session-derived
   flags) lives in `useState('namespace:key', () => initial)` **called inside
   the composable function** — never `ref()`/`reactive()` at module scope.
2. Static catalogs identical for all users/requests (e.g. a platform list)
   may stay module-scope, with a comment saying why.
3. Client-only singletons (workers, AudioContext, drag flags in browser-only
   tools) are out of scope — but never read them during SSR render.

## Gotchas

- Real incident (2026-09, `/app` 500 after login): `businesses` lived in a
  module `ref` in `useBusinessManager`, written by `03.business-check.global`
  middleware during SSR and rendered by `useGettingStarted`. Server HTML
  rendered *with* data while the client hydrated *empty* (module refs never
  serialize) → `Node.insertBefore` → Nuxt 500 error page. Under concurrent
  load it can additionally leak one user's data into another user's SSR HTML.
- Signature symptoms: fails only on direct loads (SSR), never on SPA
  navigation; no API errors; production-only (needs a persistent,
  multi-request server process); fresh logins affected (not logout residue).
- `useState` keys must be unique repo-wide — grep before adding one.

## Verify

- [ ] No `^const x = ref(` / `reactive(` at module scope in SSR-reachable
  `app/` code holding request-varying data
- [ ] Direct-load (full page load, not SPA nav) of every touched route with
  populated state shows zero `Hydration completed but contains mismatches`
- [ ] Complexity gate per AGENTS.md

## Debug

- `insertBefore` + mismatch + 500 with clean APIs → grep module-scope
  `ref`/`reactive` in the render tree first.
- Attribute mismatch (not `insertBefore`), e.g.
  `Html`/`src` rendered on server ≠ expected on client → different root cause:
  color-mode-driven attributes. See `patterns/color-mode-assets.md`.

## Update Scaffold
- [ ] Update `.claude/ROUTER.md` "Current Project State" if what's working/not built has changed
- [ ] Update any `.claude/context/` files that are now out of date
- [ ] If this is a new task type without a pattern, create one in `.claude/patterns/` and add to `INDEX.md`

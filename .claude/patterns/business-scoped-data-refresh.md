---
name: business-scoped-data-refresh
description: Reloading business-scoped view data when the active business changes via the BusinessSwitcher
triggers:
  - "switch business shows old data"
  - "stale posts after business switch"
  - "refetch on business change"
edges:
  - target: context/conventions.md
    condition: when checking code style requirements
last_updated: 2026-10-07
---

# Business-Scoped Data Refresh

## Context

The active business is global `useState('business:id')`, written only by
`useBusinessManager().setActiveBusiness()` (called from `BusinessSwitcher`).
The setter does NOT invalidate anything — every view showing business-scoped
data must reload itself, or the previous business's rows stay on screen
(seen 2026-10-07: calendar kept the old business's posts; media folders were
fixed while assets were forgotten).

## Steps

1. Find the view's existing loader (the same function its filter/refresh
   buttons call — it already carries the view's current params).
2. Watch the business id and re-run that loader:
   ```ts
   const activeBusinessId = useState<string>('business:id')
   watch(activeBusinessId, () => {
     HandleRefresh() // or loadData(), fetchFolders(id), ...
   })
   ```
   (`integrations/active.vue` is the reference implementation.)
3. Reset state derived from the old business BEFORE reloading:
   - pagination restarts (`posts = []; currentPage = 1`)
   - selections scoped to the old business are cleared (media folder scope
     back to `{ kind: 'unfiled' }`, otherwise the new business's list is
     filtered by a foreign folder id)
4. Guard in-flight responses: capture the requested business id before
   `await $fetch` and discard the response if `activeBusinessId` changed
   since (`if (businessId !== activeBusinessId.value) return`).

## Gotchas

- Fetch params live in views, not in shared composables — a blind
  `getPosts(id)` with defaults inside a composable would clobber the caller's
  date-range filters. Watch in the view, reuse the view's loader.
- Don't duplicate a refetch a child already does: `MediaGallery` watches its
  own `business-id`/`folder-scope` props, so the media page only resets the
  scope and refetches folders — never calls `refreshAssets` on switch.
- Only one watcher fires per switch in practice (the mounted view's own);
  shared `useState` lists get overwritten by whichever view is mounted.
- Verify endpoint scoping before "fixing": carousels (`listForUser`) and
  localStorage AI decks are user-/browser-scoped by design, so the templates
  page correctly shows the same data across businesses — no watcher wanted.

## Verify

- Switch business on the view: one refetch per business-scoped list fires,
  zero old-business rows remain, pagination/selections restart.
- Switch mid-load: no stale rows rendered (generation guard), no dead
  infinite-scroll sentinel.

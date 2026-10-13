# The Calendar Data Contract

W3 of the calendar PRD (`.aiContext/PRD-CALENDAR-NUXT-UI.md`) gave the
Apple-style grid its data. The grid itself (`packages/ui`) knows nothing about
posts; everything post-shaped lives in four files added by this wave.

## What landed

| File | Job |
|---|---|
| `packages/db/server/services/post.service.ts` | `findByBusinessIdsForRange` — one cross-business range read |
| `packages/db/db/posts/posts.ts` | `PostWithBusinessData` — a post joined with the business it belongs to |
| `packages/scheduler/server/api/v1/posts/calendar.get.ts` | `GET /api/v1/posts/calendar`, zod-validated |
| `packages/scheduler/app/composables/useCalendarPosts.ts` | businesses → calendars, post → event, reschedule |
| `packages/scheduler/app/components/scheduler/calendar/components/BusinessCalendarList.vue` | the sidebar list, thin over `BaseCalendarList` |

## The read path

```
GET /api/v1/posts/calendar?start=…&end=…&businessIds=a,b
   │  zod: local datetimes, end > start, ≤ 90 days
   ▼
postService.findByBusinessIdsForRange(userId, { start, end, businessIds })
   │  ownership: requested ∩ getAccessibleBusinessIds(userId)
   │  predicate: inArray(posts.businessId, scope)
   │              && gte(scheduledAt, start)
   │              && lt(scheduledAt, end)      ← half-open
   │  with: { platformPosts, user, businessProfile }
   ▼
{ success: true, data: PostWithBusinessData[] }
```

The response is **not** a `PaginatedResponse`. The calendar wants the whole
range at once, so wrapping it in pagination would force every caller to guess a
page size.

## Why ownership is folded into the predicate

`getAccessibleBusinessIds(userId)` returns the businesses a caller can read:
the ones they own, plus the ones whose organization they are a member of. The
requested `businessIds` are intersected with that set **before** the query
runs:

```ts
private async resolveCalendarScope(userId: string, requestedIds?: string[]) {
  const accessible = await this.getAccessibleBusinessIds(userId)
  if (!requestedIds || requestedIds.length === 0) return accessible
  const requested = new Set(requestedIds)
  return accessible.filter(id => requested.has(id))   // ← the guarantee
}
```

A caller passing someone else's `businessId` gets `[]` — the id drops out of the
scope, `inArray` never sees it, and `{ success: true, data: [] }` comes back
without a throw. There is no post-level ownership check needed because
`posts.businessId` is not nullable and every accessible business already
passed the ownership test.

An empty scope also short-circuits the query entirely, so a user with no
businesses costs one `businessProfiles` select instead of a full scan.

## Undated posts

`scheduledAt` is nullable. A draft with no date cannot be placed on a grid, so
the range predicate excludes it — `gte/lt` against `NULL` is never true in SQL.
`useCalendarPosts.toCalendarEvents` filters it again on the client as a second
belt, and `toCalendarEvent` falls back to now only so a mis-call cannot crash
the grid. Undated drafts stay reachable through `findByBusinessId`, which is
what `/app/posts` renders; no existing method changed behaviour.

## Assets

`mediaAssets` is a JSON **string** of ids on the row. The range resolves them
with the same batch pattern `findByBusinessId` uses: collect every id across
every row in one pass, one `assets.findMany({ where: inArray(...) })`, build a
`Map`, then map back per row preserving request order and dropping ids that no
longer exist. Never one query per row.

`parseAssetIds` is the shared entry point. It treats a malformed or non-array
string as "no assets" rather than an error, so one bad row cannot fail a whole
calendar range.

## Derived color, never persisted

`business_profiles` has no color column. `useBusinessManager().businesses` is
mapped through `assignBusinessColorTokens` (from
`#layers/BaseShared/shared/businessColor`), a pure function of the visible
list: it hands out distinct tokens while they last and falls back to a
deterministic FNV-1a hash of `id:name` once all six are used. Same list, same
map, every render — and nothing to migrate.

## Derived end, never persisted

`CalendarEvent.end` is `start + DEFAULT_DURATION_MINUTES` (30). A post has one
`scheduledAt` and no duration column, so an end is computed on the client and
never sent to the server.

## Reschedule

`useCalendarPosts.reschedulePost(postId, scheduledAt)` calls
`PATCH /api/v1/posts/[id]/schedule`. W4 built that endpoint: it writes
`scheduledAt` and nothing else, refuses a target closer than five minutes with
a 422, refuses a `published` or `failed` post with a 409 that names the status,
and 404s a post the caller does not own. `reschedulePost` never throws — it
converts a failure into `{ success: false, error }` plus an error toast,
because a thrown fetch inside a drop handler would leave the optimistic event
stuck — and on success it re-runs the shared posts loader so `/app/posts` tells
the same story as the calendar.

See [`calendar-drag-commit`](./calendar-drag-commit.md) for the write path.

## The sidecar component

`BusinessCalendarList.vue` is 20 lines. It pulls
`calendars` / `hiddenBusinessIds` / `toggleBusiness` out of `useCalendarPosts`
and feeds them to `BaseCalendarList`, which owns the rows, the checkboxes and
the color dots. All it adds of its own is the `businesses` label.

## Verification used

- `pnpm audit:layers` — 0 new unresolved, 14 known baseline violations.
- `pnpm --filter @local-monorepo/db build` and
  `pnpm --filter @local-monorepo/scheduler build` — both clean.
- A throwaway harness seeded two users, two businesses and seven posts and
  asserted: half-open bounds, `scheduledAt ASC`, undated skipped, foreign
  business id → `[]`, outsider sees only their own, asset batch resolution
  with a missing id dropped and a malformed JSON string tolerated, and a
  garbage range returning `{ success: false }` instead of throwing.

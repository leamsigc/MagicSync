# Calendar Drag Commit (W4)

W4 turned the calendar from a read-only surface into one you can move a post on.
The read path is [`calendar-data-contract`](./calendar-data-contract.md); this
page is the write path: a one-field PATCH endpoint, the optimistic overlay, the
rollback, and the two components that render a post inside the grid.

## What landed

| File | Job |
|---|---|
| `packages/shared/shared/calendarTypes.ts` | `RESCHEDULABLE_STATUSES`, `isReschedulableStatus`, `SCHEDULE_BUFFER_MS` — the gate both sides share |
| `packages/scheduler/server/api/v1/posts/[id]/schedule.patch.ts` | `PATCH /api/v1/posts/[id]/schedule` — one-field move, three refusals |
| `packages/scheduler/app/composables/useCalendarPosts.ts` | `reschedulePost` now awaits `refreshSharedPosts()` on success |
| `packages/scheduler/app/utils/scheduler/posts/reschedule.ts` | `isReschedulable(post)`, `isPast(target)` |
| `packages/scheduler/app/utils/scheduler/posts/targetPlatforms.ts` | `targetPlatforms`, `platformsForPost` |
| `packages/scheduler/app/composables/useCalendarDragCommit.ts` | drag → persist → rollback, plus the optimistic overlay |
| `packages/scheduler/app/components/scheduler/calendar/components/PostCalendarEventBlock.vue` | the post chip: title, platform icons, status dot, time |
| `packages/scheduler/app/components/scheduler/calendar/components/PostCalendarEventPopover.vue` | the popover body: switcher, per-platform preview, edit/delete |
| `packages/ui/app/components/calendar/BaseCalendarEventBlock.vue` | gained a `#content` slot, `:disabled="suppressed"`, a `draggable` prop |

## The endpoint

```
PATCH /api/v1/posts/[id]/schedule
body: { scheduledAt: "YYYY-MM-DDTHH:mm[:ss]" }   (local, no offset)
  │  zod refines: target > now + SCHEDULE_BUFFER_MS (5 min)
  ▼
postService.findById(id, userId)          ← ownership folded into the predicate
  │  ─ 404 when the row is not the caller's
  ▼
isReschedulableStatus(status)             ← draft | pending pass
  │  ─ 409, naming the status, for published | failed
  ▼
postService.update(id, userId, { scheduledAt })
  ▼
{ success: true, data: Post }
```

Four properties matter more than the code itself:

**One field.** The body schema is a single key, so a reschedule physically
cannot write `content`, `mediaAssets` or `targetPlatforms`. The legacy
`PUT /api/v1/posts/[id]` takes a whole `UpdatePostData` and defaults
`content` to `''` (`index.put.ts:34`) — every calendar drag through it would
have wiped the body.

**No rewrite.** The legacy route answered a past target with
`if (dayjs(body.scheduledAt).isBefore(dayjs())) updateData.scheduledAt = dayjs().toDate()`
(`index.put.ts:73-75`). A post dropped five minutes early would publish
immediately. This route refuses with 422 and lets the caller roll back.

**Ownership before the status.** The post is read through
`postService.findById(id, userId)`, which folds `userId` into the predicate, so
another user's row and an unknown id are the same 404 — there is nothing to
enumerate. Reading first is also what lets the 409 name the status instead of
mutating a row the route was about to refuse.

**A service refusal keeps its own code.** `postService.update` returns
`{ success: false, error, code? }`; a `NOT_FOUND` code becomes 404 and anything
else 400. Nothing is flattened into a 500 with the real reason lost.

## The throttle nobody asked for

Both sides call `SCHEDULE_BUFFER_MS`. The server refines it in the zod schema;
the client checks it in `useCalendarDragCommit` *before* any request. The client
copy is not redundant — it makes the grid roll back instantly instead of
waiting for a round trip, and the server copy is the one that actually
guarantees the invariant.

## Optimistic, with a way out

`useCalendarDragCommit` keeps a local `Map<string, Date>` keyed by post id.
`withPending(events)` lays it over the fetched events, recomputing `end` as
`start + DEFAULT_DURATION_MINUTES` — never persisted, never sent. The rules:

- A refusal (`!isReschedulable`, or `isPast(start)`) toasts *before* any
  request and never touches the map.
- The entry is added *then* deleted on every settle. Only a success survives,
  and only because the next fetch agrees with the database.
- A failed request deletes the entry, so the next fetch restores the stored
  time. The grid is never allowed to disagree with the row.

`commitMove` never throws. A rejected promise inside a pointer handler would
leave the optimistic entry on screen with nothing to clear it.

## Keeping `/app/posts` in sync

`posts:list` is one `useState` that `/app/posts`, the dashboard stats and the
table all read. After a successful move `useCalendarPosts.reschedulePost`
awaits `refreshSharedPosts()`, which re-runs the repo's own loader:

```ts
await getPosts(activeBusinessId.value, { page: 1, limit: 100 })
```

That is exactly what `usePostManager.deletePost` and
`PostsTableView.handleRefresh` do, so a reschedule leaves the shared list in
the same shape a delete leaves it. The `patterns/business-scoped-data-refresh.md`
warning about a composable clobbering a view's filters does not bite here: the
view's own filters live in the view, and this call only re-reads the same
default page every existing mutation already re-reads.

A failure of that refresh is logged, not raised: the move already landed, so a
second toast would tell the user the wrong thing.

## What the chip shows

`PostCalendarEventBlock` supplies one row to `BaseCalendarEventBlock`'s
`#content` slot:

```
[dot] [title, truncated on one line] [platform icons…] [HH:mm]
```

- The dot is keyed to `post.status` through semantic tokens
  (`bg-muted` / `bg-warning` / `bg-success` / `bg-error`). The old
  `PostCalendarPreview.vue:109` painted a fixed green for every status.
- The title is the whole `post.content` under `truncate`, not `slice(0, 15)`.
- The time comes from `post.scheduledAt` through `dayjs`, not from the drag
  ghost.
- `draggable` is `isReschedulable(post)`, which renders
  `data-draggable="false"` and stops the pointer gesture from starting at all.

The block is painted at `MIN_EVENT_MINUTES` regardless of a post's real
duration — there is no duration column — so it is always at least as tall as the
drag affordance needs.

`BaseCalendarEventBlock` also wires the drag's `suppressed` flag into the
popover's `disabled`. Without it, finishing a drag opened the popover on the
click that ended it.

## The popover

`PostCalendarEventPopover` is the body dropped into the grid's `#event-form`
slot. Header: status badge, business name + derived colour dot, scheduled
datetime, `postFormat`. Then a platform switcher, the preview, and two actions.

**The switcher runs over `targetPlatforms`, not `platformPosts`** — a scheduled
post previews what *will* publish. `targetPlatforms` is a JSON string of
`socialMediaAccounts` ids, so `platformsForPost` resolves each entry to a
platform name through the `platformPosts` rows the same create wrote (whose
`platformPostId` column carries the platform name; there is no `platform`
column on `platform_posts`). An unresolvable entry renders as `default` rather
than a guessed platform.

**The honesty rule is one gate.** `hasPublished(post)` decides which of two
panels renders:

- not published → a dashed "not published yet" panel, no counts, no comments;
- published → the real `platformPosts` rows, each shown as
  `platformPostId ?? unattributed` plus its status. W5 established that
  `platformPosts` has no platform column, so the rows are shown as the history
  that exists and never attributed to a tab they cannot prove.

## Verification used

- `pnpm audit:layers` — 0 new unresolved, 14 known baseline violations.
- `pnpm --filter @local-monorepo/scheduler build` — clean.
- `rg -n 'console\.'` over the touched files — no matches.
- A throwaway harness (in `/tmp`, deleted after) drove the real route module
  against a copy of the dev database with stubbed auth and the real
  `postService`, and asserted 21 checks: a future date on an own post returns
  200 and changes the row, a pending post is reschedulable too, a date one
  minute in the past returns 422 and leaves the row untouched (and *not*
  pulled forward to now), `published` and `failed` return 409 naming the
  status, another user's post returns 404 with the row unchanged, and malformed,
  missing and offset-bearing bodies all return 422.

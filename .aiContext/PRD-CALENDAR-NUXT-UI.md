---
name: prd-calendar-nuxt-ui
description: Master PRD — replace the FullCalendar post calendar with the Apple-style Nuxt UI calendar calendar, scoped to businesses, with 1:1 per-platform post previews.
last_updated: 2026-10-09
status: implemented
---

# Calendar Replacement — Nuxt UI Calendar

## 1. Problem

The current post calendar is a FullCalendar 6 embed driven imperatively
(`packages/scheduler/app/components/ScheduleCalendar.vue`) with three defects:

1. **No rescheduling by gesture.** `editable: false` (`ScheduleCalendar.vue:106`).
   Moving a post means opening a modal and editing a datetime field.
2. **Unreadable events.** `dayMaxEvents: 1` plus a body that renders
   `post.content.slice(0, 15)` (`PostCalendarPreview.vue:97`).
3. **Unfaithful previews.** The twelve platform preview components range from
   ~80% fidelity (Twitter) to ~15% (Pinterest) and hardcode engagement counts
   (`17K`, `7.7K shares`, `84.2K`), a fake "Today at 11:49 AM" timestamp
   (`FacebookPreview.vue:26-29`) and a GitHub avatar URL
   (`TwitterPreview.vue:34`). Six of them are byte-identical clones of one
   generic template.

The UI itself is also the only FullCalendar surface in the repo, pinning eight
`@fullcalendar/*` packages to 6.x (`pnpm-workspace.yaml:31-43`).

## 2. Goal

Replace the calendar UI with the Apple-Calendar-style implementation from
[nuxt-ui-templates/calendar](https://github.com/nuxt-ui-templates/calendar),
keeping the existing purpose (schedule and manage social posts), and raise the
post preview to 1:1 fidelity with the target platform.

Two domain changes ride along:

- The template's sidebar "Calendars" become **businesses**.
- The event popover carries a **per-platform preview** of what will publish.

## 3. Decisions (recorded, locked)

| # | Decision | Rationale |
|---|---|---|
| D1 | Business color is **derived, never persisted** | `business_profiles` has no color column and D1-forbids a speculative migration. One shared helper owns the mapping. |
| D2 | Events are **cross-business**; the sidebar toggles which businesses' posts are visible | Matches the template and the stated goal. `activeBusinessId` survives only as "where new posts go". |
| D3 | The visible-business set is `useState`-only, no cookie | No persistence was wanted, and nothing is hidden by surprise on reload. |
| D4 | Routes are `/app/calendar/[view]/[date]` | Shareable seeded URLs; the month view can sync the URL as it scrolls. |
| D5 | Port UI + drag/move + inline popover + keyboard + view transitions + cache warming. **Drop** offline queue, `gpu-time` quick-event, ⌘K search | Scope control; an offline mutation queue is the wrong trade for a server-authoritative scheduler. |
| D6 | Filters become a compact header popover reusing `usePostFilters` | Preserves the filtering capability inside the template layout. |
| D7 | All 22 configured platforms get 1:1 previews | Stated requirement. Driven by a spec table so each renderer stays small. |
| D8 | **Move-only drag. No resize.** | A post has one `scheduledAt` and no duration. Resize would require a net-new `durationMinutes` column with no publish semantics. |
| D9 | `date-fns` → `dayjs`; no `-apple-system` font lead; keep the repo red ramp | Repo standards and `DESIGN.md` win over template fidelity. |
| D10 | Generic grid lives in `packages/ui`; post wiring in `packages/scheduler` | `ui` is the only layer every feature extends, and the layer audit will keep the grid business-agnostic. |

## 4. Current state (audited)

### Files

| Path | Role |
|---|---|
| `packages/site/app/pages/app/calendar/{index,month,weeks,day}.vue` | Route owners, all render `CalendarViewWrapper` |
| `packages/site/app/pages/app/calendar/calendar.json` | Page locale, 4 locales |
| `packages/scheduler/app/components/scheduler/calendar/components/CalendarViewWrapper.vue` | Composition point; owns fetch, filters, modal wiring |
| `packages/scheduler/app/components/scheduler/calendar/components/SchedulerPageHeader.vue` | Header + New Post button + 3 AI slots |
| `packages/scheduler/app/components/scheduler/calendar/components/PostFiltersBar.vue` | Filter bar, also used by `/app/posts` |
| `packages/scheduler/app/components/ScheduleCalendar.vue` | Imperative FullCalendar driver |
| `packages/scheduler/app/components/PostCalendarPreview.vue` | Event body + hover popover |
| `packages/scheduler/app/components/scheduler/posts/components/NewCalendarPostModal.vue` | Create-from-clicked-date |
| `packages/scheduler/app/components/scheduler/posts/components/UpdatePostModal.vue` | Edit post; also used by `PostsTableView.vue` |
| `packages/ui/app/assets/css/full-calendar.css` | `--fc-*` → Nuxt UI token bridge |

### Data

- `posts.scheduledAt` (`integer` timestamp, nullable) is the only date axis.
  There is no duration column. `publishedAt` is secondary.
- `PostWithAllData` = `Post & { platformPosts, user, assets }` — it carries
  **no business**, so a cross-business event needs a new joined type.
- `mediaAssets` is a JSON *string* of asset ids on the row; the service resolves
  it to `assets: Asset[]` on read (`post.service.ts:167-204`).
- `postService.update(id, userId, { scheduledAt })` is the reschedule primitive.
- `usePostManager` owns `useState('posts:list')` and is the single API client.

### Known seams (pre-existing, do not "fix" opportunistically)

- `PUT /api/v1/posts/[id]:73-75` silently rewrites a past `scheduledAt` to now.
  The new calendar must not route through it.
- `usePostManager.showPlatformStatusToasts` already exceeds the 5-branch gate.
- `PostFiltersBar.vue` template strings are hardcoded English.
- Two dispatch tables for previews (`PhonePreview.vue:85-119`,
  `PostCalendarPreview.vue:50-64`) that can drift. This PRD replaces both.

## 5. Non-goals

- Offline mutation queue / replay / network probe.
- NLP quick-event parsing (`gpu-time`).
- ⌘K search palette (`AppSearch.vue`), list view.
- A `durationMinutes` column, or any posts migration.
- Changing `activeBusinessId` semantics outside the calendar.
- Porting the template's `-apple-system` font stack or red ramp.

## 6. Architecture

### 6.1 Layer placement

```
packages/ui         generic Apple grid — no business, no post knowledge
packages/scheduler  post wiring, previews, new API routes
packages/site       routes + redirects only
packages/db         new service method + joined type
```

`packages/ui/app/components/calendar/` (all `Base`-prefixed, matching the 47
existing `Base*` primitives there):

`BaseCalendarView.vue`, `BaseCalendarHeader.vue`, `BaseCalendarSidebar.vue`,
`BaseCalendarList.vue`, `BaseCalendarMini.vue`, `BaseCalendarMonthView.vue`,
`BaseCalendarWeekView.vue`, `BaseCalendarDayView.vue`,
`BaseCalendarEventBlock.vue`, `BaseCalendarEventChip.vue`,
`BaseCalendarNowIndicator.vue`, `BaseCalendarEventPopover.vue`.

Composables `app/composables/`: `useCalendarRange.ts`, `useCalendarEvents.ts`,
`useCalendarEventDrag.ts`, `useCalendarColors.ts`.
Utils `app/utils/calendarDates.ts`.

`packages/scheduler/app/components/scheduler/calendar/`:
`PostCalendarShell.vue`, `BusinessCalendarList.vue`,
`PostCalendarEventBlock.vue`, `PostCalendarPreviewTabs.vue`,
`PostCalendarFilters.vue`, `PostCalendarEventForm.vue`.
Composable `packages/scheduler/app/composables/useCalendarPosts.ts`.

Route owners in `packages/site/app/pages/app/calendar/`.

### 6.2 Contracts (exact)

```ts
// packages/shared/shared/calendarTypes.ts  (new)
export type CalendarColorToken = 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error'

export interface Calendar {
  id: string
  name: string
  color: CalendarColorToken
}

export type CalendarView = 'day' | 'week' | 'month'

export interface CalendarEvent {
  id: string
  calendarId: string      // businessId
  title: string
  start: string           // local ISO 'YYYY-MM-DDTHH:mm:ss'
  end: string             // DERIVED: start + DEFAULT_DURATION_MINUTES. Never persisted.
  allDay?: boolean
  color: CalendarColorToken
  post: PostWithBusinessData
}
```

```ts
// packages/db/db/posts/posts.ts (addition)
export type PostWithBusinessData = PostWithAllData & {
  business: Pick<BusinessProfile, 'id' | 'name'>
}
```

```ts
// packages/db/server/services/post.service.ts (addition)
findByBusinessIdsForRange(
  userId: string,
  options: { start: Date; end: Date; businessIds?: string[] }
): Promise<ServiceResponse<PostWithBusinessData[]>>
```

Ownership is folded into the predicate: intersect the requested `businessIds`
with `getAccessibleBusinessIds(userId)` (`post.service.ts:312`) and filter with
`inArray(posts.businessId, scoped) && gte(posts.scheduledAt, start) && lte(..., end)`.
The relation query loads `platformPosts`, `user` and `businessProfile`, then
resolves assets with the same batch pattern as `findByBusinessId:167-204`.
Ordering: `scheduledAt ASC`.

```ts
// GET /api/v1/posts/calendar   (zod-validated)
query: z.object({
  start: localDatetime,          // z.iso.datetime({ local: true })
  end: localDatetime,
  businessIds: z.string().optional()  // comma-separated
}).refine(q => new Date(q.end) > new Date(q.start))
→ { success: true, data: CalendarPost[] }
```

```ts
// PATCH /api/v1/posts/[id]/schedule  (zod-validated, new endpoint)
body: z.object({ scheduledAt: localDatetime }).refine(
  v => new Date(v.scheduledAt).getTime() > Date.now() + SCHEDULE_BUFFER_MS)
→ { success: true, data: Post }

// 422 SCHEDULE_IN_PAST    when the buffer refine fails
// 409 POST_NOT_RESCHEDULABLE when status is published|failed
```

```ts
// packages/shared/shared/businessColor.ts (new)
export const BUSINESS_COLOR_TOKENS: CalendarColorToken[] = [ /* 6 */ ]
export function getBusinessColorToken(business: Pick<BusinessProfile,'id'|'name'>): CalendarColorToken
export function assignBusinessColorTokens<T extends {id:string;name:string}>(businesses: T[]): Map<string, CalendarColorToken>
```

`assignBusinessColorTokens` is a pure function of the visible list: it hands out
distinct tokens while they last and falls back to `getBusinessColorToken` once
all six are used. `BusinessCard.vue:15-26`'s local array is replaced by a
token→class map derived from the same source, so the card and the calendar
agree.

### 6.3 State

| Key | Owner | Scope |
|---|---|---|
| `calendar:hidden-businesses` | `useCalendarPosts` | `useState`, session |
| `posts:list` | `usePostManager` | unchanged, invalidated after a drag |
| `business:list`, `business:id` | `useBusinessManager` | unchanged |

### 6.4 Drag-to-reschedule rules

1. Only `status === 'pending' | 'draft'` is draggable. `published` / `failed`
   render `data-draggable="false"` and raise a toast naming the status.
2. Drop target must be ≥ now + `SCHEDULE_BUFFER_MS` (5 min). Otherwise the ghost
   snaps back and an error toast explains why.
3. The move commits only `scheduledAt`. `end` is recomputed from
   `DEFAULT_DURATION_MINUTES` (30) and never sent.
4. Optimistic: the local event map updates on drop, the request fires, and a
   failure rolls that one event back and toasts. Template overlay pattern,
   offline queue removed.
5. On success, `usePostManager.getPosts(...)` is re-run so `/app/posts` stays
   consistent (`patterns/business-scoped-data-refresh.md`).

### 6.5 Event popover

Header: status badge, business name + color dot, scheduled datetime, post
format. Then a platform switcher over `targetPlatforms` (not `platformPosts` —
a scheduled post previews what *will* publish). Body: the platform renderer for
`platformContent[platform]?.content ?? post.content`. Footer: Edit (opens the
existing `UpdatePostModal`), Delete (confirm toast).

`published` posts additionally render real per-platform publish state from
`platformPosts`. `draft`/`pending` posts render **structural chrome only** —
no invented engagement numbers, ever. This is the correction to every current
preview.

### 6.6 Preview system

```
packages/scheduler/app/components/scheduler/posts/previews/
  previewRegistry.ts          single source of truth (replaces 2 dispatch tables)
  platformPreviewSpecs.ts     22 declarative specs
  PostPreviewShell.vue        avatar/name/handle/verified/timestamp/wordmark
  PostPreviewMedia.vue        layout driven by spec: single|grid-2|grid-3|grid-4|carousel|video|none
  PostPreviewActions.vue      action bar from spec
  PostPreviewContent.vue      link/hashtag/mention tokenizer (from VerticalVideoPreview.vue:17-24)
  <Platform>Preview.vue       17 renderers
```

Every renderer MUST:

- take no hardcoded avatar, name, date, or count;
- use `publishedAt ?? scheduledAt` for the timestamp;
- cap media with `platformConfigurations[platform].maxImages`;
- prefer `platformContent[platform].content`;
- carry its own `<i18n src="./x.json">` and `useI18n()`;
- keep every branch-decision function a table lookup, not a condition tree.

Renderer count = 17 covering 22 platforms: `facebook`, `instagram`,
`instagram-standalone`, `twitter`, `x`, `linkedin`, `linkedin-page`, `tiktok`,
`threads`, `youtube`, `pinterest`, `mastodon`, `bluesky`, `reddit`, `discord`,
`dribbble`, `devto`, `wordpress`, `google`, `default`. `email-password` maps to
`default` (it is a config placeholder, not a network).

## 7. Waves

| Wave | Deliverable | Depends on |
|---|---|---|
| W0 | Purge FullCalendar; port glass + view-transition tokens into `packages/ui/app/assets/css/main.css`; declare `dayjs` + `@internationalized/date` on `packages/ui`; enable `experimental.viewTransition` in `packages/site/nuxt.config.ts` | — |
| W1 | Generic foundation in `packages/ui`: `calendarDates.ts`, `useCalendarRange`, `useCalendarColors`, `BaseCalendarEventBlock`, `BaseCalendarEventChip`, `BaseCalendarNowIndicator`, `useCalendarEventDrag` | W0 |
| W2 | `BaseCalendarMonthView`, `BaseCalendarWeekView`, `BaseCalendarDayView`, `BaseCalendarHeader`, `BaseCalendarSidebar`, `BaseCalendarList`, `BaseCalendarMini`, `BaseCalendarEventPopover`, `useCalendarEvents` | W1 |
| W3 | `findByBusinessIdsForRange`, `PostWithBusinessData`, `GET /api/v1/posts/calendar`, `useCalendarPosts`, `BusinessCalendarList` | W0 |
| W4 | `PATCH /api/v1/posts/[id]/schedule`, drag commit, optimistic + rollback, `posts:list` invalidation | W2 + W3 |
| W5 | Preview system: registry, shell, media, actions, content, specs | W0 |
| W6 | 17 renderers, 22 platforms, spec-driven | W5 |
| W7 | Routes, redirects, nav links, popover assembly, delete `ScheduleCalendar.vue` / `PostCalendarPreview.vue` / `CalendarViewWrapper.vue` / `SchedulerPageHeader.vue`, `audit:layers`, docs | W4 + W6 |

## 8. Acceptance criteria

**Grid**

- [ ] `/app/calendar/week/<iso>` renders the Apple-style week grid with an hour
      axis, a `now` indicator, and events positioned by local time.
- [ ] `/app/calendar/month/<iso>` renders a fixed 6-row month grid with a
      sliding title that syncs the URL while scrolling.
- [ ] `/app/calendar/day/<iso>` renders a single full-width day column.
- [ ] `t` / `d` / `w` / `m` / arrows navigate; `n` opens the create modal.
- [ ] Prev/next animate the grid via view transition; month→month scrolling
      does not (`definePageMeta` middleware sets `viewTransition = false`).
- [ ] An invalid view or unparseable date yields a 404, not a crash.

**Sidebar**

- [ ] Every accessible business appears once with a deterministic color.
- [ ] Unchecking a business hides only its posts; reload restores all visible.
- [ ] The mini calendar navigates on click and prefetches the range on hover.

**Mutate**

- [ ] Dragging a pending post commits the new `scheduledAt`, toasts, and
      `/app/posts` reflects it on next visit.
- [ ] Dragging a published post is refused with a toast naming the status.
- [ ] A failed commit rolls the event back and toasts; the post is unchanged
      in the database.

**Preview**

- [ ] The popover lists one tab per `targetPlatforms` entry and renders that
      platform's card for its overridden content.
- [ ] No preview displays a hardcoded avatar, date or engagement count.
- [ ] `google` caps at 1 image; `twitter` at 4; `youtube` renders no images.
- [ ] Light and dark both pass.

## 9. Engineering gates (per task)

1. Cyclomatic complexity ≤ 5 branches per new/changed function. State the max.
2. `pnpm dlx vite-doctor .` — fix errors and warnings.
3. i18n: `<i18n src="./x.json">` first line, `useI18n()`, all copy via `t()`,
   every key present, template text nodes grepped.
4. Event handlers are named functions; no bare state assignment in `@click`.
5. `context/conventions.md` Verify Checklist walked item by item.
6. `console.*` absent from `app/` and `server/`; `log` used instead.
7. Interaction feedback: `:loading` on async buttons, toasts on outcomes,
   `@vueuse/motion` on conditional UI.
8. `pnpm audit:layers` stays at or below the 14-entry baseline.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Virtualized infinite month view is the most complex component in the port | Ship a fixed 6-week month view as an accepted fallback; the spec marks which parts are droppable |
| `packages/scheduler` has no test runner | Bootstrap `packages/site/tests/e2e/calendar.spec.ts` with `patterns/playwright-golden-oracles.md`; rely on lint + doctor + audit |
| 22 renderers is the bulk of the effort | One spec table drives layout decisions so each renderer is a template, not logic |
| Glass tokens colliding with MagicSync's DESIGN.md tokens | Port only the new variables; never touch brand, foreground or border values |
| New generic surface in `packages/ui` | Layer audit enforces that it imports nothing beyond `shared` |

---

## 11. Implementation record (2026-10-09)

All seven waves shipped. The grid wave (W1+W2) landed before W0 — they ran in
parallel and W1+W2 then needed a small `components` pathPrefix fix, recorded in
the deviation register below.

### Shipped surface

| Where | What |
|---|---|
| `packages/ui/app/components/calendar/` | 13 `BaseCalendar*` components (generic grid, no post/business knowledge) + `calendarLayout.ts` geometry |
| `packages/ui/app/composables/` | `useCalendarRange`, `useCalendarColors`, `useCalendarEvents`, `useCalendarEventDrag` |
| `packages/ui/app/utils/calendarDates.ts` | pure date/range helpers on `dayjs` |
| `packages/shared/shared/calendarTypes.ts` | `Calendar`, `CalendarEvent<Post>`, `CalendarView`, `DEFAULT_DURATION_MINUTES`, `SCHEDULE_BUFFER_MS`, `isReschedulableStatus` |
| `packages/shared/shared/businessColor.ts` | `assignBusinessColorTokens` — deterministic, collision-avoiding, unpersisted |
| `packages/db/server/services/post.service.ts` | `findByBusinessIdsForRange` (ownership folded in) |
| `packages/scheduler/server/api/v1/posts/calendar.get.ts` | cross-business range read, zod, 90-day cap |
| `packages/scheduler/server/api/v1/posts/[id]/schedule.patch.ts` | reschedule one; 422 past, 409 published/failed |
| `packages/scheduler/app/components/scheduler/calendar/components/` | `PostCalendarShell`, `BusinessCalendarList`, `PostCalendarEventBlock`, `PostCalendarEventPopover`, `PostCalendarFilters`, `PostCalendarEventForm` |
| `packages/scheduler/app/components/scheduler/posts/previews/` | `platformPreviewSpecs`, `previewRegistry`, `PostPreviewShell/Media/Actions/Content/Comments`, `usePlatformPreview` |
| `packages/scheduler/app/components/scheduler/posts/components/` | 11 previews rewritten onto the shell, 8 new renderers added (21 platforms total) |
| `packages/site/app/pages/app/calendar/` | `[view]/[date].vue` + 4 legacy redirects |

FullCalendar is gone: 8 deps, 8 catalog entries, the CSS bridge, and five
components deleted. `rg -i fullcalendar packages` outside history returns nothing.

### Verified

- `pnpm --filter @local-monorepo/site build` — passes (7m11s, last run after the
  i18n-marker sweep).
- `pnpm audit:layers` — `0 new unresolved of 1758 checked`, 14 baseline.
- `pnpm dlx vite-doctor .` — `blocker:0 error:0 warn:0 info:0`.
- Route validation: valid view + valid date → auth middleware; bad view or bad
  date → 404; legacy paths redirect.
- W3 ownership harness (2 users × 2 businesses × 7 posts, deleted after):
  foreign businessId returns `[]`, mixed filter drops the foreign id, boundary
  end excluded, undated draft skipped, malformed `mediaAssets` tolerated.
- W4 endpoint harness: 21/21 assertions — future date → 200 and the row moves,
  past date → 422 and the row is NOT rewritten forward, published/failed → 409
  naming the status, another user's post → 404 and the row unchanged, malformed
  → 422. Confirms the legacy `PUT` bug is not reachable through this path.
- Max cyclomatic complexity across all waves: **5**, in two functions (the
  schedule route handler and `PostCalendarEventPopover`'s render function).
- Every new SFC carries `<!-- Translation file -->` + `<i18n src>` on line 1
  with 4-locale JSON; 4 structural ui components carry no locale file and were
  grep-proven to have no literal copy.

### Not verified (environmental, pre-existing)

The calendar could not be rendered in a logged-in browser session. The site dev
server points at a remote Turso database whose Better Auth JWKS was encrypted
with a different secret than the local `.env`, so `/api/auth/get-session` returns
**500** and every `/app/*` route redirects to `/login`:

```
SERVER_ERROR: Failed to decrypt private key. Make sure the secret currently in
use is the same as the one used to encrypt the private key.
```

This blocks the whole authenticated app, not just the calendar — it reproduces on
routes untouched by this PRD. The UI-layer playground has the same pre-existing
break (its own index page 500s, needing a site-level `BaseUiLayer` app.config it
never inherits). Visual/dark-mode proof and a drag interaction test remain open
and should be run once a local DB with matching secrets is used.

### Deviation register

1. **`components: pathPrefix: false`** in `packages/ui/nuxt.config.ts` (W1). Nuxt
   prefixes nested component directories, so `components/calendar/BaseCalendarMonthView.vue`
   auto-imports as `CalendarBaseCalendarMonthView`. The directory is scanned with
   `pathPrefix: false` and excluded from the flat scan to keep the required
   directory *and* the required global names. No `#layers` import added.
2. **21 platforms, not 22.** `platformConfigurations` has exactly 21 keys; the
   spec and registry are both keyed to it and `Record<PlatformPreviewKey, …>`
   makes a missing spec a type error. `email-password` resolves to `default`.
3. **`PostCalendarEventPopover` does not emit `commit`.** The generic grid
   hard-wires `BaseCalendarEventBlock` inside `BaseCalendarDayColumn`, so
   `#event-form` is the shell's only extension point. `commit` lives on
   `PostCalendarEventBlock`, the only component a drop actually reaches.
4. **Platform tabs resolve account ids to platform names.** `targetPlatforms` is
   a JSON string of `socialMediaAccounts` ids, not platform names;
   `platformPosts.platformPostId` carries the name. There is no `platform` column
   on `platform_posts`, so per-platform publish state is exposed as available or
   absent rather than fabricated.
5. **`calendarLayout.ts` added** (W1) because `calendarDates.ts` has no pixel
   constants and the W1 agent did not own that file.

### Known debt carried forward

- `PostFiltersBar.vue` still has hardcoded English template strings (pre-existing,
  still used by `/app/posts` — deliberately not deleted).
- `usePostManager.showPlatformStatusToasts` still exceeds the 5-branch gate
  (pre-existing, grandfathered).
- `PUT /api/v1/posts/[id]:73-75` still rewrites a past `scheduledAt` to now; the
  new `PATCH .../schedule` path is unaffected and is the one the calendar uses.
- Two Twitter/X media buckets follow the reference template's literal
  "all four buckets = single"; real X tiles 4 images 2×2. Flagged in code.

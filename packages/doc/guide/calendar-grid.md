# The Generic Calendar Grid

`packages/ui` ships an Apple-Calendar-style grid that knows nothing about
businesses or posts. It operates on the shared contract in
`packages/shared/shared/calendarTypes.ts` — `Calendar`, `CalendarEvent`,
`CalendarView`, `CalendarColorToken` — and nothing else. Everything post-shaped
lives in `packages/scheduler`.

## What W1 + W2 built

**Composables** (`packages/ui/app/composables/`)

| File | Job |
|---|---|
| `useCalendarRange.ts` | View, anchor date, fetched range, header title — all derived from `/[view]/[date]`, so every calendar URL is shareable. App-scoped: the sidebar open state and the docked month are one instance shared by header, sidebar and month view |
| `useCalendarColors.ts` | Static Tailwind class maps per `CalendarColorToken` (`eventBlockClasses`, `eventChipCompactClasses`, `calendarDotClasses`, `eventOutlineClasses`) |
| `useCalendarEventDrag.ts` | Pointer-capture drag to move an event. Move-only |
| `useCalendarEvents.ts` | One cached fetch per visible range, day-keyed bucketing, multi-day dedupe, warm-ahead |

**Components** (`packages/ui/app/components/calendar/`, all globally auto-imported
as `BaseCalendar*`): `BaseCalendarView` (the shell a page renders),
`BaseCalendarHeader`, `BaseCalendarSidebar`, `BaseCalendarList`,
`BaseCalendarMini`, `BaseCalendarMonthView`, `BaseCalendarWeekView`,
`BaseCalendarDayView`, `BaseCalendarDayColumn`, `BaseCalendarEventBlock`,
`BaseCalendarEventChip`, `BaseCalendarNowIndicator`,
`BaseCalendarEventPopover`.

**Utils**: `calendarDates.ts` (given) for date maths,
`calendarLayout.ts` for pixel geometry and cluster packing.

## Why move-only drag

A post has one `scheduledAt` and no duration column. Resize would need a net-new
field with no publish semantics, so `useCalendarEventDrag` has no resize branch
and no `end` is ever committed. `end` is derived as `start + DEFAULT_DURATION_MINUTES`
(30) and never sent to the server.

`addDays` does the column step and `addMinutes` the vertical step, so the wall
clock survives a DST boundary.

## Why the month view is a fixed grid

The upstream template streams six-week chunks through a TanStack virtualizer to
cover five years either side. That is the single most complex piece of the port.
The fixed 6-rows × 7-days grid from `monthRange()` keeps every function inside the
5-branch budget. The sliding title still works: the month of the last day of the
top visible row is docked into `visibleMonth`, and the view rides its own copy of
the title while the grid moves so the header can hand it over.

## The popover is the caller's form

`BaseCalendarEventPopover` carries the chrome — lazy mount, context menu,
`UContextMenu` + `UPopover`, drag suppression — and a `#event-form` slot for
everything else. The scheduler layer supplies the form; the grid never learns
what a post is.

`editingId` is a prop all the way down from `BaseCalendarView`, so exactly one
event's form is open at a time and a redraw does not close it.

## Wiring it up

```vue
<BaseCalendarView
  :calendar="useCalendarEvents({
    events: overlay,
    hiddenCalendars,
    calendars: businesses,
    fetchRange: range => $fetch('/api/v1/posts/calendar', { query: ... }),
    onCommit: (event, start) => patchSchedule(event.post.id, start)
  })"
  @commit="..."
>
  <template #event-form="{ event, close }">
    <PostCalendarEventForm :post="event.post" @close="close" />
  </template>
</BaseCalendarView>
```

`calendars` is passed in, not fetched: this app has no `/api/calendars`, and a
generic layer cannot own a post route.

## Verification

- `pnpm --filter @local-monorepo/ui build` — clean
- `pnpm audit:layers` — `0 new unresolved #layers imports of 1679 checked`
- No full-calendar import anywhere in `packages/ui`
- No hardcoded template text, no non-semantic color tokens

## Gotchas

- **Nested component dirs get a path prefix.** `components/calendar/X.vue`
  auto-imports as `CalendarX`, not `X`. `packages/ui/nuxt.config.ts` therefore
  scans that directory with `pathPrefix: false` and ignores it in the flat scan.
- **`~` is the site's app dir in the shared tsconfig**, so intra-layer imports
  use relative paths (`../utils/calendarDates`).
- **Use `parseLocalDatetime`, not `new Date(string)`** — the same intent, but it
  is the repo's documented parser for the local-ISO shape.

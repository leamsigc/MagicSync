---
name: calendar-nuxt-ui-port
description: How the Apple-style Nuxt UI calendar was ported in — grid in packages/ui, post wiring in packages/scheduler, and the constraints that keep the two apart.
triggers:
  - "calendar"
  - "post calendar"
  - "calendar port"
  - "BaseCalendar"
edges:
  - target: purge-dependency.md
    condition: "when removing what the calendar displaced"
  - target: fullcalendar-nuxt.md
    description: "DEPRECATED, kept only as crash-workaround history"
  - target: layer-restructure.md
    condition: "when moving calendar code between layers"
last_updated: 2026-10-09
---

# Calendar — Nuxt UI port

## Context

`/app/calendar/[view]/[date]` is an Apple-Calendar-style grid ported from
`nuxt-ui-templates/calendar`. The template assumes a standalone event CRUD app;
this app needed it to be a view over scheduled social posts. The split below is
what keeps the template's complexity from leaking into the domain.

## The split

| Layer | Owns | Must not know about |
|---|---|---|
| `packages/ui/app/components/calendar/` | the grid: `BaseCalendarView`, `BaseCalendarHeader`, `BaseCalendarSidebar`, `BaseCalendarList`, `BaseCalendarMini`, `BaseCalendarMonthView`, `BaseCalendarWeekView`, `BaseCalendarDayView`, `BaseCalendarDayColumn`, `BaseCalendarEventBlock`, `BaseCalendarEventChip`, `BaseCalendarNowIndicator`, `BaseCalendarEventPopover` | posts, businesses, the posts API |
| `packages/scheduler/app/components/scheduler/calendar/` | post wiring: `PostCalendarShell`, `BusinessCalendarList`, `PostCalendarEventBlock`, `PostCalendarEventPopover`, `PostCalendarFilters` | grid geometry |
| `packages/shared/shared/calendarTypes.ts` | `Calendar`, `CalendarEvent<Post>`, `CalendarView` | — |

The layer audit enforces this: `ui` may import only `shared`, so a grid component
that reached for a post type would fail CI.

## Steps (to redo or extend this port)

1. **Write the shared contracts first.** `calendarTypes.ts` (generic event) and
   `businessColor.ts` (token assignment) unblock every other file and let waves
   run in parallel with zero coupling.
2. **Grid before data.** Build the grid against a fixture, not a fetch. The
   payload-cache fetch path then bolts on with no grid changes.
3. **Keep branch decisions in lookup tables.** `platformPreviewSpecs.ts` and the
   `useCalendarColors.ts` class maps exist so no renderer ever grows an `if`
   chain. This is what kept every wave under 5 branches.
4. **Inject persistence.** `useCalendarEvents` takes a `fetchRange` and an
   `onCommit` callback rather than naming a route, so `ui` stays transport-free.
5. **Cutover last.** New routes first, legacy pages as redirects, then delete the
   old components. Never intermediate-break a route.

## Gotchas

- **Nested component dirs get prefixed.** `components/calendar/BaseCalendarMonthView.vue`
  auto-imports as `CalendarBaseCalendarMonthView`. `packages/ui/nuxt.config.ts`
  scans that directory with `pathPrefix: false` and excludes it from the flat
  scan. Verify with `nuxt prepare` → `components.d.ts`, not by guessing.
- **`~` and `@` are per-layer** (`patterns/layer-restructure.md`). Use
  `#layers/BaseX` or a relative path inside a layer.
- **The `pages:extend` hook in `packages/ui/nuxt.config.ts` deletes any page
  whose path contains `types`, `components`, `/api`, `composables`, `utils` or
  `.json`.** Confirm a new page route survives it.
- **A locale `.json` must be the only non-`.vue` file in a page directory**, and
  never create `components/`, `composables/` or `utils/` directories under
  `app/pages/` — Nuxt scans them as routes.
- **Component-scoped `<i18n>` blocks do not inherit the parent page's messages.**
  Every component needs its own `<i18n src>` + `useI18n()`.
- **The grid hard-wires `BaseCalendarEventBlock` inside `BaseCalendarDayColumn`,**
  so `#event-form` on the shell is the only extension point for post content.
  Wiring the popover from inside that slot would nest a popover in a popover.
- **`posts` has one `scheduledAt` and no duration.** `CalendarEvent.end` is
  derived client-side and never persisted, which is why the port dropped the
  template's resize gesture and kept move-only.

## Verify

- [ ] `pnpm --filter @local-monorepo/site build` passes.
- [ ] `pnpm audit:layers` stays `0 new unresolved` / ≤14 baseline.
- [ ] `rg -i 'fullcalendar|@fullcalendar' packages --glob '!node_modules'` → nothing.
- [ ] Bad view or date → 404; valid → auth middleware.
- [ ] Every new SFC has `<!-- Translation file -->` + `<i18n src>` on line 1 with
      all four locales; structural components with no copy are grep-proven clean.
- [ ] No `console.*` in `app/` or `server/`.

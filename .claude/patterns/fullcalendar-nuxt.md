---
name: fullcalendar-nuxt
description: Embedding FullCalendar 6 in Nuxt 4 without customRenderingMap crashes
triggers:
  - "fullcalendar"
  - "customRenderingMap"
  - "calendar crash"
edges:
  - target: context/stack.md
    condition: when checking FullCalendar / Vue versions
  - target: patterns/add-page.md
    condition: when adding a calendar page
last_updated: 2026-09-07
---

# FullCalendar in Nuxt

## Context

`@fullcalendar/vue3@6` crashes with `this.customRenderingMap is undefined` when the
`options` object is recreated on every reactive change. The Vue wrapper
destroys/recreates the internal `Calendar` while a render is in flight.

## Steps

1. Render only on client, after mount:
   ```vue
   <ClientOnly>
     <FullCalendar v-if="isMounted" :key="activeView" :options="calendarOptions" />
   </ClientOnly>
   ```
   Set `isMounted = true` in `onMounted()`.

2. Keep `options` stable — `ref`, never `computed`:
   ```ts
   const calendarOptions = ref<CalendarOptions>({ plugins: [...], initialView, events: props.events })
   ```

3. Sync updates by mutating the same object — the wrapper's own deep watchers
   run `pauseRendering` + `resetOptions` (its designed update path). Never call
   `getApi()` from a template ref (resolves to a non-component proxy under
   Nuxt 4 → `getApi is not a function`):
   ```ts
   watch(events, (list) => { calendarOptions.value.events = list })
   watch(locale, (l) => { calendarOptions.value.locale = l })
   ```
   `initialView` is init-only, so remount cleanly for view switches
   (the `:key` above re-runs init/destroy):
   ```ts
   watch(activeView, (v) => { calendarOptions.value.initialView = v })
   ```

4. Use `datesSet` for visible-range callbacks — never `initialEvents` side-effects
   plus a `watch(..., { immediate: true })` emit loop.

5. Don't pass unknown props/options: no `:event-limit` attr, no deprecated
   `views.dayGrid.eventLimit` (use `dayMaxEvents` / `dayMaxEventRows`).

## Gotchas

- Dynamic NuxtLink: use `:is="cond ? 'div' : 'NuxtLink'"`, never
  `resolveComponent('NuxtLink')` in templates (fails resolution inside layers,
  warns `Failed to resolve component: NuxtLink`).
- Orphaned `switch` after a function close = truncated helper (e.g. missing
  `function getFreshnessColor(status: string)` header) — `return` outside
  function at top of `<script setup>`.
- Missing-translation warnings for keys that exist in JSON: `<i18n>` blocks are
  component-scoped — a child using `feeds.x` needs ALL THREE, it does NOT
  inherit the parent page's local messages (proven by PostsFeedView):
  `<i18n src="../../posts.json"></i18n>` + `const { t } = useI18n()` in
  `<script setup>` + `t('...')` in template. Bare `$t` without a setup
  `useI18n()` call falls back to global messages even with the block present.

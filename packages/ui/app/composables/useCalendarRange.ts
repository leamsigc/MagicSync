/**
 * Calendar range state.
 *
 * The view, the anchor date, the fetched range and the header title are all
 * derived from the route, so every calendar URL is shareable and the month view
 * can sync the URL as it scrolls.
 *
 * App-scoped, the way the template's `createAppComposable` did it: the sidebar
 * open state and the docked month have to be a single instance shared by the
 * header, the sidebar and the month view, while a per-call composable would
 * hand each of them its own.
 */
import type { CalendarView } from '#layers/BaseShared/shared/calendarTypes'
import { parseDate, type CalendarDate } from '@internationalized/date'
import {
  formatMonth,
  formatRangeTitle,
  rangeFor,
  toDate,
  todayDate,
  type DateRange,
  type RangeTitle
} from '../utils/calendarDates'

export interface UseCalendarRange {
  view: ComputedRef<CalendarView>
  date: ComputedRef<CalendarDate>
  range: ComputedRef<DateRange>
  title: ComputedRef<RangeTitle>
  /** The path prefix the grid is mounted under, so every link it builds lands. */
  basePath: ComputedRef<string>
  /** The month docked at the top of the month view scroll viewport. */
  visibleMonth: ShallowRef<CalendarDate | null>
  /** True while the month view slides its own copies of the header title. */
  monthLabelsVisible: Ref<boolean>
  formSide: ComputedRef<'bottom' | 'right'>
  prevDate: ComputedRef<CalendarDate>
  nextDate: ComputedRef<CalendarDate>
  pathFor: (target: CalendarDate, targetView?: CalendarView) => string
  setDirection: (direction: 'left' | 'right') => void
  isSidebarOpen: Ref<boolean>
}

/*
 * One instance per Nuxt app: the effect scope keeps the composable's watchers
 * alive for as long as the app, which is what the shared refs need.
 */
function createAppComposable(composable: () => UseCalendarRange): () => UseCalendarRange {
  const instances = new WeakMap<object, UseCalendarRange>()

  return () => {
    const nuxtApp = useNuxtApp()

    if (!instances.has(nuxtApp)) {
      instances.set(nuxtApp, effectScope(true).run(composable)!)
    }

    return instances.get(nuxtApp)!
  }
}

const _useCalendarRange = (): UseCalendarRange => {
  const route = useRoute()

  /*
   * Read every param off `route` inside each computed rather than capturing
   * `route.params` in a closure. This composable is app-scoped, so its instance
   * survives the page `key` remount a view switch triggers — and a captured
   * `params` object keeps the first view's value for the app's lifetime, which
   * leaves the grid on day while the URL reads week. Deriving from `route` keeps
   * the dependency live across a client-side navigation.
   */
  const view = computed<CalendarView>(() => {
    const value = route.params.view

    return value === 'day' || value === 'month' || value === 'week'
      ? value
      : 'week'
  })

  const date = computed<CalendarDate>(() => {
    try {
      return parseDate(route.params.date ?? '')
    } catch {
      return todayDate()
    }
  })

  /*
   * Segments a calendar route always ends in: the view and the date. Everything
   * ahead of them is where the host mounted the grid — `/app/calendar` in this
   * repo, a locale prefix kept intact when there is one — and it is read off the
   * live path because `pathFor` is the grid's only way out: a bare
   * `/week/2026-10-10` would 404.
   */
  const ROUTE_TAIL_SEGMENTS = 2

  const basePath = computed(() => {
    const segments = route.path.split('/').filter(segment => segment.length > 0)

    return segments.length > ROUTE_TAIL_SEGMENTS
      ? `/${segments.slice(0, -ROUTE_TAIL_SEGMENTS).join('/')}`
      : ''
  })

  const range = computed<DateRange>(() => rangeFor(view.value, date.value))

  // Kept in sync live while the month view scrolls, so the header title
  // follows along
  const visibleMonth = shallowRef<CalendarDate | null>(null)

  // While the month view scrolls it slides its own copies of the header title
  // over the grid, the docked one landing right on top of the `h1`. The header
  // hands the title over for as long as they are up.
  const monthLabelsVisible = refAutoReset(false, 600)

  const title = computed<RangeTitle>(() => {
    if (view.value === 'month') {
      const focus = visibleMonth.value ?? date.value

      return { months: formatMonth(toDate(focus)), year: String(focus.year) }
    }

    return formatRangeTitle(range.value)
  })

  // The event form stands beside the event it belongs to. The day view has a
  // single column the width of the grid, so there is no beside to stand in
  const formSide = computed<'bottom' | 'right'>(() => (view.value === 'day' ? 'bottom' : 'right'))

  const step = computed(() => (view.value === 'month' ? { months: 1 } : { days: view.value === 'day' ? 1 : 7 }))

  const prevDate = computed(() => date.value.subtract(step.value))
  const nextDate = computed(() => date.value.add(step.value))

  function pathFor(target: CalendarDate, targetView: CalendarView = view.value): string {
    return `${basePath.value}/${targetView}/${target.toString()}`
  }

  // Drives the slide direction of the view transition, cleared once it finishes
  function setDirection(direction: 'left' | 'right') {
    if (import.meta.client) {
      document.documentElement.dataset.navDirection = direction
    }
  }

  // One model for the two states the sidebar keeps: expanded on desktop, the
  // slideover menu below `lg`. It starts open so the server renders the
  // expanded sidebar, the component closes it itself on mount once it knows the
  // viewport is a small one
  const isSidebarOpen = ref(true)

  return {
    view,
    date,
    range,
    title,
    basePath,
    visibleMonth,
    monthLabelsVisible,
    formSide,
    prevDate,
    nextDate,
    pathFor,
    setDirection,
    isSidebarOpen
  }
}

export const useCalendarRange = createAppComposable(_useCalendarRange)

/**
 * Calendar event pool.
 *
 * One cached fetch per visible range, bucketed by day once per change so a view
 * renders a handful of lookups instead of rescanning the whole pool. The
 * multi-day dedupe is what keeps a span of days from drawing an event twice.
 *
 * The offline queue, the network probe and the mutating overlay the template
 * carries are stripped: the scheduler is server-authoritative, so the caller
 * supplies `fetchRange` for the reads and `onCommit` (plus the optional create,
 * update and remove hooks) for the writes, and owns persistence itself. The only
 * state kept here is the caller-owned overlay of optimistic entries.
 */
import type { Calendar, CalendarEvent } from '#layers/BaseShared/shared/calendarTypes'
import { DEFAULT_DURATION_MINUTES } from '#layers/BaseShared/shared/calendarTypes'
import { addDays, startOfDay } from '../utils/calendarLayout'
import { dayKey, parseLocalDatetime, rangeFor, toLocalDatetime, type DateRange } from '../utils/calendarDates'
import { useCalendarRange } from './useCalendarRange'

export interface UseCalendarEventsOptions {
  /** Caller-owned optimistic entries, merged over whatever the range fetch returns. */
  events: Ref<CalendarEvent[]>
  hiddenCalendars: Ref<string[]>
  calendars: Ref<Calendar[]>
  /** Reads one range. The caller owns the transport, so `ui` never names a route. */
  fetchRange: (range: DateRange) => Promise<CalendarEvent[]>
  /** Persists a move. Receives the event with its recomputed `end`. */
  onCommit: (event: CalendarEvent, start: Date) => Promise<void>
  onCreate?: (event: CalendarEvent) => void | Promise<void>
  onUpdate?: (event: CalendarEvent) => void | Promise<void>
  onRemove?: (id: string) => void | Promise<void>
}

export interface UseCalendarEvents {
  calendars: Ref<Calendar[]>
  hiddenCalendars: Ref<string[]>
  toggleCalendar: (id: string) => void
  events: ComputedRef<CalendarEvent[]>
  eventsByDay: ComputedRef<Map<string, CalendarEvent[]>>
  eventsForDay: (day: Date) => CalendarEvent[]
  eventsForDays: (days: Date[]) => CalendarEvent[]
  loading: ComputedRef<boolean>
  /** Re-reads the range in view — the same handle the grid reads from, so a
    reload can never miss it the way a retyped cache key could. */
  refresh: () => Promise<void>
  warmRange: (range: DateRange) => Promise<void>
  moveEvent: (event: CalendarEvent, start: Date) => Promise<void>
  createEvent: (event: CalendarEvent) => Promise<void> | void
  updateEvent: (event: CalendarEvent) => Promise<void> | void
  removeEvent: (id: string) => Promise<void> | void
}

/*
 * Keyed and queried by floating local strings so server and client agree: an
 * epoch key differs by the timezone offset between them, so hydration would miss
 * the payload cache and refetch.
 */
function eventsKey({ start, end }: DateRange): string {
  return `events-${toLocalDatetime(start)}-${toLocalDatetime(end)}`
}

/** Recomputes `end` from `DEFAULT_DURATION_MINUTES`; it is never persisted. */
function withDerivedEnd(event: CalendarEvent, start: Date): CalendarEvent {
  const end = new Date(start)
  end.setMinutes(end.getMinutes() + DEFAULT_DURATION_MINUTES)

  return { ...event, start: toLocalDatetime(start), end: toLocalDatetime(end) }
}

export function useCalendarEvents(options: UseCalendarEventsOptions): UseCalendarEvents {
  const { range, view, prevDate, nextDate } = useCalendarRange()
  const nuxtApp = useNuxtApp()
  const overlay = options.events

  function toggleCalendar(id: string) {
    const hidden = options.hiddenCalendars.value
    options.hiddenCalendars.value = hidden.includes(id)
      ? hidden.filter(hiddenId => hiddenId !== id)
      : [...hidden, id]
  }

  // One cached fetch per visible range: revisiting a range renders instantly
  // from the payload cache instead of requesting again
  const rangeData = useAsyncData<CalendarEvent[]>(
    () => eventsKey(range.value),
    () => options.fetchRange(range.value),
    {
      default: () => [],
      getCachedData: (key, app, ctx) => {
        // A manual re-read (filters, create, business switch, drag commit)
        // must hit the network: the payload still holds the previous answer
        // for this key, and returning it turns `refresh()` into a silent
        // no-op that leaves the grid behind. Only the initial server read and
        // hydration may reuse it — the same rule Nuxt's own default applies.
        if (ctx?.cause === 'refresh:manual' || ctx?.cause === 'refresh:hook') {
          return undefined
        }

        return app.payload.data[key] ?? app.static.data[key]
      }
    }
  )

  const fetchedEvents = rangeData.data
  const status = rangeData.status

  // Warm the payload cache for the adjacent ranges so prev/next navigation
  // never waits on the network
  async function warmRange(target: DateRange) {
    const key = eventsKey(target)
    if (key in nuxtApp.payload.data) {
      return
    }

    try {
      nuxtApp.payload.data[key] = await options.fetchRange(target)
    } catch {
      // Warming is best-effort, navigation will fetch normally
    }
  }

  onNuxtReady(() => {
    watch(range, () => {
      // The month view fetches a fixed six weeks up front instead
      if (view.value === 'month') {
        return
      }

      warmRange(rangeFor(view.value, prevDate.value))
      warmRange(rangeFor(view.value, nextDate.value))
    }, { immediate: true })
  })

  // The merged pool is a superset; each view filters by its own days. Local
  // entries are layered over whatever the server returns, so a mutation lands
  // before its fetch does.
  const events = computed<CalendarEvent[]>(() => {
    const merged = new Map<string, CalendarEvent>(fetchedEvents.value.map(event => [event.id, event]))
    for (const event of overlay.value) {
      merged.set(event.id, event)
    }

    return [...merged.values()].filter(event => !options.hiddenCalendars.value.includes(event.calendarId))
  })

  // Every view renders a handful of days and used to scan the whole pool once
  // per day, which the month grid makes expensive. Bucketing once per change
  // turns those scans into seven lookups.
  const eventsByDay = computed(() => {
    const buckets = new Map<string, CalendarEvent[]>()

    for (const event of events.value) {
      const end = parseLocalDatetime(event.end)

      // Ranges are [start, end), so an event ending at midnight stops on the
      // previous day and one with no duration still covers its own
      let day = startOfDay(parseLocalDatetime(event.start))
      do {
        const key = dayKey(day)
        const bucket = buckets.get(key)

        if (bucket) {
          bucket.push(event)
        } else {
          buckets.set(key, [event])
        }

        day = addDays(day, 1)
      } while (day < end)
    }

    return buckets
  })

  function eventsForDay(day: Date): CalendarEvent[] {
    return eventsByDay.value.get(dayKey(day)) ?? []
  }

  // Multi-day events land in every bucket they cover, so a span of days has to
  // deduplicate them
  function eventsForDays(days: Date[]): CalendarEvent[] {
    const seen = new Set<string>()

    return days.flatMap(day => eventsForDay(day).filter((event) => {
      if (seen.has(event.id)) {
        return false
      }

      seen.add(event.id)

      return true
    }))
  }

  function loading(): boolean {
    return status.value === 'pending' && !events.value.length
  }

  function upsert(event: CalendarEvent) {
    options.events.value = [...overlay.value.filter(entry => entry.id !== event.id), event]
  }

  function drop(id: string) {
    options.events.value = overlay.value.filter(entry => entry.id !== id)
  }

  // Optimistic: the local map updates on drop, the caller persists. A failure
  // restores the overlay and rethrows so it can toast and roll back.
  async function moveEvent(event: CalendarEvent, start: Date) {
    const previous = overlay.value
    const moved = withDerivedEnd(event, start)

    upsert(moved)

    try {
      await options.onCommit(moved, start)
    } catch (error) {
      options.events.value = previous
      throw error
    }
  }

  function createEvent(event: CalendarEvent) {
    upsert(event)

    return options.onCreate?.(event)
  }

  function updateEvent(event: CalendarEvent) {
    upsert(event)

    return options.onUpdate?.(event)
  }

  function removeEvent(id: string) {
    drop(id)

    return options.onRemove?.(id)
  }

  return {
    calendars: options.calendars,
    hiddenCalendars: options.hiddenCalendars,
    toggleCalendar,
    events,
    eventsByDay,
    eventsForDay,
    eventsForDays,
    loading: computed(loading),
    refresh: () => rangeData.refresh(),
    warmRange,
    moveEvent,
    createEvent,
    updateEvent,
    removeEvent
  }
}

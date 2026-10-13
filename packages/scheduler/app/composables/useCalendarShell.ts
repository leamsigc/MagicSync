import type { Calendar } from '#layers/BaseShared/shared/calendarTypes'
import type { CalendarEvent } from '#layers/BaseShared/shared/calendarTypes'
import type { PostWithBusinessData } from '#layers/BaseDB/db/schema'
import type { ServiceResponse } from '#layers/BaseDB/server/services/types'
import type { PostFilters } from '#layers/BaseScheduler/server/utils/SchedulerTypes'
import { toDate, toLocalDatetime, type DateRange } from '#layers/BaseUI/app/utils/calendarDates'
import { useCalendarEvents, type UseCalendarEvents } from '#layers/BaseUI/app/composables/useCalendarEvents'
import { useCalendarRange } from '#layers/BaseUI/app/composables/useCalendarRange'
import { useCalendarDragCommit, type PostCalendarEvent } from './useCalendarDragCommit'
import { useCalendarPosts } from './useCalendarPosts'

/**
 * The post calendar's data layer.
 *
 * Everything the shell template needs and nothing it renders: the range the grid
 * fetches, the filters that narrow it, the commit that moves a post and the
 * delete that removes one. `PostCalendarShell.vue` stays a template because the
 * branchy decisions all live here, each under the five-branch budget.
 *
 * Three rules the whole file obeys:
 *
 * 1. **The grid is cross-business.** The sidebar decides which businesses are
 *    visible; the range never does. A business switch re-reads the same range
 *    instead of clearing it, so moving where a new post goes never wipes the
 *    grid.
 * 2. **The grid never lies.** A drop paints immediately through the drag
 *    overlay, and only a successful server answer keeps it.
 * 3. **No silent failures.** Every rejected read or write raises a toast.
 */
export interface UseCalendarShell {
  /** What `BaseCalendarView` is handed: the pooled events with the in-flight drags over them. */
  calendar: ComputedRef<UseCalendarEvents>
  /** The businesses the sidebar lists, each with its derived color. */
  calendars: ComputedRef<Calendar[]>
  /** Businesses whose posts the grid is hiding. */
  hiddenBusinessIds: Ref<string[]>
  /** True while a drop is waiting on the server. */
  dragging: ReadonlyRef<boolean>
  /** True when the visible range loaded and holds no events at all. */
  isEmpty: ComputedRef<boolean>
  /** The date the range is anchored on, as a real `Date` for the create modal. */
  anchorDate: ComputedRef<Date>
  /** Re-reads the range in view. */
  reload: () => Promise<void>
  /** Persists a drop, then re-reads the range. */
  commit: (event: PostCalendarEvent, start: Date) => Promise<void>
  /** Removes a post after an explicit confirm. */
  remove: (post: PostWithBusinessData) => void
  /** Applies the filter popover's selection and re-reads the range. */
  applyFilters: (filters: PostFilters) => Promise<void>
  /** Drops every filter and re-reads the range. */
  clearFilters: () => Promise<void>
}

/** The only query keys the calendar honours. A date range is the grid's job, not the popover's. */
const FILTER_KEYS = ['status', 'postFormat', 'dateType', 'platforms'] as const

/**
 * The filters as a query string.
 *
 * Doubles as the change guard: an unchanged selection produces an unchanged
 * string, so reopening the popover and pressing Apply twice fires one request
 * rather than two.
 */
function filterQuery(filters: PostFilters): string {
  const params = new URLSearchParams()

  for (const key of FILTER_KEYS) {
    const value = filters[key]

    if (value === undefined || value === '') {
      continue
    }

    params.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }

  return params.toString()
}

/**
 * The post calendar's pool, overlay and mutations.
 */
export function useCalendarShell(): UseCalendarShell {
  const { t } = useI18n()
  const toast = useToast()
  const { date } = useCalendarRange()
  const { calendars, hiddenBusinessIds, toCalendarEvents } = useCalendarPosts()
  const { commitMove, dragging, withPending } = useCalendarDragCommit()
  const { deletePost } = usePostManager()
  const requestFetch = useRequestFetch()

  const appliedFilters = ref<PostFilters>({})

  /** Both at once, so the overlay survives until the server's answer replaces it. */
  async function commit(event: PostCalendarEvent, start: Date) {
    await Promise.all([commitMove(event, start), reload()])
  }

  /**
   * Reads one range.
   *
   * A client navigation goes through `$fetch`; a server render has to carry the
   * browser's cookies across, or every authenticated endpoint answers 401
   * during SSR and the payload hydration misses.
   */
  async function loadRange(target: DateRange): Promise<CalendarEvent[]> {
    const bounds = new URLSearchParams({
      start: toLocalDatetime(target.start),
      end: toLocalDatetime(target.end)
    })

    const filters = filterQuery(appliedFilters.value)

    try {
      const response = await requestFetch<ServiceResponse<PostWithBusinessData[]>>(
        `/api/v1/posts/calendar?${[bounds.toString(), filters].filter(Boolean).join('&')}`
      )

      if (response?.error) {
        toast.add({ title: response.error, icon: 'i-heroicons-x-circle', color: 'error' })

        return []
      }

      return toCalendarEvents(response?.data ?? [])
    } catch (error) {
      log.error({ message: 'Failed to load the calendar range', error: String(error) })
      toast.add({ title: t('toast.calendarRangeLoadFailed'), icon: 'i-heroicons-x-circle', color: 'error' })

      return []
    }
  }

  /*
   * No optimistic entries of its own: the overlay below is the only thing this
   * calendar lays over the fetched range, so the pool starts empty.
   */
  const pool = useCalendarEvents({
    events: shallowRef<CalendarEvent[]>([]),
    hiddenCalendars: hiddenBusinessIds,
    calendars,
    fetchRange: loadRange,
    onCommit: (event, start) => commit(event as PostCalendarEvent, start)
  })

  /**
   * The pool with the in-flight drags laid over it.
   *
   * The generic pool caches by range and knows nothing about a pending move, so
   * the overlay is applied on the way out rather than fed back in: a drop paints
   * before its request lands, and a rejection drops the overlay instead of
   * leaving a grid that disagrees with the database.
   */
  function withPendingOverlay(events: CalendarEvent[]): CalendarEvent[] {
    return withPending(events as PostCalendarEvent[])
  }

  const calendar = computed<UseCalendarEvents>(() => ({
    ...pool,
    events: withPendingOverlay(pool.events.value),
    eventsForDay: (day: Date) => withPendingOverlay(pool.eventsForDay(day)),
    eventsForDays: (days: Date[]) => withPendingOverlay(pool.eventsForDays(days))
  }))

  const isEmpty = computed(() => !pool.loading.value && pool.events.value.length === 0)

  const anchorDate = computed(() => toDate(date.value))

  /**
   * Re-reads the range in view through the pool's own handle — the same
   * `useAsyncData` the grid reads, so a create, a filter change or a business
   * switch can never address a stale cache key and leave the grid behind.
   */
  async function reload() {
    await pool.refresh()
  }

  // The grid is cross-business: a switch moves where a new post goes, not what
  // the grid draws, so the same range is simply re-read. Nothing is scoped to
  // the previous business — there is no pagination or selection to reset — and
  // the pool replaces an in-flight response instead of racing it.
  const activeBusinessId = useState<string | undefined>('business:id')

  watch(activeBusinessId, () => {
    reload()
  })

  async function applyFilters(filters: PostFilters) {
    if (filterQuery(filters) === filterQuery(appliedFilters.value)) {
      return
    }

    appliedFilters.value = filters

    await reload()
  }

  async function clearFilters() {
    appliedFilters.value = {}

    await reload()
  }

  function remove(post: PostWithBusinessData) {
    toast.add({
      title: t('toast.postRemoveConfirmTitle'),
      description: t('toast.postRemoveConfirmBody', { title: post.content }),
      color: 'error',
      actions: [
        {
          label: t('common.delete'),
          color: 'error',
          variant: 'solid',
          onClick: async () => {
            try {
              await deletePost(post.id)
              toast.add({ title: t('toast.postRemoved'), icon: 'i-heroicons-check-circle', color: 'success' })
              await reload()
            } catch (error) {
              log.error({ message: 'Failed to delete post', postId: post.id, error: String(error) })
              toast.add({ title: t('toast.postRemoveFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
            }
          }
        },
        { label: t('common.cancel'), color: 'neutral', variant: 'outline' }
      ]
    })
  }

  return {
    calendar,
    calendars,
    hiddenBusinessIds,
    dragging,
    isEmpty,
    anchorDate,
    reload,
    commit,
    remove,
    applyFilters,
    clearFilters
  }
}

import type { BusinessProfile, Post, PostWithBusinessData } from '#layers/BaseDB/db/schema'
import type { ServiceResponse } from '#layers/BaseDB/server/services/types'
import type { Calendar, CalendarEvent, CalendarColorToken } from '#layers/BaseShared/shared/calendarTypes'
import { DEFAULT_DURATION_MINUTES } from '#layers/BaseShared/shared/calendarTypes'
import { assignBusinessColorTokens } from '#layers/BaseShared/shared/businessColor'
import { useBusinessManager } from '#layers/BaseShared/app/composables/useBusinessManager'
import { usePostManager } from '#layers/BaseShared/app/composables/usePostManager'
import { toLocalDatetime } from '#layers/BaseUI/app/utils/calendarDates'

/** How much of the post body the event chip shows before it truncates. */
const TITLE_MAX_LENGTH = 80

/** The reschedule primitive; `PATCH /api/v1/posts/{id}/schedule` owns it. */
function scheduleEndpoint(postId: string): string {
  return `/api/v1/posts/${postId}/schedule`
}

/**
 * Post → calendar wiring.
 *
 * Everything the calendar needs to render and to move a post lives here: the
 * business list it draws its "calendars" from, the colour each business is
 * given, the post → event mapping, and the reschedule call. It knows nothing
 * about drag — the grid hands `reschedulePost` a date and this composable
 * decides what that means on the wire.
 *
 * Colour is derived, never persisted: `assignBusinessColorTokens` is a pure
 * function of the visible business list, so the same businesses always get the
 * same colours on every render, reload and device.
 *
 * A successful move re-runs the shared posts loader, so the calendar is never
 * the only surface that knows about the new time.
 */
export const useCalendarPosts = () => {
  const { t } = useI18n()
  const toast = useToast()
  const { businesses: businessList } = useBusinessManager()
  const { getPosts, activeBusinessId } = usePostManager()

  const businesses = computed<BusinessProfile[]>(() => businessList.value?.data ?? [])

  const colorTokens = computed<Map<string, CalendarColorToken>>(() => assignBusinessColorTokens(businesses.value))

  const calendars = computed<Calendar[]>(() => businesses.value.map(business => ({
    id: business.id,
    name: business.name,
    color: colorTokens.value.get(business.id) ?? 'primary',
  })))

  // MUST stay useState (never module scope): module state is a process singleton
  // on the server, so one request's hidden set would leak into the next one's
  // SSR HTML.
  const hiddenBusinessIds = useState<string[]>('calendar:hidden-businesses', () => [])

  function toggleBusiness(id: string) {
    const hidden = hiddenBusinessIds.value
    hiddenBusinessIds.value = hidden.includes(id)
      ? hidden.filter(hiddenId => hiddenId !== id)
      : [...hidden, id]
  }

  function colorFor(post: PostWithBusinessData): CalendarColorToken {
    return colorTokens.value.get(post.businessId) ?? 'primary'
  }

  /**
   * One post as one event.
   *
   * `end` is derived from `DEFAULT_DURATION_MINUTES` — a post has a single
   * `scheduledAt` and no duration column, so nothing persists an end.
   *
   * Use `toCalendarEvents` to map a range: it drops the undated posts. This one
   * falls back to now only so a mis-call cannot crash the grid.
   */
  function toCalendarEvent(post: PostWithBusinessData): CalendarEvent<PostWithBusinessData> {
    const scheduledAt = post.scheduledAt ?? new Date()
    const end = new Date(scheduledAt)
    end.setMinutes(end.getMinutes() + DEFAULT_DURATION_MINUTES)

    return {
      id: post.id,
      calendarId: post.businessId,
      title: post.content.slice(0, TITLE_MAX_LENGTH),
      start: toLocalDatetime(scheduledAt),
      end: toLocalDatetime(end),
      color: colorFor(post),
      post,
    }
  }

  /**
   * A range of posts as events, in one pass.
   *
   * A post with no `scheduledAt` cannot be placed on a grid, so it is dropped
   * here rather than silently landing on today. It stays reachable through
   * `/app/posts`, which is the undated view.
   */
  function toCalendarEvents(posts: PostWithBusinessData[]): CalendarEvent<PostWithBusinessData>[] {
    return posts
      .filter(post => !!post.scheduledAt)
      .map(post => toCalendarEvent(post))
  }

  /**
   * Re-run the shared posts loader so `/app/posts` and the dashboard tell the
   * truth after a move.
   *
   * `posts:list` is one `useState` the whole app reads, so re-running the loader
   * is what invalidates it. The call matches the repo's own convention for a
   * post mutation — `usePostManager.deletePost` and
   * `PostsTableView.handleRefresh` both re-read the active business at
   * `{ page: 1, limit: 100 }` — so a reschedule and a delete leave the list in
   * the same shape.
   *
   * A failure here is logged, never surfaced: the move itself already landed, so
   * raising a second toast would tell the user the wrong thing.
   */
  async function refreshSharedPosts(): Promise<void> {
    try {
      await getPosts(activeBusinessId.value, { page: 1, limit: 100 })
    } catch (error) {
      log.error({ message: 'Failed to reload the posts list after a reschedule', error: String(error) })
    }
  }

  /**
   * Move a post to a new instant.
   *
   * Never throws: the caller gets a `ServiceResponse` and can roll its
   * optimistic entry back from it. A failure always toasts — a silent drop
   * after a drag looks like the drag worked.
   */
  async function reschedulePost(postId: string, scheduledAt: Date): Promise<ServiceResponse<Post>> {
    try {
      const response = await $fetch<ServiceResponse<Post>>(scheduleEndpoint(postId), {
        method: 'PATCH',
        body: { scheduledAt: toLocalDatetime(scheduledAt) },
      })

      await refreshSharedPosts()

      return response
    } catch (error: unknown) {
      const fetchError = error as { data?: { message?: string }, message?: string }
      const message = fetchError?.data?.message || fetchError?.message || t('toast.postRescheduleFailed')

      log.error({ message: 'Failed to reschedule post', postId, error: String(error) })
      toast.add({ title: message, icon: 'i-heroicons-x-circle', color: 'error' })

      return { success: false, error: message }
    }
  }

  return {
    businesses,
    calendars,
    hiddenBusinessIds,
    toggleBusiness,
    colorFor,
    reschedulePost,
    refreshSharedPosts,
    toCalendarEvent,
    toCalendarEvents,
  }
}

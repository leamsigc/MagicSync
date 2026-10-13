/**
 * Drag → persist → rollback, for a post calendar.
 *
 * The grid hands over a drop and this composable owns everything that happens
 * after it: refuse what cannot move, lay the new time over the grid while the
 * request is in flight, roll that one event back when the server says no, and
 * reload the shared posts list when it says yes.
 *
 * Two rules it never breaks:
 *
 * 1. **Nothing is rewritten.** A target inside `SCHEDULE_BUFFER_MS` is refused,
 *    not nudged forward — that nudge is the defect in the legacy
 *    `PUT /api/v1/posts/[id]:73-75`, and it is how a post publishes itself the
 *    moment it is dropped too early. The endpoint refuses the same target with a
 *    422, so a bad drop fails on the client and on the server alike.
 * 2. **The grid never lies.** A pending move lives in a local map that only a
 *    successful request keeps. A rejection or a failure deletes the entry, and
 *    the next fetch restores the stored time.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the composable
 * @todo [✔] Update the typescript.
 */
import type { Ref } from 'vue'
import type { CalendarEvent } from '#layers/BaseShared/shared/calendarTypes'
import type { PostWithBusinessData } from '#layers/BaseDB/db/schema'
import { DEFAULT_DURATION_MINUTES } from '#layers/BaseShared/shared/calendarTypes'
import { parseLocalDatetime, toLocalDatetime } from '#layers/BaseUI/app/utils/calendarDates'
import { isPast, isReschedulable } from '#layers/BaseScheduler/app/utils/scheduler/posts/reschedule'

/** A calendar event that carries a post — the only kind this composable accepts. */
export type PostCalendarEvent = CalendarEvent<PostWithBusinessData>

export interface UseCalendarDragCommit {
  /** The in-flight drops, keyed by post id. The optimistic overlay, nothing more. */
  pendingMoves: Readonly<Ref<Map<string, Date>>>
  /** True while a commit is in flight, so the shell can show it. */
  dragging: Readonly<Ref<boolean>>
  /** Fetched events with every pending move laid over the top. */
  withPending: (events: PostCalendarEvent[]) => PostCalendarEvent[]
  /** Move one event. Never throws. */
  commitMove: (event: PostCalendarEvent, start: Date) => Promise<void>
}

/**
 * The same event at a new start.
 *
 * `end` stays `start + DEFAULT_DURATION_MINUTES` behind it, because a post has
 * one `scheduledAt` and no duration column — the block's height is a painted
 * minimum, not a stored length. The post's own `scheduledAt` is carried with it
 * so the chip, the popover and the drag preview all read the new time at once.
 */
function shiftEvent(event: PostCalendarEvent, start: Date): PostCalendarEvent {
  const previous = parseLocalDatetime(event.start)
  const duration = parseLocalDatetime(event.end).getTime() - previous.getTime()
  const end = new Date(start.getTime() + duration)

  return {
    ...event,
    start: toLocalDatetime(start),
    end: toLocalDatetime(end),
    post: { ...event.post, scheduledAt: start },
  }
}

export function useCalendarDragCommit(): UseCalendarDragCommit {
  const { t } = useI18n()
  const toast = useToast()
  const { reschedulePost } = useCalendarPosts()

  const pendingMoves = ref<Map<string, Date>>(new Map())
  const dragging = ref(false)

  function refuse(message: string) {
    log.warn({ message: 'Reschedule refused before the request', reason: message })
    toast.add({ title: message, icon: 'i-heroicons-exclamation-triangle', color: 'error' })
  }

  function withPending(events: PostCalendarEvent[]): PostCalendarEvent[] {
    if (pendingMoves.value.size === 0) {
      return events
    }

    return events.map((event) => {
      const next = pendingMoves.value.get(event.id)

      return next ? shiftEvent(event, next) : event
    })
  }

  /**
   * Move one event.
   *
   * Never throws — a rejected promise inside a pointer handler would leave the
   * optimistic entry on screen with no way to clear it.
   */
  async function commitMove(event: PostCalendarEvent, start: Date): Promise<void> {
    const post = event.post

    if (!isReschedulable(post)) {
      refuse(t('toast.postNotReschedulable', { status: post.status }))
      return
    }

    if (isPast(start)) {
      refuse(t('toast.rescheduleTooSoon'))
      return
    }

    // Optimistic from here: the grid shows the new time while the server answers
    pendingMoves.value.set(post.id, start)
    dragging.value = true

    const result = await reschedulePost(post.id, start)

    // Rolled back either way. Only a success survives, and only because the next
    // fetch agrees with the database
    pendingMoves.value.delete(post.id)
    dragging.value = false

    if (!result.success) {
      // `reschedulePost` already raised the server's own reason as an error toast
      return
    }

    toast.add({ title: t('toast.postRescheduled', { time: toLocalDatetime(start) }), icon: 'i-heroicons-check-circle', color: 'success' })
  }

  return {
    pendingMoves: readonly(pendingMoves),
    dragging: readonly(dragging),
    withPending,
    commitMove,
  }
}

/**
 * Whether a post may move, and where it may move to.
 *
 * The gate is shared with the endpoint: `RESCHEDULABLE_STATUSES` lives in
 * `#layers/BaseShared/shared/calendarTypes` so the server's 409 and the client's
 * refusal toast can never drift apart, and `isPast` is the same
 * `SCHEDULE_BUFFER_MS` arithmetic on both sides.
 *
 * Nothing here rewrites a target. The legacy `PUT /api/v1/posts/[id]` answered a
 * past `scheduledAt` by pulling it forward to now; the calendar instead refuses
 * the gesture and rolls its optimistic entry back.
 */

import type { Post } from '#layers/BaseDB/db/schema'
import { SCHEDULE_BUFFER_MS, isReschedulableStatus } from '#layers/BaseShared/shared/calendarTypes'

/** The one field this module needs off a post row. */
export interface ReschedulablePost {
  status: Post['status']
}

/** `draft` and `pending` may move. `published` and `failed` may not. */
export function isReschedulable(post: ReschedulablePost): boolean {
  return isReschedulableStatus(post.status)
}

/**
 * True when the target is closer than the buffer, or already behind us.
 *
 * A drop five minutes from now would leave the scheduler no time to cancel a
 * publish already in flight, so it is refused rather than accepted.
 */
export function isPast(target: Date, bufferMs: number = SCHEDULE_BUFFER_MS): boolean {
  return target.getTime() <= Date.now() + bufferMs
}

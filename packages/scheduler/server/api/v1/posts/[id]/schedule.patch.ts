/**
 * PATCH /api/v1/posts/[id]/schedule - Move one post to a new instant.
 *
 * The calendar's drag commit. A reschedule is a single-field change: the body is
 * one key deep, so `content`, `mediaAssets` and `targetPlatforms` cannot be
 * written through here even by accident.
 *
 * Three refusals, none of them a rewrite. The legacy `PUT /api/v1/posts/[id]`
 * answers a past `scheduledAt` by silently pulling it back to now
 * (`index.put.ts:73-75`), which publishes a post the instant someone drops it
 * too early. This route refuses instead and lets the caller roll its optimistic
 * event back:
 *
 * - 422  the target is inside `SCHEDULE_BUFFER_MS`, or the body is malformed
 * - 409  the post is `published` or `failed`
 * - 404  the post is not the caller's (indistinguishable from an unknown id)
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import type { Post } from '#layers/BaseDB/db/schema'
import type { ServiceResponse } from '#layers/BaseDB/server/services/types'
import { SCHEDULE_BUFFER_MS, isReschedulableStatus } from '#layers/BaseShared/shared/calendarTypes'
import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { postService } from '#layers/BaseDB/server/services/post.service'

/**
 * `YYYY-MM-DDTHH:mm[:ss]` with no offset — the calendar's floating local form.
 *
 * Copied from `calendar.get.ts`, which does not export it: a route file's module
 * scope runs `defineEventHandler`, so importing one route from another would
 * register the wrong handler. `parseMessage` below is a copy of the same helper
 * for the same reason. Consolidate both behind a shared server util when a
 * third route needs them.
 */
const localDatetime = z.iso.datetime({ local: true })

const scheduleBodySchema = z.object({
  scheduledAt: localDatetime,
}).refine(
  value => new Date(value.scheduledAt).getTime() > Date.now() + SCHEDULE_BUFFER_MS,
  {
    path: ['scheduledAt'],
    message: 'A post can only be moved at least 5 minutes into the future',
  },
)

/**
 * The field-level reason behind a failed parse, as copy a user can read.
 *
 * Both routes validate by hand (`readBody` + `safeParse`) rather than through
 * h3's `readValidatedBody`, which reshapes the failure into its own error
 * object and lets the caller decide one status for every malformed shape.
 */
function parseMessage(error: z.ZodError): string {
  return error.issues[0]?.message || 'Invalid schedule'
}

/** An error raised on purpose already says what the caller needs to hear. */
function refuse(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: message, data: { message } })
}

/** The route param, or a refusal — the calendar never sends a move without an id. */
function postIdOf(event: H3Event): string {
  const postId = getRouterParam(event, 'id')

  if (!postId) {
    throw refuse(400, 'Post ID is required')
  }

  return postId
}

/**
 * The post, owned by the caller or nothing.
 *
 * `findById` folds `userId` into the predicate, so another user's post answers
 * the same 404 as an unknown id. Reading before writing is also what lets this
 * route name the status in the 409 instead of updating a row it should refuse —
 * and a move needs only the row itself, so no relation is loaded.
 */
async function loadOwnedPost(postId: string, userId: string): Promise<Post> {
  const loaded = await postService.findById(postId, userId)

  if (!loaded.success || !loaded.data) {
    throw refuse(404, 'Post not found')
  }

  return loaded.data as Post
}

/** `published` and `failed` refuse; `draft` and `pending` are allowed through. */
function assertReschedulable(status: string) {
  if (isReschedulableStatus(status)) {
    return
  }

  throw refuse(409, `A ${status} post cannot be rescheduled`)
}

/** A service refusal keeps its own code when it has one; otherwise it is a bad request. */
function statusFor(result: ServiceResponse<unknown>): number {
  return result.code === 'NOT_FOUND' ? 404 : 400
}

export default defineEventHandler(async (event): Promise<ServiceResponse<Post>> => {
  const log = useLogger(event)

  try {
    const user = await checkUserIsLogin(event)

    const parsed = scheduleBodySchema.safeParse(await readBody(event))

    if (!parsed.success) {
      throw refuse(422, parseMessage(parsed.error))
    }

    const { scheduledAt } = parsed.data
    const postId = postIdOf(event)

    const post = await loadOwnedPost(postId, user.id)
    assertReschedulable(post.status)

    log.set({ postId, scheduledAt, userId: user.id })

    const result = await postService.update(postId, user.id, { scheduledAt: new Date(scheduledAt) })

    if (!result.success || !result.data) {
      throw refuse(statusFor(result), result.error ?? 'Failed to reschedule post')
    }

    return { success: true, data: result.data }
  } catch (error: unknown) {
    if ((error as { statusCode?: number })?.statusCode) {
      throw error
    }

    log.error('Failed to reschedule post', { error: String(error) })
    throw refuse(500, 'Internal server error')
  }
})

/**
 * GET /api/v1/posts/calendar - Posts for a date range, across every business the
 * caller may read.
 *
 * The calendar asks for one whole range at once — it has no pagination surface —
 * and hands back the business alongside each post so an event can be labelled
 * without a second request.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import type { PostWithBusinessData } from '#layers/BaseDB/db/schema'
import type { ServiceResponse } from '#layers/BaseDB/server/services/types'
import { z } from 'zod'
import { getQuery } from 'h3'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { postService } from '#layers/BaseDB/server/services/post.service'

/** `YYYY-MM-DDTHH:mm[:ss]` with no offset — the calendar's floating local form. */
const localDatetime = z.iso.datetime({ local: true })

/** Three months of posts is already a pathological calendar range. */
const MAX_RANGE_DAYS = 90

const MS_PER_DAY = 24 * 60 * 60 * 1000

const calendarQuerySchema = z.object({
  start: localDatetime,
  end: localDatetime,
  businessIds: z.string().optional(),
  status: z.enum(['pending', 'published', 'failed']).optional(),
  postFormat: z.enum(['post', 'reel', 'story', 'short']).optional(),
  dateType: z.enum(['scheduledAt', 'createdAt', 'publishedAt']).optional(),
  platforms: z.string().optional(),
  windowStart: localDatetime.optional(),
  windowEnd: localDatetime.optional(),
}).refine(query => new Date(query.end).getTime() > new Date(query.start).getTime(), {
  message: 'Range end must be after start',
  path: ['end'],
})

function parseList(raw?: string): string[] | undefined {
  if (!raw) {
    return undefined
  }

  const ids = raw.split(',').map(id => id.trim()).filter(id => id.length > 0)

  return ids.length > 0 ? ids : undefined
}

/** An absent bound leaves the range side untouched. */
function optionalDate(raw?: string): Date | undefined {
  return raw ? new Date(raw) : undefined
}

/** The field-level reason behind a failed parse, as copy a user can read. */
function parseMessage(error: z.ZodError): string {
  return error.issues[0]?.message || 'Invalid calendar range'
}

export default defineEventHandler(async (event): Promise<ServiceResponse<PostWithBusinessData[]>> => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)

    // `getQuery` + `safeParse` rather than `getValidatedQuery`: the h3 helper
    // reshapes a refinement failure into its own error object, and this route
    // answers every malformed shape the same way — 422 with the reason — so the
    // one place that decides the shape is here
    const parsed = calendarQuerySchema.safeParse(getQuery(event))

    if (!parsed.success) {
      log.set({ validationError: true, message: parseMessage(parsed.error) })
      throw createError({
        statusCode: 422,
        statusMessage: 'Invalid calendar range',
        data: { message: parseMessage(parsed.error) },
      })
    }

    const { start, end } = parsed.data
    const startDate = new Date(start)
    const endDate = new Date(end)

    if (endDate.getTime() - startDate.getTime() > MAX_RANGE_DAYS * MS_PER_DAY) {
      log.set({ validationError: true, message: 'Range too large' })
      throw createError({
        statusCode: 422,
        statusMessage: 'Range too large',
      })
    }

    log.set({ start, end, userId: user.id })

    return await postService.findByBusinessIdsForRange(user.id, {
      start: startDate,
      end: endDate,
      businessIds: parseList(parsed.data.businessIds),
      status: parsed.data.status,
      postFormat: parsed.data.postFormat,
      dateType: parsed.data.dateType,
      platforms: parseList(parsed.data.platforms),
      windowStart: optionalDate(parsed.data.windowStart),
      windowEnd: optionalDate(parsed.data.windowEnd),
    })
  } catch (error: any) {
    if (error?.statusCode) {
      throw error
    }

    log.error('Failed to load calendar range', { error: String(error) })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error',
    })
  }
})

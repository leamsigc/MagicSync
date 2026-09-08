import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { autoReplyService } from '#layers/BaseScheduler/server/services/AutoReply.service'
import { z } from 'zod'

const querySchema = z.object({
  socialAccountId: z.string().min(1),
  limit: z.coerce.number().min(1).max(25).default(10),
})

/**
 * GET /api/v1/auto-reply/media?socialAccountId=…&limit=10 — recent Instagram
 * media (id, thumbnail, caption, counts) for the campaign post-picker UI.
 * IDs returned here are Instagram media IDs — the same IDs watched-post
 * lists expect (NOT MagicSync internal post IDs).
 */
export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const parsed = querySchema.parse(getQuery(event))
  const result = await autoReplyService.listRecentMedia(user.id, parsed.socialAccountId, parsed.limit)
  if (result.error) {
    const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'UNSUPPORTED' ? 400 : 500
    throw createError({ statusCode: status, statusMessage: result.error })
  }
  return { success: true, data: result.data }
})

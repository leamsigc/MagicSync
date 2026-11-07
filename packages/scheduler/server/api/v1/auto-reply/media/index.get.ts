import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { autoReplyService } from '#layers/BaseScheduler/server/services/AutoReply.service'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
import { z } from 'zod'

const querySchema = z.object({
  socialAccountId: z.string().min(1),
  limit: z.coerce.number().min(1).max(25).default(10),
})

/**
 * GET /api/v1/auto-reply/media?socialAccountId=…&limit=10 — posts MagicSync
 * published on this account, for the campaign post-picker.
 *
 * Only `platform_posts` rows with `status = 'published'` and a real platform id
 * qualify, and only on Instagram/TikTok accounts. The returned `id` is the
 * platform post id — exactly what a watched-post list matches against, NOT a
 * MagicSync internal post id. Native media is covered by the match-all switch.
 */
export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const parsed = querySchema.parse(getQuery(event))

  const account = await socialMediaAccountService.getAccountById(parsed.socialAccountId)
  if (!account) {
    throw createError({ statusCode: 404, statusMessage: 'Social media account not found' })
  }
  if (account.businessId) {
    const access = await requireBusinessAccess(event, user.id, account.businessId)
    if (!access.success || !access.data) {
      throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error ?? 'Access denied' })
    }
  } else if (account.userId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }

  const result = await autoReplyService.listPublishedPosts(user.id, parsed.socialAccountId, parsed.limit)
  if (result.error) {
    const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'UNSUPPORTED' ? 400 : 500
    throw createError({ statusCode: status, statusMessage: result.error })
  }
  return { success: true, data: result.data }
})

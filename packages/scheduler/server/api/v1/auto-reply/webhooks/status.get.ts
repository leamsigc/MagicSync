import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { autoReplyWebhookService } from '#layers/BaseScheduler/server/services/AutoReplyWebhook.service'

/**
 * GET /api/v1/auto-reply/webhooks/status — what the user must paste into the
 * Meta app dashboard (callback URL) + whether the server verify token is set.
 */
export default defineEventHandler(async (event) => {
  await checkUserIsLogin(event)
  const result = await autoReplyWebhookService.getStatus()
  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }
  return { success: true, data: result.data }
})

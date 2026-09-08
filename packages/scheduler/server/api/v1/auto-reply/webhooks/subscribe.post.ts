import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { autoReplyWebhookService } from '#layers/BaseScheduler/server/services/AutoReplyWebhook.service'
import { z } from 'zod'

const subscribeSchema = z.object({
  socialAccountId: z.string().min(1),
})

/**
 * POST /api/v1/auto-reply/webhooks/subscribe — subscribe the account's Page
 * to webhook fields (`/{page-id}/subscribed_apps`, feed + messages).
 * Needs pages_manage_metadata (auth.ts scopes — reconnect after scope changes).
 * The app-dashboard subscription to the Instagram object (comments, messages,
 * story_mentions) stays a manual one-time step (see docs).
 */
export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readValidatedBody(event, subscribeSchema.parse)
  const result = await autoReplyWebhookService.subscribePage(body.socialAccountId, user.id)
  if (result.error) {
    const status = result.code === 'NOT_FOUND' ? 404 : 502
    throw createError({ statusCode: status, statusMessage: result.error })
  }
  return { success: true, data: result.data }
})

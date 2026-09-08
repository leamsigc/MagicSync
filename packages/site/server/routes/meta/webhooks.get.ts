import { autoReplyWebhookService } from '#layers/BaseScheduler/server/services/AutoReplyWebhook.service'

/**
 * Meta webhook verification (Phase B).
 * Meta calls GET /meta/webhooks?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…
 * when you register the callback URL in the app dashboard (Instagram object →
 * comments, messages, story_mentions). Echo the challenge only on token match.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const mode = String(query['hub.mode'] || '')
  const token = String(query['hub.verify_token'] || '')
  const challenge = String(query['hub.challenge'] || '')
  const result = autoReplyWebhookService.verifySubscription(mode, token, challenge)
  if (result.error || !result.data) {
    throw createError({ statusCode: result.code === 'NOT_CONFIGURED' ? 500 : 403, statusMessage: result.error || 'Forbidden' })
  }
  return result.data
})

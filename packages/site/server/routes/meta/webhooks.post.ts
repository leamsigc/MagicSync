import { autoReplyWebhookService } from '#layers/BaseScheduler/server/services/AutoReplyWebhook.service'
import { autoReplyService } from '#layers/BaseScheduler/server/services/AutoReply.service'

/**
 * Meta webhook receiver (Phase B, openreply parity).
 * Verifies X-Hub-Signature-256 (FB secret, then IG secret), persists events as
 * `autoreply_seen` rows (idempotent on redelivery), then drains them inline so
 * DMs go out in seconds. The 15m `autoreply:process` task re-drains leftovers
 * (receiver crash, send failure) — poll remains the reconciler backstop.
 * Always answers fast; Meta disables endpoints that time out or 5xx.
 */
export default defineEventHandler(async (event) => {
  try {
    const rawBody = await readRawBody(event, 'utf8')
    const signature = getHeader(event, 'x-hub-signature-256') || ''
    if (!rawBody || !autoReplyWebhookService.verifySignature(rawBody, signature)) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid signature' })
    }
    let payload: unknown = null
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return { received: 0, stored: 0 }
    }
    const ingested = await autoReplyWebhookService.ingestPayload(payload)
    let sent = 0
    if (ingested.success && (ingested.data?.stored || 0) > 0) {
      try {
        const drained = await autoReplyService.drainSeenEvents()
        sent = drained.success ? drained.data?.sent || 0 : 0
      } catch {
        // Left for the task backstop — never fail the webhook.
      }
    }
    return {
      received: ingested.data?.received || 0,
      stored: ingested.data?.stored || 0,
      duplicates: ingested.data?.duplicates || 0,
      sent,
    }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 400, statusMessage: 'Bad webhook payload' })
  }
})

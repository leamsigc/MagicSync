import { z } from 'zod'
import { designWebhookService } from '#layers/BaseDB/server/services/design-webhook.service'
import { requireDesignAuth } from '../../../../utils/design-auth'
import { deliverDesignWebhook, DESIGN_WEBHOOK_EVENTS } from '../../../../utils/design-webhook'
import { designRateLimit, DESIGN_RATE_RULES } from '../../../../utils/design-rate-limit'

/** List the caller's design webhooks (secret redacted). */
export default defineEventHandler(async (event) => {
  const principal = await requireDesignAuth(event)
  const result = await designWebhookService.list(principal.userId)
  if (!result.success) throw createError({ statusCode: 500, statusMessage: result.error ?? 'Failed to list webhooks' })
  return {
    events: DESIGN_WEBHOOK_EVENTS,
    webhooks: result.data,
  }
})

import { z } from 'zod'
import { designWebhookService } from '#layers/BaseDB/server/services/design-webhook.service'
import { requireDesignAuth } from '../../../../../utils/design-auth'
import { deliverDesignWebhook } from '../../../../../utils/design-webhook'
import { designRateLimit, DESIGN_RATE_RULES } from '../../../../../utils/design-rate-limit'

const testSchema = z.object({
  event: z.enum(['render.completed', 'batch.completed', 'render.failed']).default('render.completed'),
})

/** Send a signed test payload to the webhook so the settings UI can verify it. */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const principal = await requireDesignAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!designRateLimit(`${principal.userId}:${id}`, DESIGN_RATE_RULES.webhook)) {
    throw createError({ statusCode: 429, statusMessage: 'Test-event rate limit reached' })
  }
  const parsed = testSchema.safeParse(await readBody(event) ?? {})
  const testEvent = parsed.success ? parsed.data.event : 'render.completed'

  const targets = await designWebhookService.listDeliveryTargets(principal.userId)
  const target = targets.find(entry => entry.id === id)
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Webhook not found' })

  const ok = await deliverDesignWebhook(target, {
    event: 'render.completed',
    data: { test: true, requested: testEvent, sentAt: new Date().toISOString() },
  })
  await designWebhookService.recordAttempt(principal.userId, target.id, 'render.completed', ok, undefined)
  log.set({ webhookId: target.id, ok })
  return { ok }
})

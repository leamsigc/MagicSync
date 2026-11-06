import { z } from 'zod'
import { designWebhookService } from '#layers/BaseDB/server/services/design-webhook.service'
import { requireDesignAuth } from '../../../../utils/design-auth'
import { DESIGN_WEBHOOK_EVENTS } from '../../../../utils/design-webhook'

const createSchema = z.object({
  url: z.string().url().max(600).startsWith('https://'),
  events: z.array(z.enum(DESIGN_WEBHOOK_EVENTS)).min(1),
  description: z.string().max(200).optional(),
})

/** Create a design webhook (HMAC secret generated server-side). */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const principal = await requireDesignAuth(event)
  const body = await readValidatedBody(event, raw => createSchema.parse(raw))
  const result = await designWebhookService.create(principal.userId, {
    url: body.url,
    events: body.events,
    description: body.description,
  })
  if (!result.success || !result.data) {
    throw createError({ statusCode: 400, statusMessage: result.error ?? 'Failed to create webhook' })
  }
  log.set({ webhookId: result.data.id })
  return result.data
})

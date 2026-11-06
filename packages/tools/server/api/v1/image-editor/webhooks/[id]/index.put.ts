import { z } from 'zod'
import { designWebhookService } from '#layers/BaseDB/server/services/design-webhook.service'
import { requireDesignAuth } from '../../../../../utils/design-auth'

const patchSchema = z.object({
  active: z.boolean().optional(),
  events: z.array(z.enum(['render.completed', 'batch.completed', 'render.failed'])).min(1).optional(),
  description: z.string().max(200).optional(),
})

/** Update a design webhook (toggle active, events, description). */
export default defineEventHandler(async (event) => {
  const principal = await requireDesignAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readValidatedBody(event, raw => patchSchema.parse(raw))
  const result = await designWebhookService.update(principal.userId, id, body)
  if (!result.success || !result.data) {
    throw createError({ statusCode: result.error === 'Webhook not found' ? 404 : 400, statusMessage: result.error ?? 'Failed to update webhook' })
  }
  return result.data
})

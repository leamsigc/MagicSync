import { designWebhookService } from '#layers/BaseDB/server/services/design-webhook.service'
import { requireDesignAuth } from '../../../../../utils/design-auth'

/** Delete a design webhook by id. */
export default defineEventHandler(async (event) => {
  const principal = await requireDesignAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const result = await designWebhookService.delete(principal.userId, id)
  if (!result.success) {
    throw createError({ statusCode: result.error === 'Webhook not found' ? 404 : 500, statusMessage: result.error ?? 'Failed to delete webhook' })
  }
  return result.data
})

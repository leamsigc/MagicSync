import { designWebhookService } from '#layers/BaseDB/server/services/design-webhook.service'
import { requireDesignAuth } from '../../../../../utils/design-auth'

/** Reveal the signing secret for one webhook — show-once in the settings UI. */
export default defineEventHandler(async (event) => {
  const principal = await requireDesignAuth(event)
  const id = getRouterParam(event, 'id') ?? ''
  const result = await designWebhookService.revealSecret(principal.userId, id)
  if (!result.success || !result.data) {
    throw createError({ statusCode: 404, statusMessage: result.error ?? 'Webhook not found' })
  }
  return { secret: result.data.secret }
})

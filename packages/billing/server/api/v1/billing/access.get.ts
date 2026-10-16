import { billingService } from '#layers/BaseBilling/server/services/billing.service'

/**
 * The access decision, without the rest of the billing read. The route
 * middleware calls this once per session so a blocked account is caught without
 * loading the whole overview.
 */
export default defineEventHandler(async (event) => {
  const result = await billingService.access(event)
  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }
  return result.data
})

import { billingService } from '#layers/BaseBilling/server/services/billing.service'

/**
 * The billing page's one read. Returns the Stripe-backed overview for the
 * signed-in user; degrades to `configured: false` when Stripe is not set up.
 */
export default defineEventHandler(async (event) => {
  const result = await billingService.overview(event)
  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }
  return result.data
})

import { SchedulerPost } from '#layers/BaseScheduler/server/services/SchedulerPost.service'
import { GoogleMyBusinessPlugin } from '#layers/BaseScheduler/server/services/plugins/googlemybusiness.plugin'
import { reviewService } from '#layers/BaseDB/server/services/review.service'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const reviewId = getRouterParam(event, 'reviewId')
  if (!reviewId) throw createError({ statusCode: 400, message: 'Review ID required' })

  const body = await readBody(event)
  const { businessId, response } = body
  if (!businessId) throw createError({ statusCode: 400, message: 'businessId is required' })
  if (!response?.trim()) throw createError({ statusCode: 400, message: 'response content is required' })

  const business = await businessProfileService.findById(businessId, user.id)
  if (business.error) throw createError({ statusCode: 404, message: business.error })

  const review = await reviewService.findById(reviewId, user.id)
  if (review.error) throw createError({ statusCode: 404, message: review.error })

  const gmbAccounts = await socialMediaAccountService.getAccounts({ businessId, platform: 'googlemybusiness' })
  if (!gmbAccounts.length) throw createError({ statusCode: 404, message: 'No GMB account connected' })

  const tokens = await socialMediaAccountService.getDecryptedTokens(gmbAccounts[0])
  if (!tokens.accessToken) throw createError({ statusCode: 401, message: 'GMB access token unavailable' })

  const reviewName = review.data!.platformReviewId

  const scheduler = new SchedulerPost({})
  const plugin = new GoogleMyBusinessPlugin(scheduler)
  await plugin.replyToReview(reviewName, response, tokens.accessToken)

  const updated = await reviewService.addResponse(reviewId, user.id, response)

  log.info({ message: 'GMB review reply sent via plugin', businessId, reviewId })
  return updated
})

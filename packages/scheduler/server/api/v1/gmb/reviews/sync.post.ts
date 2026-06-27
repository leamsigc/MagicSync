import { SchedulerPost } from '#layers/BaseScheduler/server/services/SchedulerPost.service'
import { GoogleMyBusinessPlugin } from '#layers/BaseScheduler/server/services/plugins/googlemybusiness.plugin'
import { reviewService } from '#layers/BaseDB/server/services/review.service'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { formatReviewForStorage } from '#layers/BaseDB/server/utils/googleMyBusiness'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const body = await readBody(event)
  const businessId = body.businessId
  if (!businessId) throw createError({ statusCode: 400, message: 'businessId is required' })

  const business = await businessProfileService.findById(businessId, user.id)
  if (business.error) throw createError({ statusCode: 404, message: business.error })
  if (!business.data?.googleBusinessId) throw createError({ statusCode: 400, message: 'Business not connected to GMB' })

  const gmbAccounts = await socialMediaAccountService.getAccounts({ businessId, platform: 'googlemybusiness' })
  if (!gmbAccounts.length) throw createError({ statusCode: 404, message: 'No GMB account connected' })

  const tokens = await socialMediaAccountService.getDecryptedTokens(gmbAccounts[0])
  if (!tokens.accessToken) throw createError({ statusCode: 401, message: 'GMB access token unavailable' })

  const scheduler = new SchedulerPost({})
  const plugin = new GoogleMyBusinessPlugin(scheduler)
  const { reviews: gmbReviews } = await plugin.getReviews(business.data.googleBusinessId, tokens.accessToken, { pageSize: 50 })

  const synced: any[] = []
  for (const gmbReview of gmbReviews) {
    const formatted = formatReviewForStorage(gmbReview as any, businessId)
    const existing = await reviewService.findByPlatformReviewId('google_my_business', formatted.platformReviewId)
    if (existing.data) {
      const updResult = await reviewService.update(existing.data.id, user.id, {
        responseContent: formatted.responseContent || undefined,
        responseDate: formatted.responseDate || undefined,
      })
      if (updResult.data) synced.push(updResult.data)
    } else {
      const createResult = await reviewService.create({
        businessId: formatted.businessId,
        platform: formatted.platform,
        platformReviewId: formatted.platformReviewId,
        authorName: formatted.authorName,
        authorImage: formatted.authorImage || undefined,
        rating: formatted.rating,
        content: formatted.content,
        reviewDate: formatted.reviewDate,
      })
      if (createResult.data) synced.push(createResult.data)
    }
  }

  log.info({ message: 'GMB reviews synced via plugin', businessId, count: synced.length })
  return { success: true, data: synced }
})

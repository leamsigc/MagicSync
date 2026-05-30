import { reviewService } from '#layers/BaseDB/server/services/review.service'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'
import { generateReviewScreenshotHTML } from '#layers/BaseDB/server/utils/googleMyBusiness'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const query = getQuery(event)
  const businessId = query.businessId as string
  const reviewId = getRouterParam(event, 'reviewId')
  if (!businessId || !reviewId) throw createError({ statusCode: 400, message: 'businessId query param and reviewId route param required' })

  const reviewResult = await reviewService.findById(reviewId, user.id)
  if (reviewResult.error) throw createError({ statusCode: 404, message: reviewResult.error })

  const businessResult = await businessProfileService.findById(businessId, user.id)
  if (businessResult.error) throw createError({ statusCode: 404, message: businessResult.error })

  const review = reviewResult.data!
  const business = businessResult.data!

  const html = generateReviewScreenshotHTML({
    authorName: review.authorName,
    authorImage: review.authorImage || undefined,
    rating: review.rating,
    content: review.content,
    reviewDate: review.reviewDate instanceof Date ? review.reviewDate : new Date(review.reviewDate),
    businessName: business.name,
  })

  setHeader(event, 'Content-Type', 'text/html')
  return html
})

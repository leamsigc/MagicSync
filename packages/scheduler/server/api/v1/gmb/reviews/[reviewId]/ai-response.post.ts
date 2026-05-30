import { reviewService } from '#layers/BaseDB/server/services/review.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const reviewId = getRouterParam(event, 'reviewId')
  if (!reviewId) throw createError({ statusCode: 400, message: 'Review ID required' })

  const body = await readBody(event)
  const businessContext = body.businessContext as string | undefined

  const result = await reviewService.generateAIResponse(reviewId, businessContext)

  log.info('AI review response generated', { reviewId })
  return result
})

import { reviewService } from '#layers/BaseDB/server/services/review.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const query = getQuery(event)
  const businessId = query.businessId as string
  if (!businessId) throw createError({ statusCode: 400, message: 'businessId query param required' })

  const startDate = query.startDate ? new Date(query.startDate as string) : undefined
  const endDate = query.endDate ? new Date(query.endDate as string) : undefined

  const result = await reviewService.getStats(businessId, user.id, { startDate, endDate })

  return result
})

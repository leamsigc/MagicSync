import { reviewService } from '#layers/BaseDB/server/services/review.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const query = getQuery(event)
  const businessId = query.businessId as string
  if (!businessId) throw createError({ statusCode: 400, message: 'businessId query param required' })

  const page = parseInt(query.page as string) || 1
  const limit = parseInt(query.limit as string) || 20
  const minRating = query.minRating ? parseInt(query.minRating as string) : undefined
  const maxRating = query.maxRating ? parseInt(query.maxRating as string) : undefined
  const hasResponse = query.hasResponse !== undefined ? query.hasResponse === 'true' : undefined
  const platform = query.platform as string || 'google_my_business'
  const sortField = query.sortField as string || 'reviewDate'
  const sortDirection = (query.sortDirection as string) || 'desc'

  const result = await reviewService.findByBusinessId(businessId, user.id, {
    pagination: { page, limit },
    filters: { platform, minRating, maxRating, hasResponse },
    sort: { field: sortField as 'rating' | 'reviewDate', direction: sortDirection as 'asc' | 'desc' },
  })

  return result
})

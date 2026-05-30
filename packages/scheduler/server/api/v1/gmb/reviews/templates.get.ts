import { reviewService } from '#layers/BaseDB/server/services/review.service'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const rating = parseInt(query.rating as string) || 5

  const templates = reviewService.getResponseTemplates(rating)

  return { success: true, data: templates }
})

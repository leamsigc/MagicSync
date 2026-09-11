import { z } from 'zod'
import { FEEDBACK_CATEGORIES, feedbackService } from '#layers/BaseDB/server/services/feedback.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

const FeedbackSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z.string().min(10).max(2000),
})

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)

  const body = await readValidatedBody(event, FeedbackSchema.parse)

  const result = await feedbackService.create(user.id, user.name ?? null, body)
  if (result.error) {
    throw createError({ statusCode: 500, message: result.error })
  }

  return result.data
})

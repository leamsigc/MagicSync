import { z } from 'zod'
import { FEEDBACK_STATUSES, feedbackService } from '#layers/BaseDB/server/services/feedback.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

const FeedbackUpdateSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES),
  adminNote: z.string().max(2000).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Feedback ID is required' })
  }

  const body = await readValidatedBody(event, FeedbackUpdateSchema.parse)

  const result = await feedbackService.setStatus(id, body.status, body.adminNote ?? null)
  if (result.error) {
    throw createError({ statusCode: result.error === 'Feedback not found' ? 404 : 500, message: result.error })
  }

  return result.data
})

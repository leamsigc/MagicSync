import { feedbackService } from '#layers/BaseDB/server/services/feedback.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Feedback ID is required' })
  }

  const result = await feedbackService.remove(id)
  if (result.error) {
    throw createError({ statusCode: 500, message: result.error })
  }

  return { success: true }
})

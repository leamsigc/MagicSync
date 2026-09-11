import { feedbackService } from '#layers/BaseDB/server/services/feedback.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const result = await feedbackService.listAll()
  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return { feedbacks: result.data }
})

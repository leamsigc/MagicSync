import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { documentService } from '#layers/BaseDB/server/services/document.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)

  const result = await documentService.findByUser(user.id)

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})

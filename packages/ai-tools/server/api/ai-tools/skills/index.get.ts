import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { skillService } from '#layers/BaseDB/server/services/skill.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)

  const result = await skillService.findByUser(user.id)

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})
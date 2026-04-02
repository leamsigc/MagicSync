import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { skillService } from '#layers/BaseDB/server/services/skill.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Skill ID required' })
  }

  const body = await readBody(event)

  const result = await skillService.update(id, user.id, body)

  if (result.error) {
    throw createError({ statusCode: 404, statusMessage: result.error })
  }

  return result.data
})
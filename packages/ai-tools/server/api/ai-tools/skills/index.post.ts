import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { skillService } from '#layers/BaseDB/server/services/skill.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body.name || !body.description || !body.instructions) {
    throw createError({ statusCode: 400, statusMessage: 'Name, description, and instructions are required' })
  }

  const result = await skillService.create(user.id, {
    name: body.name,
    description: body.description,
    instructions: body.instructions,
    isGlobal: body.isGlobal
  })

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})
import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'
import { skillRegistryService } from '#layers/BaseDB/server/services/skill-registry.service'

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)
  const body = await readBody(event)
  const result = await skillRegistryService.createSkill(user.id, body, event)
  if (!result.success) {
    throw createError({ statusCode: result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' ? 403 : 400, message: result.error })
  }
  return result
})
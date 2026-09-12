import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'
import { agentRegistryService } from '#layers/BaseDB/server/services/agent-registry.service'

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)
  const body = await readBody(event)
  const businessId = typeof body?.businessId === 'string' ? body.businessId : null
  if (!businessId) throw createError({ statusCode: 400, message: 'businessId is required' })
  const result = await agentRegistryService.ensureBuiltins(user.id, businessId, user.email || user.id, event)
  if (!result.success) {
    throw createError({ statusCode: result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' ? 403 : 400, message: result.error })
  }
  return result
})
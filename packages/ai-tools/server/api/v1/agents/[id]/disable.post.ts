import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'
import { agentRegistryService } from '#layers/BaseDB/server/services/agent-registry.service'

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Agent ID is required' })
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : null
  const result = await agentRegistryService.disableAgent(user.id, id, businessId, event)
  if (!result.success) {
    throw createError({ statusCode: result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' ? 403 : 400, message: result.error })
  }
  return result
})
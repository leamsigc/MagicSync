import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'
import { contentArtifactService } from '#layers/BaseDB/server/services/content-artifact.service'

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Artifact ID is required' })
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : null
  if (!businessId) throw createError({ statusCode: 400, statusMessage: 'businessId is required' })
  const body = await readBody(event)
  const result = await contentArtifactService.reviewArtifact(user.id, id, businessId, body, event)
  if (!result.success) {
    const statusCode = result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' ? 403 : 400
    throw createError({ statusCode, statusMessage: result.error })
  }
  return result
})
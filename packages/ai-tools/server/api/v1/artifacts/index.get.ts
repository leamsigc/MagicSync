import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'
import { contentArtifactService } from '#layers/BaseDB/server/services/content-artifact.service'

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : null
  if (!businessId) throw createError({ statusCode: 400, statusMessage: 'businessId is required' })
  const threadId = typeof query.threadId === 'string' ? query.threadId : null
  const runId = typeof query.runId === 'string' ? query.runId : null
  const result = await contentArtifactService.listArtifacts(user.id, { businessId, threadId, runId }, event)
  if (!result.success) {
    const statusCode = result.code === 'NOT_FOUND'
      ? 404
      : result.code === 'FORBIDDEN'
        ? 403
        : result.code === 'SERVICE_UNAVAILABLE'
          ? 503
          : 400
    throw createError({ statusCode, statusMessage: result.error })
  }
  return result
})
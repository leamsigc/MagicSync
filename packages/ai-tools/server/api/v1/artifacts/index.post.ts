import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'
import { contentArtifactService } from '#layers/BaseDB/server/services/content-artifact.service'

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)
  const body = await readBody(event)
  const result = await contentArtifactService.submitArtifact(user.id, body, event)
  if (!result.success) {
    const statusCode = result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' ? 403 : 400
    throw createError({ statusCode, statusMessage: result.error })
  }
  return result
})
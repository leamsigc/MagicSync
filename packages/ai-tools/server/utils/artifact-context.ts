import type { H3Event } from 'h3'
import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'
import { contentArtifactService } from '#layers/BaseDB/server/services/content-artifact.service'

/** Auth + artifact loading shared by the artifact check routes. Throws typed HTTP errors. */
export async function loadArtifactContext(event: H3Event) {
  const user = await aiToolsFacade.authenticate(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Artifact ID is required' })
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : null
  if (!businessId) throw createError({ statusCode: 400, statusMessage: 'businessId is required' })
  const artifact = await contentArtifactService.getArtifact(user.id, id, businessId, event)
  if (!artifact.success || !artifact.data) {
    throw createError({ statusCode: 404, statusMessage: artifact.success ? 'Artifact not found' : artifact.error })
  }
  return { userId: user.id, businessId, artifact: artifact.data }
}

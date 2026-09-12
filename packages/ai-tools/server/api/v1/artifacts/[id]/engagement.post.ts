import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'
import { contentArtifactService } from '#layers/BaseDB/server/services/content-artifact.service'

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Artifact ID is required' })
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : null
  if (!businessId) throw createError({ statusCode: 400, statusMessage: 'businessId is required' })

  const artifact = await contentArtifactService.getArtifact(user.id, id, businessId, event)
  if (!artifact.success || !artifact.data) {
    throw createError({ statusCode: 404, statusMessage: 'Artifact not found' })
  }
  const llmJwtResult = await aiToolsFacade.getLlmJwtContext(user.id, user.email || '', businessId)
  const llmJwt = llmJwtResult.data?.token ?? ''
  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'
  const body = await readBody(event).catch(() => ({})) as { postIds?: string[] }

  return await $fetch(`${backendUrl}/api/v1/tools/analyze`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${llmJwt}` },
    body: {
      tool: 'engagement_calc',
      args: { post_ids: body.postIds ?? [], content: artifact.data.output },
    },
  })
})

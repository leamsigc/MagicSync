import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const id = getRouterParam(event, 'id')

  log.set({ agentId: id })

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Agent ID required' })
  }

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  const llmJwtResult = await aiToolsFacade.getLlmJwtContext(user.id, user.email || '')
  const llmJwt = llmJwtResult.data?.token ?? ''

  try {
    await $fetch(`${backendUrl}/api/v1/agent/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${llmJwt}` },
    })
  } catch {
    // Backend delete is best-effort
  }

  await aiToolsFacade.deleteAgentSession(id, user.id)

  return { deleted: true }
})

import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { agentService } from '#layers/BaseDB/server/services/agent.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Agent ID required' })
  }

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  try {
    await $fetch(`${backendUrl}/api/v1/agent/${id}`, {
      method: 'DELETE',
      headers: { 'X-User-Id': user.id },
    })
  } catch {
    // Backend delete is best-effort
  }

  // Delete from DB
  await agentService.delete(id, user.id)

  return { deleted: true }
})

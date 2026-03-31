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

  const result = await $fetch<{
    id: string
    task: string
    status: string
    parent_message_id: string
    step_count: number
    max_steps: number
    result: string | null
    error: string | null
    message_count: number
  }>(`${backendUrl}/api/v1/agent/${id}/status`, {
    headers: { 'X-User-Id': user.id },
  })

  // Sync status to DB
  await agentService.update(id, user.id, {
    status: result.status as any,
    stepCount: result.step_count,
    result: result.result || undefined,
    errorMessage: result.error || undefined,
  })

  return result
})

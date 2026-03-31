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
    content: string | null
    done: boolean
    tool_call: { tool: string; input: Record<string, any> } | null
    step_count: number
    error: string | null
  }>(`${backendUrl}/api/v1/agent/${id}/step`, {
    method: 'POST',
    headers: { 'X-User-Id': user.id },
  })

  // Sync step count and status to DB
  const updateData: any = { stepCount: result.step_count }
  if (result.done) updateData.status = 'completed'
  if (result.error) {
    updateData.status = 'failed'
    updateData.errorMessage = result.error
  }
  await agentService.update(id, user.id, updateData)

  return result
})

import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { agentRunnerService } from '#layers/BaseAgent/server/services/agent-runner.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const runId = getRouterParam(event, 'runId')
  if (!runId) throw createError({ statusCode: 400, statusMessage: 'runId is required' })

  const result = await agentRunnerService.cancel(user.id, runId)
  if (!result.success) {
    throw createError({
      statusCode: result.code === 'RUN_NOT_ACTIVE' ? 409 : 500,
      statusMessage: result.error,
    })
  }
  return result.data
})

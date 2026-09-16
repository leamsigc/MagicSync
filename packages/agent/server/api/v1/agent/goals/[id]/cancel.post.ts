import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { goalOrchestratorService } from '#layers/BaseAgent/server/agentic/goal-orchestrator.service'

/** Cancel a goal run that has not finished yet. */
export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const runId = getRouterParam(event, 'id') ?? ''
  const outcome = await goalOrchestratorService.cancel(user.id, runId)
  if (outcome.status === 'failed') {
    throw createError({ statusCode: outcome.code === 'INVALID_STATE' ? 409 : outcome.code === 'NOT_FOUND' ? 404 : 500, statusMessage: outcome.error })
  }
  return outcome
})

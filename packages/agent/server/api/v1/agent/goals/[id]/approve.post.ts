import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { buildAgentRunConfig, runConfigErrorStatus } from '#layers/BaseAgent/server/utils/run-config'
import { goalOrchestratorService } from '#layers/BaseAgent/server/agentic/goal-orchestrator.service'

const ApprovalSchema = z.object({ approved: z.boolean() })

/**
 * Approve or reject the consequential step a run is paused on. Approving
 * resumes the persisted plan; rejecting cancels the run.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  const runId = getRouterParam(event, 'id') ?? ''
  const body = ApprovalSchema.parse(await readBody(event))

  // Rejection needs no model; resolve the run config lazily on approval.
  if (!body.approved) {
    const cancelled = await goalOrchestratorService.resume({
      userId: user.id,
      runId,
      approved: false,
      complete: async () => '',
      event,
      log,
    })
    if (cancelled.status === 'failed') {
      throw createError({ statusCode: cancelled.code === 'INVALID_STATE' ? 409 : cancelled.code === 'NOT_FOUND' ? 404 : 500, statusMessage: cancelled.error })
    }
    return cancelled
  }

  const loaded = await goalOrchestratorService.get(user.id, runId)
  if (!loaded.success) {
    throw createError({ statusCode: loaded.code === 'NOT_FOUND' ? 404 : 500, statusMessage: loaded.error })
  }
  const businessId = (loaded.data as { businessId: string }).businessId
  const runConfig = await buildAgentRunConfig(user.id, businessId, event)
  if (!runConfig.success) {
    throw createError({ statusCode: runConfigErrorStatus(runConfig.code), message: runConfig.error })
  }

  const outcome = await goalOrchestratorService.resume({
    userId: user.id,
    runId,
    approved: true,
    complete: runConfig.data.complete,
    systemContext: runConfig.data.systemContext,
    event,
    log,
  })
  if (outcome.status === 'failed') {
    throw createError({ statusCode: outcome.code === 'INVALID_STATE' ? 409 : outcome.code === 'NOT_FOUND' ? 404 : 500, statusMessage: outcome.error })
  }
  return outcome
})

import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
import { buildAgentRunConfig, runConfigErrorStatus } from '#layers/BaseAgent/server/utils/run-config'
import { goalOrchestratorService } from '#layers/BaseAgent/server/agentic/goal-orchestrator.service'

const GoalRequestSchema = z.object({
  businessId: z.string().min(1),
  goal: z.string().trim().min(1).max(2000),
})

/**
 * Thin boundary: authenticate → authorize → resolve model → call the agentic
 * orchestrator → stream user-facing progress. No prompts, no agent selection,
 * no skill logic lives here.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  const body = GoalRequestSchema.parse(await readBody(event))

  const access = await requireBusinessAccess(event, user.id, body.businessId)
  if (!access.success) {
    throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
  }
  const runConfig = await buildAgentRunConfig(user.id, body.businessId, event)
  if (!runConfig.success) {
    throw createError({ statusCode: runConfigErrorStatus(runConfig.code), message: runConfig.error })
  }

  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')
  setResponseHeader(event, 'X-Accel-Buffering', 'no')

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }
      const outcome = await goalOrchestratorService.executeGoal({
        userId: user.id,
        businessId: body.businessId,
        goal: body.goal,
        complete: runConfig.data.complete,
        systemContext: runConfig.data.systemContext,
        event,
        log,
        onEvent: send,
      })
      send({ type: 'goal.done', outcome })
      controller.close()
    },
  })
  return sendStream(event, stream)
})

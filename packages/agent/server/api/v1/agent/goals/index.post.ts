import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
import { buildCapabilityRunContext, runCapability } from '#layers/BaseAgent/server/capabilities'

const GoalRequestSchema = z.object({
  businessId: z.string().min(1),
  goal: z.string().trim().min(1).max(2000),
})

/** Authenticate → authorize → resolve tenant/model context → run one capability → stream it. */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  const body = GoalRequestSchema.parse(await readBody(event))

  const access = await requireBusinessAccess(event, user.id, body.businessId)
  if (!access.success) {
    throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
  }

  const runContext = await buildCapabilityRunContext(user.id, body.businessId, {
    useBusinessContext: true,
    event,
    log,
    capability: 'goal.execute',
  })
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }
      const outcome = await runCapability('goal.execute', { goal: body.goal }, {
        ...runContext,
        onEvent: send,
      })
      if (outcome.ok) {
        send({
          type: 'goal.done',
          outcome: {
            goalRunId: outcome.output.goalRunId,
            status: 'completed',
            summary: outcome.output.summary,
            result: outcome.output,
          },
        })
      } else {
        send({
          type: 'goal.done',
          outcome: {
            goalRunId: '',
            status: 'failed',
            error: outcome.error,
            code: outcome.code,
          },
        })
      }
      controller.close()
    },
  })

  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')
  setResponseHeader(event, 'X-Accel-Buffering', 'no')
  return sendStream(event, stream)
})

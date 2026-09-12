import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { pipelineService } from "#layers/BaseDB/server/services/pipeline.service"
import z from 'zod'

const LogAgentRunSchema = z.object({
  pipelineRunId: z.string().optional(),
  agentName: z.string().min(1),
  tokensUsed: z.number().int().min(0).optional(),
  summary: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    const body = await readValidatedBody(event, LogAgentRunSchema.parse)

    log.set({ userId: user.id, agentName: body.agentName })
    const result = await pipelineService.logAgentRun(user.id, body, event)

    if (!result.success) {
      throw createError({
        statusCode: 400,
        statusMessage: result.error || 'Failed to log agent run'
      })
    }

    return result
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    log.error({ content: 'Log agent run error', error: String(error) })
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})

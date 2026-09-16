import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
import { agentWorkflowService } from '#layers/BaseAgent/server/services/agent-workflow.service'

const BatchSchema = z.object({
  businessId: z.string().min(1),
  kind: z.enum(['days', 'carousel', 'reel', 'repurpose']).default('days'),
  days: z.number().int().min(1).max(31).optional(),
  count: z.number().int().min(1).max(31).optional(),
  platforms: z.array(z.string().min(1).max(40)).max(12).optional(),
  topic: z.string().trim().min(1).max(300),
})

/**
 * Starts a topic batch pipeline (research → trend scan → platform-tailored
 * ideas) in the background. Returns the tracking run id immediately; the
 * board polls agent runs for completion.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  const body = BatchSchema.parse(await readBody(event))

  const access = await requireBusinessAccess(event, user.id, body.businessId)
  if (!access.success) {
    throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
  }

  const result = await agentWorkflowService.startTopicBatch({
    userId: user.id,
    businessId: body.businessId,
    kind: body.kind,
    days: body.kind === 'days' ? (body.days ?? 7) : (body.count ?? 3),
    platforms: body.platforms ?? [],
    topic: body.topic,
    event,
    log,
  })
  if (!result.success) throw createError({ statusCode: 400, statusMessage: result.error, data: { code: result.code } })
  return { runId: result.data.runId, count: result.data.count, status: 'running' as const }
})

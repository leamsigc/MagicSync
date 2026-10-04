import { z } from 'zod'
import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'
import { contentArtifactService } from '#layers/BaseDB/server/services/content-artifact.service'

const ScheduleArtifactSchema = z.object({
  scheduledAt: z.coerce.date().refine(date => date > new Date(), 'A future scheduledAt is required'),
  targetAccountIds: z.array(z.string().min(1)).min(1).optional(),
})

function errorStatus(code?: string) {
  if (code === 'NOT_FOUND') return 404
  if (code === 'FORBIDDEN') return 403
  return 400
}

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Artifact ID is required' })
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : null
  if (!businessId) throw createError({ statusCode: 400, statusMessage: 'businessId is required' })
  const body = await readBody(event)
  const parsed = ScheduleArtifactSchema.safeParse({
    scheduledAt: body?.scheduledAt,
    targetAccountIds: body?.targetAccountIds,
  })
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Invalid schedule payload' })
  }
  const result = await contentArtifactService.scheduleArtifact(user.id, id, businessId, parsed.data.scheduledAt, event, parsed.data.targetAccountIds)
  if (!result.success) {
    throw createError({ statusCode: errorStatus(result.code), statusMessage: result.error })
  }
  return result
})
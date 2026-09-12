import { authenticateMachineRequest } from "#layers/BaseDB/server/utils/machine-auth"
import { pipelineService } from "#layers/BaseDB/server/services/pipeline.service"

const BATCH_ACTIONS = {
  'multi-day-post': 'posts',
  'multi-day-carousel': 'carousels',
  'multi-day-reel': 'reels',
  'repurpose': 'repurpose',
} as const

export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event, 'utf8') ?? ''
  const authed = await authenticateMachineRequest(event, rawBody)
  if (!authed.success || !authed.data) {
    throw createError({ statusCode: authed.code === 'NOT_FOUND' ? 404 : 401, statusMessage: authed.error })
  }
  const { userId, body } = authed.data
  const businessId = body.businessId as string
  const requested = typeof body.action === 'string' ? body.action : ''
  const action = (BATCH_ACTIONS as Record<string, string>)[requested]
  if (!action) {
    throw createError({ statusCode: 400, statusMessage: `action must be one of ${Object.keys(BATCH_ACTIONS).join(', ')}` })
  }
  const days = typeof body.days === 'number' ? Math.min(Math.max(Math.floor(body.days), 1), 30) : 1
  const theme = typeof body.theme === 'string' ? body.theme : undefined
  const sourcePostId = typeof body.sourcePostId === 'string' ? body.sourcePostId : undefined
  const formats = Array.isArray(body.formats) ? body.formats.filter((format): format is string => typeof format === 'string') : undefined
  const result = await pipelineService.queueQuickAction(userId, {
    action: action as 'posts' | 'carousels' | 'reels' | 'repurpose',
    businessId,
    days,
    theme,
    sourcePostId,
    formats: formats as Array<'posts' | 'carousels' | 'reels'> | undefined,
  }, event)
  if (!result.success) {
    throw createError({ statusCode: 502, statusMessage: result.error })
  }
  return result
})

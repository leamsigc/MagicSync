import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { pipelineService } from "#layers/BaseDB/server/services/pipeline.service"

const CLOSE_STATUSES = ['completed', 'failed', 'cancelled'] as const

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Agent run ID is required' })
  const body = await readBody(event)
  if (!CLOSE_STATUSES.includes(body?.status)) {
    throw createError({ statusCode: 400, statusMessage: 'A terminal status is required' })
  }
  const result = await pipelineService.closeAgentRun(user.id, id, {
    status: body.status,
    tokensUsed: body.tokensUsed,
    cost: body.cost ?? null,
    durationMs: body.durationMs ?? null,
    summary: body.summary,
  }, event)
  if (!result.success) {
    const statusCode = result.code === 'NOT_FOUND' ? 404 : 400
    throw createError({ statusCode, statusMessage: result.error })
  }
  return result
})

import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { pipelineService } from "#layers/BaseDB/server/services/pipeline.service"

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const runId = getRouterParam(event, 'runId')
  if (!runId) throw createError({ statusCode: 400, statusMessage: 'runId is required' })
  const body = await readBody(event)
  const result = await pipelineService.requestChanges(user.id, runId, body?.feedback ?? '', crypto.randomUUID(), event)
  if (!result.success) {
    const statusCode = result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' ? 403 : 400
    throw createError({ statusCode, statusMessage: result.error })
  }
  return result
})
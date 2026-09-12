import { checkUserIsLogin } from "#layers/BaseAuth/server/utils/AuthHelpers"
import { pipelineService } from "#layers/BaseDB/server/services/pipeline.service"

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)
  if (!body?.pipelineId) throw createError({ statusCode: 400, statusMessage: 'pipelineId is required' })
  const result = await pipelineService.startGraphRun(user.id, body.pipelineId, body.input ?? {}, event)
  if (!result.success) {
    const statusCode = result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' ? 403 : 400
    throw createError({ statusCode, statusMessage: result.error })
  }
  return result
})
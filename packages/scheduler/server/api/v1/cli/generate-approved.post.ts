import { authenticateMachineRequest } from "#layers/BaseDB/server/utils/machine-auth"
import { pipelineService } from "#layers/BaseDB/server/services/pipeline.service"

export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event, 'utf8') ?? ''
  const authed = await authenticateMachineRequest(event, rawBody)
  if (!authed.success || !authed.data) {
    throw createError({ statusCode: authed.code === 'NOT_FOUND' ? 404 : 401, statusMessage: authed.error })
  }
  const { userId, body } = authed.data
  const pipelineId = typeof body.pipelineId === 'string' ? body.pipelineId : ''
  if (!pipelineId) {
    throw createError({ statusCode: 400, statusMessage: 'pipelineId is required' })
  }
  const input = body.input && typeof body.input === 'object' && !Array.isArray(body.input)
    ? body.input as Record<string, unknown>
    : {}
  const result = await pipelineService.startGraphRun(userId, pipelineId, input, event)
  if (!result.success) {
    const statusCode = result.code === 'NOT_FOUND' ? 404 : 400
    throw createError({ statusCode, statusMessage: result.error })
  }
  return result
})

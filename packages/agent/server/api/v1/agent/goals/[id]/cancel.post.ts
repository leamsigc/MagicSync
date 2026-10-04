import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { goalRunService } from '#layers/BaseDB/server/services/goal-run.service'

/** Cancel a non-terminal persisted goal run. */
export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const runId = getRouterParam(event, 'id') ?? ''
  const loaded = await goalRunService.get(user.id, runId)
  if (!loaded.success) {
    throw createError({ statusCode: loaded.code === 'NOT_FOUND' ? 404 : 500, statusMessage: loaded.error })
  }
  const terminal = ['completed', 'failed', 'cancelled'].includes(loaded.data.status)
  if (terminal) {
    throw createError({ statusCode: 409, statusMessage: `Run already finished (status: ${loaded.data.status})` })
  }
  const cancelled = await goalRunService.setStatus(runId, 'cancelled')
  if (!cancelled.success) {
    throw createError({ statusCode: cancelled.code === 'NOT_FOUND' ? 404 : 500, statusMessage: cancelled.error })
  }
  return { goalRunId: runId, status: 'cancelled' }
})

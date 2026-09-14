import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
import { agentRunService } from '#layers/BaseAgent/server/services/agent-run.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : ''
  if (!businessId) throw createError({ statusCode: 400, statusMessage: 'businessId is required' })

  const access = await requireBusinessAccess(event, user.id, businessId)
  if (!access.success) {
    throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
  }

  const result = await agentRunService.listByBusiness(user.id, businessId, 50)
  if (!result.success) throw createError({ statusCode: 500, statusMessage: result.error })
  return { runs: result.data }
})

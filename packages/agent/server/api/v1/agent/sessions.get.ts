import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
import { agentSessionService } from '#layers/BaseAgent/server/services/agent-session.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : null

  if (businessId) {
    const access = await requireBusinessAccess(event, user.id, businessId)
    if (!access.success) {
      throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
    }
  }

  const result = await agentSessionService.listSessions(user.id, businessId)
  if (!result.success) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }
  return { sessions: result.data }
})

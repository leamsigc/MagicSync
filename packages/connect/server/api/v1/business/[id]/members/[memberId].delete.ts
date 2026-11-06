import { businessTeamService } from '#layers/BaseAuth/server/services/business-team.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

/**
 * DELETE /api/v1/business/[id]/members/[memberId]
 * Remove a member (by member id or email) from the business organization.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)

  const businessId = getRouterParam(event, 'id')
  const memberIdOrEmail = getRouterParam(event, 'memberId')
  if (!businessId || !memberIdOrEmail) {
    throw createError({ statusCode: 400, message: 'Business ID and member ID are required' })
  }

  log.set({ userId: user.id, businessId, memberIdOrEmail })
  const result = await businessTeamService.removeMember(event, businessId, user.id, memberIdOrEmail)
  if (!result.success) {
    log.error({ message: 'Failed to remove member', error: result.error })
    const statusCode = result.code === 'FORBIDDEN' ? 403 : result.code === 'NOT_FOUND' ? 404 : 400
    throw createError({ statusCode, message: result.error })
  }

  log.info({ message: 'Team member removed', businessId, memberIdOrEmail })
  return result.data
})

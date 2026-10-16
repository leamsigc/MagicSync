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
  const result = await businessTeamService.removeMember(event, businessId, memberIdOrEmail)
  if (!result.success) {
    log.error({ message: 'Failed to remove member', error: result.error })
    throw createError({ statusCode: 400, message: result.error })
  }

  log.info({ message: 'Team member removed', businessId, memberIdOrEmail })
  return result.data
})

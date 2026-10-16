import { businessTeamService } from '#layers/BaseAuth/server/services/business-team.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

/**
 * GET /api/v1/business/[id]/members
 * Team members plus pending invitations for a business.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const businessId = getRouterParam(event, 'id')
  if (!businessId) {
    throw createError({ statusCode: 400, message: 'Business ID is required' })
  }

  const result = await businessTeamService.getTeam(event, businessId)
  if (!result.success) {
    log.error({ message: 'Failed to load team', error: result.error })
    throw createError({ statusCode: 500, message: result.error })
  }

  log.info({
    message: 'Team retrieved',
    businessId,
    memberCount: result.data.members.length,
    pendingInvitations: result.data.invitations.length,
  })
  return result.data
})

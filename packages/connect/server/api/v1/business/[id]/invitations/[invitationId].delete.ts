import { businessTeamService } from '#layers/BaseAuth/server/services/business-team.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

/**
 * DELETE /api/v1/business/[id]/invitations/[invitationId]
 * Cancel a pending invitation for the business organization.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)

  const businessId = getRouterParam(event, 'id')
  const invitationId = getRouterParam(event, 'invitationId')
  if (!businessId || !invitationId) {
    throw createError({ statusCode: 400, message: 'Business ID and invitation ID are required' })
  }

  log.set({ userId: user.id, businessId, invitationId })
  const result = await businessTeamService.cancelInvitation(event, businessId, invitationId)
  if (!result.success) {
    log.error({ message: 'Failed to cancel invitation', error: result.error })
    throw createError({ statusCode: 400, message: result.error })
  }

  log.info({ message: 'Invitation canceled', businessId, invitationId })
  return result.data
})

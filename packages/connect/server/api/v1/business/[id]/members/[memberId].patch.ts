import { businessTeamService } from '#layers/BaseAuth/server/services/business-team.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { z } from 'zod'

const UpdateRoleSchema = z.object({
  // `admin` is intentionally not assignable — admins come from /app/admin/users.
  role: z.enum(['owner', 'member']),
})

/**
 * PATCH /api/v1/business/[id]/members/[memberId]
 * Change a member's role.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)

  const businessId = getRouterParam(event, 'id')
  const memberId = getRouterParam(event, 'memberId')
  if (!businessId || !memberId) {
    throw createError({ statusCode: 400, message: 'Business ID and member ID are required' })
  }

  const body = await readValidatedBody(event, UpdateRoleSchema.parse)
  log.set({ userId: user.id, businessId, memberId, role: body.role })

  const result = await businessTeamService.updateRole(event, businessId, memberId, body.role)
  if (!result.success) {
    log.error({ message: 'Failed to update member role', error: result.error })
    throw createError({ statusCode: 400, message: result.error })
  }

  log.info({ message: 'Team member role updated', businessId, memberId, role: body.role })
  return result.data
})

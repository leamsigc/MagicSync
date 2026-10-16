import { businessTeamService } from '#layers/BaseAuth/server/services/business-team.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { z } from 'zod'

const InviteSchema = z.object({
  email: z.string().email().optional(),
  emails: z.array(z.string().email()).optional(),
  // `admin` is intentionally not assignable — admins come from /app/admin/users.
  role: z.enum(['owner', 'member']).default('member'),
}).refine(data => Boolean(data.email) || (data.emails?.length ?? 0) > 0, {
  message: 'At least one email is required',
  path: ['email'],
})

/**
 * POST /api/v1/business/[id]/invite
 * Invite one email (`email`) or a batch (`emails`) to the business.
 * Returns the created invitations with their accept links.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)

  const businessId = getRouterParam(event, 'id')
  if (!businessId) {
    throw createError({ statusCode: 400, message: 'Business ID is required' })
  }

  const body = await readValidatedBody(event, InviteSchema.parse)
  const emails = body.emails?.length ? body.emails : [body.email as string]
  log.set({ userId: user.id, businessId, inviteCount: emails.length, role: body.role })

  const result = await businessTeamService.invite(event, businessId, emails, body.role)
  if (!result.success) {
    log.error({ message: 'Failed to invite team members', error: result.error })
    throw createError({ statusCode: 400, message: result.error })
  }

  log.info({
    message: 'Team invitations sent',
    businessId,
    sent: result.data.invitations.length,
    failed: result.data.failed.length,
  })
  return { success: true, ...result.data }
})

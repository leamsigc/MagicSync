import { businessOrgService } from '#layers/BaseAuth/server/services/business-org.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { useAuthApi } from '#layers/BaseAuth/server/utils/useAuthApi'
import { z } from 'zod'

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.string().default('member')
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const businessId = getRouterParam(event, 'id')
  if (!businessId) {
    throw createError({ statusCode: 400, message: 'Business ID is required' })
  }

  const body = await readValidatedBody(event, InviteSchema.parse)
  log.set({ businessId, invitedEmail: body.email })

  const org = await businessOrgService.getOrCreateOrgForBusiness(event, businessId)
  const authApi = useAuthApi(event)

  if (!org) {
    throw createError({ statusCode: 404, statusMessage: 'Business not found' })
  }

  try {
    const invitation = await authApi.inviteMember({
      body: {
        email: body.email,
        role: "member",
        organizationId: org.id,
        resend: true,
      }
    })

    log.info({ message: 'Team member invited', email: body.email, organizationId: org.id })
    return { success: true, invitation }
  } catch (error) {
    log.error({ message: 'Failed to invite team member', error })
    throw createError({
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Failed to send invitation'
    })
  }
})

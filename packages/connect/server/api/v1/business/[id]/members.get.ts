import { businessOrgService } from '#layers/BaseAuth/server/services/business-org.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const businessId = getRouterParam(event, 'id')
  if (!businessId) {
    throw createError({ statusCode: 400, message: 'Business ID is required' })
  }

  const org = await businessOrgService.getOrgForBusiness(event, businessId)

  if (!org) {
    return { members: [] }
  }

  log.info({ message: 'Organization members retrieved', organizationId: org.id, memberCount: org.members?.length })
  return { members: org.members ?? [] }
})

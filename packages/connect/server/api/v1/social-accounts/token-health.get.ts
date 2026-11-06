import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const query = getQuery(event)

  const businessId = query.businessId as string
  if (!businessId) {
    throw createError({ statusCode: 400, message: 'Business ID is required' })
  }

  const access = await requireBusinessAccess(event, user.id, businessId)
  if (!access.success || !access.data) {
    throw createError({ statusCode: accessErrorStatus(access.code), message: access.error ?? 'You do not have access to this business' })
  }

  const accounts = await socialMediaAccountService.getBusinessTokenHealth(businessId)

  const summary = {
    total: accounts.length,
    healthy: accounts.filter(a => a.health.status === 'healthy').length,
    expiringSoon: accounts.filter(a => a.health.status === 'expiring_soon').length,
    expired: accounts.filter(a => a.health.status === 'expired').length,
    unknown: accounts.filter(a => a.health.status === 'unknown').length,
    needsAttention: accounts.filter(a => a.health.status === 'expired' || a.health.status === 'expiring_soon').length,
  }

  return { accounts, summary }
})

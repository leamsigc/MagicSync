import { apiKeyService } from '#layers/BaseAuth/server/services/api-key.service'
import { businessOrgService } from '#layers/BaseAuth/server/services/business-org.service'
import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { accessErrorStatus, requireBusinessOwner } from '#layers/BaseDB/server/utils/business-access'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const log = useLogger(event)

  const body = await readBody(event)
  const { businessId, name, expiresIn } = body

  if (!businessId || !name) {
    throw createError({ statusCode: 400, statusMessage: 'Business ID and name are required' })
  }

  const access = await requireBusinessOwner(event, user.id, businessId)
  if (!access.success || !access.data) {
    throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
  }
  log.set({ businessId, userId: user.id, role: access.data.role })

  const connectedAccounts = await socialMediaAccountService.getAccountsByBusinessId(businessId)
  const connectedPlatforms = connectedAccounts.map(acc => acc.platform).filter(Boolean) as string[]

  let org = await businessOrgService.getOrgForBusiness(event, businessId)
  if (!org) {
    org = await businessOrgService.getOrCreateOrgForBusiness(event, businessId)
  }
  if (!org) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to get or create organization' })
  }

  const apiKey = await apiKeyService.createApiKey(event, org.id, name, expiresIn, user.id)

  await logAuditService.logAuditEvent({
    userId: user.id,
    category: 'api-key',
    action: 'create',
    targetType: 'api-key',
    targetId: apiKey.id,
    status: 'success',
    details: `Created API key "${name}" for business "${access.data.business.name}"`
  }, { log })

  return {
    id: apiKey.id,
    name: apiKey.name,
    key: apiKey.key,
    prefix: apiKey.prefix,
    expiresAt: apiKey.expiresAt,
    createdAt: apiKey.createdAt,
    metadata: {
      businessId,
      businessName: access.data.business.name,
      connectedPlatforms
    }
  }
})

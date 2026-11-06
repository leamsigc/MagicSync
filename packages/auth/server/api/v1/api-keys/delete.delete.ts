import { apiKeyService } from '#layers/BaseAuth/server/services/api-key.service'
import { businessOrgService } from '#layers/BaseAuth/server/services/business-org.service'
import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service'
import { accessErrorStatus, requireBusinessOwner } from '#layers/BaseDB/server/utils/business-access'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const { businessId, keyId } = await readBody(event) as { businessId?: string; keyId?: string }
  log.set({ businessId, keyId })

  if (!businessId || !keyId) {
    throw createError({ statusCode: 400, statusMessage: 'Business ID and key ID are required' })
  }

  const access = await requireBusinessOwner(event, user.id, businessId)
  if (!access.success || !access.data) {
    throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
  }

  let org = await businessOrgService.getOrgForBusiness(event, businessId)
  if (!org) {
    org = await businessOrgService.getOrCreateOrgForBusiness(event, businessId)
  }
  if (!org) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to get or create organization' })
  }

  const keys = await apiKeyService.listApiKeys(event, org.id, user.id)
  if (!keys.some(key => key.id === keyId)) {
    throw createError({ statusCode: 404, statusMessage: 'API key not found' })
  }

  await apiKeyService.deleteApiKey(event, keyId)

  log.info({ content: 'API key deleted', keyId, businessId: access.data.business.name })

  await logAuditService.logAuditEvent({
    userId: user.id,
    category: 'api-key',
    action: 'delete',
    targetType: 'api-key',
    targetId: keyId,
    status: 'success',
    details: `Deleted API key for business "${access.data.business.name}"`
  }, { log })

  return { success: true }
})

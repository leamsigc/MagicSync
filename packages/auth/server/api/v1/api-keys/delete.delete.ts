import { apiKeyService } from '#layers/BaseAuth/server/services/api-key.service'
import { businessOrgService } from '#layers/BaseAuth/server/services/business-org.service'
import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const { businessId, keyId } = await readBody(event) as { businessId?: string; keyId?: string }
  log.set({ businessId, keyId })

  if (!businessId || !keyId) {
    throw createError({ statusCode: 400, statusMessage: 'Business ID and key ID are required' })
  }

  // Verify the business belongs to the user
  const businessResult = await businessProfileService.findById(businessId, user.id)
  if (!businessResult.data) {
    throw createError({ statusCode: 404, statusMessage: 'Business not found' })
  }

  // Get existing org or create one if needed, then check membership
  let org = await businessOrgService.getOrgForBusiness(event, businessId)
  if (!org) {
    org = await businessOrgService.getOrCreateOrgForBusiness(event, businessId)
  }
  if (!org) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to get or create organization' })
  }
  if (!businessOrgService.isUserMemberOfOrg(org, user.id)) {
    throw createError({ statusCode: 403, statusMessage: 'You are not a member of this business' })
  }

  await apiKeyService.deleteApiKey(event, keyId)

  log.info({ content: 'API key deleted', keyId, businessId: businessResult.data.name })

  await logAuditService.logAuditEvent({
    userId: user.id,
    category: 'api-key',
    action: 'delete',
    targetType: 'api-key',
    targetId: keyId,
    status: 'success',
    details: `Deleted API key for business "${businessResult.data.name}"`
  })

  return { success: true }
})

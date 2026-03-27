import { apiKeyService } from '#layers/BaseAuth/server/services/api-key.service'
import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  const { businessId, keyId } = body

  if (!businessId || !keyId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Business ID and key ID are required'
    })
  }

  const businessResult = await businessProfileService.findById(businessId, user.id)
  if (!businessResult.data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Business not found'
    })
  }

  await apiKeyService.deleteApiKey(keyId, businessId, user.id)

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

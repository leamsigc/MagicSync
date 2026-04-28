import { apiKeyService } from '#layers/BaseAuth/server/services/api-key.service'
import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const log = useLogger(event)
  try {
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      })
    }

    const body = await readBody(event)
    const { businessId, name, expiresIn } = body

    if (!businessId || !name) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Business ID and name are required'
      })
    }

    const businessResult = await businessProfileService.findById(businessId, user.id)
    log.set({ businessResult })
    if (!businessResult.data) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Business not found'
      })
    }

    const connectedAccounts = await socialMediaAccountService.getAccountsByBusinessId(businessId)
    const connectedPlatforms = connectedAccounts.map(acc => acc.platform).filter(Boolean) as string[]
    log.set({ connectedPlatforms })

    const apiKey = await apiKeyService.createApiKey({
      name,
      businessId,
      userId: user.id,
      expiresIn
    })
    log.set({ apiKey })

    await logAuditService.logAuditEvent({
      userId: user.id,
      category: 'api-key',
      action: 'create',
      targetType: 'api-key',
      targetId: apiKey.id,
      status: 'success',
      details: `Created API key "${name}" for business "${businessResult.data.name}"`
    })

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: apiKey.key,
      prefix: apiKey.prefix,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      metadata: {
        businessId,
        businessName: businessResult.data.name,
        connectedPlatforms
      }
    }
  } catch (err) {
    log.error(err);

    return createError({
      statusCode: 500,
      statusMessage: 'Generic Error here..'
    })
  }
})

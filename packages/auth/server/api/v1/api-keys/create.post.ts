import { apiKeyService } from '#layers/BaseAuth/server/services/api-key.service'
import { businessOrgService } from '#layers/BaseAuth/server/services/business-org.service'
import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const log = useLogger(event)

  const body = await readBody(event)
  const { businessId, name, expiresIn } = body

  if (!businessId || !name) {
    throw createError({ statusCode: 400, statusMessage: 'Business ID and name are required' })
  }

  // Step 1: Verify business belongs to the user
  const businessResult = await businessProfileService.findById(businessId, user.id)
  log.set({ businessResult })
  if (!businessResult.data) {
    throw createError({ statusCode: 404, statusMessage: 'Business not found' })
  }

  // Step 2: Get connected platforms (for response metadata only)
  const connectedAccounts = await socialMediaAccountService.getAccountsByBusinessId(businessId)
  const connectedPlatforms = connectedAccounts.map(acc => acc.platform).filter(Boolean) as string[]
  log.set({ connectedPlatforms })

  // Step 3: Get existing org or create one if needed
  let org = await businessOrgService.getOrgForBusiness(event, businessId)
  if (!org) {
    org = await businessOrgService.getOrCreateOrgForBusiness(event, businessId)
  }
  if (!org) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to get or create organization' })
  }
  log.set({ orgId: org.id })

  // Step 4: Check membership using the org object we already have — no extra API call
  if (!businessOrgService.isUserMemberOfOrg(org, user.id)) {
    throw createError({ statusCode: 403, statusMessage: 'You are not a member of this business' })
  }

  // Step 5: Create the API key using the orgId we already resolved
  const apiKey = await apiKeyService.createApiKey(event, org.id, name, expiresIn, user.id)

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
})

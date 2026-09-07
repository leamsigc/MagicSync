import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { oauthConsentService } from '#layers/BaseDB/server/services/oauth-consent.service'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'
import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service'

const BodySchema = z.object({
  clientId: z.string().min(1),
  businessId: z.string().min(1),
})

/**
 * Attaches the picked business to the OAuth grant. Called by the /consent page
 * AFTER the plugin consent endpoint succeeds and BEFORE navigating to its
 * redirect_uri — order controlled client-side. The plugin endpoint must be
 * called browser-direct (it needs the HTTP request context); this route only
 * does the business binding + audit.
 */
export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const log = useLogger(event)
  const body = await readValidatedBody(event, BodySchema.parse)

  // Business must belong to the user (owner or org member).
  const business = await businessProfileService.findById(body.businessId, user.id, event)
  if (!business.success) {
    throw createError({ statusCode: 403, statusMessage: 'You cannot authorize this business' })
  }

  const attached = await oauthConsentService.attachBusiness(body.clientId, user.id, body.businessId)
  if (!attached.success) {
    log.error('Business attach failed', { error: attached.error })
    throw createError({
      statusCode: 500,
      statusMessage: 'Authorization succeeded but business binding failed — try again',
    })
  }

  log.set({ clientId: body.clientId, businessId: body.businessId })
  await logAuditService.logAuditEvent({
    userId: user.id,
    category: 'oauth',
    action: 'grant',
    targetType: 'oauth-client',
    targetId: body.clientId,
    status: 'success',
    details: `OAuth grant for business ${body.businessId}`,
  })
  return { success: true }
})

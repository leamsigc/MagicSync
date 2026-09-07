import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { oauthConsentService } from '#layers/BaseDB/server/services/oauth-consent.service'
import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service'

/**
 * Revoke an OAuth grant: deletes the consent row AND every token minted from
 * it (refresh + stored access rows). Short-lived JWTs additionally expire on
 * their own; session-bound ones die with the session.
 */
export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody<{ id?: string }>(event)
  if (!body?.id) {
    throw createError({ statusCode: 400, statusMessage: 'Grant id is required' })
  }

  const result = await oauthConsentService.revoke(body.id, user.id)
  if (!result.success) {
    throw createError({ statusCode: 404, statusMessage: result.error })
  }

  await logAuditService.logAuditEvent({
    userId: user.id,
    category: 'oauth',
    action: 'revoke',
    targetType: 'oauth-grant',
    targetId: body.id,
    status: 'success',
  })
  return { success: true }
})

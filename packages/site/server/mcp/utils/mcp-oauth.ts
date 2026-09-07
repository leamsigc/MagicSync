import { verifyAccessTokenRequest } from 'better-auth/oauth2'
import type { ApiKeyContext } from '#layers/BaseAuth/server/services/api-key.service'
import { oauthConsentService } from '#layers/BaseDB/server/services/oauth-consent.service'
import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service'
import { getMcpUrls } from './mcp-urls'

/**
 * OAuth access-token path (Wave 2a-B): verifies a JWT minted by our own
 * @better-auth/mcp authorization server (JWKS-local, no DB round trip for
 * crypto) and resolves it to the same ApiKeyContext shape the Bearer-key path
 * produces — so requireScope/resolveAccounts/enabled/audit all work unchanged.
 *
 * Business binding: the consent row (clientId × userId) carries the businessId
 * picked on the consent screen. Resolved per-request from the stored grant —
 * never from client input. Returns null (soft) on any failure; callers keep
 * the never-401 behavior and the tools stay hidden.
 */
export async function verifyOAuthToken(token: string): Promise<ApiKeyContext | null> {
  const { resource, issuer, jwksUrl } = getMcpUrls()

  let claims
  try {
    claims = await verifyAccessTokenRequest(
      { authorizationHeader: `Bearer ${token}`, method: 'POST', url: resource },
      { verifyOptions: { issuer, audience: resource }, jwksUrl }
    )
  }
  catch {
    return null
  }

  const userId = typeof claims.sub === 'string' ? claims.sub : undefined
  // Client identity claim name varies (client_id / azp / cid) — accept any.
  const clientId = ['client_id', 'azp', 'cid']
    .map(k => (claims as Record<string, unknown>)[k])
    .find((v): v is string => typeof v === 'string')
  if (!userId || !clientId) return null

  const scopeSet = new Set(
    typeof claims.scope === 'string' ? claims.scope.split(' ').filter(Boolean) : []
  )
  // Fail closed: a token without an mcp scope grants nothing.
  const mcpScope = scopeSet.has('mcp:full') ? 'full' : scopeSet.has('mcp:read') ? 'read' : null
  if (!mcpScope) return null

  const business = await oauthConsentService.getBusinessForGrant(clientId, userId)
  if (!business.success || !business.data) return null

  await logAuditService.logAuditEvent({
    userId,
    category: 'mcp',
    action: 'oauth-auth',
    targetType: 'oauth-client',
    targetId: clientId,
    status: 'success',
    details: `business=${business.data} scope=${mcpScope}`,
  })

  return {
    valid: true,
    keyId: `oauth:${clientId}`,
    userId,
    orgId: '',
    businessId: business.data,
    // v1: OAuth grants allow all connected platforms (no per-platform picker
    // on the consent screen yet — same posture as Wave-1 API keys).
    connectedPlatforms: [],
    name: `OAuth:${clientId.slice(0, 12)}`,
    mcpScope,
  }
}

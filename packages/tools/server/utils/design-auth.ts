import { getHeader } from 'h3'
import type { H3Event } from 'h3'
import { apiKeyService, type ApiKeyContext } from '#layers/BaseAuth/server/services/api-key.service'

/**
 * Design-route authentication: session (interactive editor) or
 * `Authorization: Bearer org_…` API key (automation / MCP-adjacent HTTP).
 * Returns a stable principal used for ownership folds.
 */

export interface DesignPrincipal {
  userId: string
  viaKey: boolean
  key?: ApiKeyContext
}

export async function requireDesignAuth(event: H3Event): Promise<DesignPrincipal> {
  const header = getHeader(event, 'authorization') ?? ''
  if (header.startsWith('Bearer ')) {
    const token = header.slice(7).trim()
    if (token.startsWith('org_')) {
      const result = await apiKeyService.verifyApiKey(token)
      if (!result.success || !result.context) {
        throw createError({ statusCode: result.error?.statusCode ?? 401, statusMessage: result.error?.message ?? 'Invalid API key' })
      }
      return { userId: result.context.ownerUserId ?? result.context.userId, viaKey: true, key: result.context }
    }
    throw createError({ statusCode: 401, statusMessage: 'Unsupported bearer token' })
  }
  const user = await checkUserIsLogin(event)
  return { userId: user.id, viaKey: false }
}

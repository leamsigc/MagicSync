import type { ApiKeyContext } from '#layers/BaseAuth/server/services/api-key.service'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { getMcpContext } from './mcp-request'

/**
 * Require a valid MCP key context (from AsyncLocalStorage, set by the handler
 * middleware). Throws a plain (non-401) Error with a user-friendly message —
 * throwing 401 from a tool handler would push MCP clients into OAuth discovery.
 * All tools also hide via `enabled`, so this is belt-and-braces for
 * expired/revoked keys.
 */
export function requireMcp(): ApiKeyContext {
  const mcp = getMcpContext()
  if (!mcp?.valid || !mcp.businessId) {
    throw new Error(
      'Authentication required. Configure your MCP client with a MagicSync API key '
      + '(Authorization: Bearer <key>) and try again.'
    )
  }
  return mcp
}

/**
 * Scope check. API keys without an explicit scope default to full (Wave 1
 * dogfood); OAuth tokens carry their granted scope. Wave 2 issues
 * `mcpScope: 'read' | 'full'` in key metadata + key-management UI.
 */
export function requireScope(mcp: ApiKeyContext, scope: 'read' | 'full'): void {
  const granted = mcp.mcpScope ?? 'full'
  if (scope === 'full' && granted !== 'full') {
    throw new Error(`This tool requires full access, but API key "${mcp.name ?? mcp.keyId}" is read-only.`)
  }
}

/**
 * Resolve a writable userId for service calls. Org-level keys carry no userId,
 * and PostService scopes reads/writes by user — so fall back to the first
 * connected account owner for the key's business.
 */
export async function resolveUserId(mcp: ApiKeyContext): Promise<string> {
  if (mcp.userId) return mcp.userId
  const accounts = await socialMediaAccountService.getAccountsByBusinessId(mcp.businessId)
  const ownerId = accounts.find(a => a.userId)?.userId
  if (!ownerId) {
    throw new Error(
      'This API key is not bound to a user and the business has no connected accounts '
      + 'to attribute activity to. Create a user-bound API key or connect a platform first.'
    )
  }
  return ownerId
}

export interface ResolvedAccounts {
  accounts: Array<{ id: string, platform: string | null, userId: string }>
  userId: string
}

/**
 * Map requested platform names → connected social-account rows for the key's
 * business. Enforces (1) the key's platform allowlist from key metadata when
 * present, (2) business-connected check (mirrors cli/post.post.ts).
 * Returns account rows (PostService.targetPlatforms takes ACCOUNT IDs) plus a
 * writable userId.
 */
export async function resolveAccounts(mcp: ApiKeyContext, platforms: string[]): Promise<ResolvedAccounts> {
  if (mcp.connectedPlatforms?.length) {
    const denied = platforms.filter(p => !mcp.connectedPlatforms.includes(p))
    if (denied.length > 0) {
      throw new Error(
        `API key does not allow platform(s): ${denied.join(', ')}. Allowed: ${mcp.connectedPlatforms.join(', ')}`
      )
    }
  }

  const accounts = await socialMediaAccountService.getAccountsByBusinessIdWithOutActiveCheck(mcp.businessId)
  const connected = new Set(accounts.map(a => a.platform))
  const disconnected = platforms.filter(p => !connected.has(p))
  if (disconnected.length > 0) {
    throw new Error(
      `Platform(s) not connected: ${disconnected.join(', ')}. Connect them in the MagicSync dashboard first.`
    )
  }

  const relevant = accounts.filter(a => a.platform && platforms.includes(a.platform))
  if (relevant.length === 0) {
    throw new Error('No connected accounts for requested platforms')
  }

  const userId = mcp.userId || relevant[0]?.userId
  if (!userId) {
    throw new Error(
      'This API key is not bound to a user and no account owner could be resolved. '
      + 'Create a user-bound API key first.'
    )
  }

  return {
    accounts: relevant.map(a => ({ id: a.id, platform: a.platform, userId: a.userId })),
    userId,
  }
}

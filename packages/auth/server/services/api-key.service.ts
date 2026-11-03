import type { H3Event } from 'h3'
import { and, eq, inArray } from 'drizzle-orm'
import { auth } from '#layers/BaseAuth/lib/auth'
import { apikey, businessProfiles, member, organization } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { businessOrgService } from './business-org.service'
import { useAuthApi } from '../utils/useAuthApi'

export interface ApiKeyContext {
  valid: boolean
  keyId: string
  userId: string
  orgId: string
  businessId: string
  connectedPlatforms: string[]
  name: string | null
  /**
   * Effective scope. API keys default to full (Wave 1); OAuth tokens carry
   * the granted scope (mcp:read/mcp:full). Enforced by requireScope().
   */
  mcpScope?: 'read' | 'full'
  metadata?: Record<string, unknown>
  ownerUserId?: string
}

export interface ApiKeyVerificationResult {
  success: boolean
  context?: ApiKeyContext
  error?: {
    statusCode: number
    message: string
  }
}

export interface ApiKeyWithSecret {
  id: string
  name: string | null
  key: string
  prefix: string | null
  expiresAt: Date | null
  createdAt: Date
}

export interface ApiKeyListItem {
  id: string
  name: string | null
  prefix: string | null
  expiresAt: Date | null
  createdAt: Date
  enabled: boolean
}

import { parseJsonObject, toJsonString } from '#layers/BaseShared/utils/json'

function parseKeyMetadata(raw: unknown): Record<string, unknown> {
  return raw ? parseJsonObject(toJsonString(raw)) : {}
}

function parseConnectedPlatforms(metadata: Record<string, unknown>): string[] {
  const list = metadata.connectedPlatforms
  return Array.isArray(list) ? (list as string[]) : []
}

async function businessOwnerId(businessId: string): Promise<string | null> {
  const [row] = await useDrizzle()
    .select({ userId: businessProfiles.userId })
    .from(businessProfiles)
    .where(eq(businessProfiles.id, businessId))
    .limit(1)
  return row?.userId ?? null
}

async function hasBusinessAccess(userId: string, businessId: string): Promise<boolean> {
  if (!userId) return false
  const db = useDrizzle()
  const [owned] = await db
    .select({ id: businessProfiles.id })
    .from(businessProfiles)
    .where(and(eq(businessProfiles.id, businessId), eq(businessProfiles.userId, userId)))
    .limit(1)
  if (owned) return true
  const memberships = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
  if (memberships.length === 0) return false
  const orgs = await db
    .select({ metadata: organization.metadata })
    .from(organization)
    .where(inArray(organization.id, memberships.map(entry => entry.organizationId)))
  return orgs.some(org => parseKeyMetadata(org.metadata).businessId === businessId)
}

async function effectiveBusinessId(
  metadata: Record<string, unknown>,
  orgBusinessId: string | null,
  ownerUserId: string | null
): Promise<string | null> {
  const requested = typeof metadata.businessId === 'string' ? metadata.businessId : null
  if (!requested || !orgBusinessId || !ownerUserId) return orgBusinessId
  return (await hasBusinessAccess(ownerUserId, requested)) ? requested : orgBusinessId
}

export const apiKeyService = {
  /**
   * Verify an API key string (used for incoming external requests).
   * The key is read from the request body, not headers.
   */
  async verifyApiKey(apiKey: string): Promise<ApiKeyVerificationResult> {
    if (!apiKey) {
      return {
        success: false,
        error: { statusCode: 401, message: 'Missing API key. Include x-api-key header.' }
      }
    }

    try {
      const result = await auth.api.verifyApiKey({
        body: {
          key: apiKey,
          configId: "org-keys",
        }
      })

      if (!result.valid || !result.key) {
        return {
          success: false,
          error: { statusCode: 401, message: 'Invalid API key' }
        }
      }

      const keyData = result.key
      const orgId = keyData.referenceId
      const metadata = parseKeyMetadata(keyData.metadata)
      const orgBusinessId = await businessOrgService.getBusinessIdFromOrg(orgId)
      const ownerUserId = orgBusinessId ? await businessOwnerId(orgBusinessId) : null

      const userId = (keyData as { userId?: string }).userId ?? ""
      const businessId = await effectiveBusinessId(metadata, orgBusinessId, ownerUserId)

      if (!businessId) {
        return {
          success: false,
          error: { statusCode: 401, message: 'API key not associated with a business' }
        }
      }

      // Inactive businesses keep full CLI and MCP access. isActive tracks
      // Google Business linkage only, never abuse, and rate limiting is
      // enforced by the better-auth apiKey plugin.
      const connectedPlatforms = parseConnectedPlatforms(metadata)

      return {
        success: true,
        context: {
          valid: true,
          keyId: keyData.id,
          orgId,
          businessId,
          userId,
          connectedPlatforms,
          name: keyData.name,
          metadata,
          ownerUserId: ownerUserId ?? undefined,
        },
      }
    } catch {
      return {
        success: false,
        error: { statusCode: 401, message: 'API key verification failed' }
      }
    }
  },

  /**
   * Verify that an API key grants access to a specific business.
   */
  async verifyApiKeyForBusiness(apiKey: string, requiredBusinessId: string): Promise<ApiKeyVerificationResult> {
    const result = await this.verifyApiKey(apiKey)
    if (!result.success || !result.context) return result

    if (result.context.businessId !== requiredBusinessId) {
      return {
        success: false,
        error: { statusCode: 403, message: 'API key does not have access to this business' }
      }
    }
    return result
  },

  /**
   * Verify that an API key has access to the required platforms.
   */
  async verifyApiKeyForPlatforms(apiKey: string, requiredPlatforms: string[]): Promise<ApiKeyVerificationResult> {
    const result = await this.verifyApiKey(apiKey)
    if (!result.success || !result.context) return result

    const { connectedPlatforms } = result.context
    const missingPlatforms = requiredPlatforms.filter(p => !connectedPlatforms.includes(p))

    if (missingPlatforms.length > 0) {
      return {
        success: false,
        error: {
          statusCode: 400,
          message: `API key does not have access to platforms: ${missingPlatforms.join(', ')}. Connected platforms: ${connectedPlatforms.join(', ')}`
        }
      }
    }
    return result
  },

  async switchBusiness(context: ApiKeyContext, targetBusinessId: string): Promise<ApiKeyVerificationResult> {
    if (!context.metadata) {
      return {
        success: false,
        error: { statusCode: 403, message: 'Business switching is only available for API-key MCP connections. OAuth connections are scoped to their grant.' }
      }
    }
    const ownerUserId = context.ownerUserId ?? await businessOwnerId(context.businessId)
    if (!ownerUserId || !(await hasBusinessAccess(ownerUserId, targetBusinessId))) {
      return {
        success: false,
        error: { statusCode: 403, message: 'The key owner does not have access to that business.' }
      }
    }
    try {
      const metadata = { ...context.metadata, businessId: targetBusinessId }
      await useDrizzle()
        .update(apikey)
        .set({ metadata: toJsonString(metadata), updatedAt: new Date() })
        .where(eq(apikey.id, context.keyId))
      return { success: true, context: { ...context, businessId: targetBusinessId, metadata } }
    } catch {
      return { success: false, error: { statusCode: 500, message: 'Failed to switch the API key business' } }
    }
  },

  /**
   * Create a new API key for an organization.
   * Does NOT check membership or fetch/create the org — the caller handles that.
   */
  async createApiKey(event: H3Event, orgId: string, name: string, expiresIn?: number, userId?: string): Promise<ApiKeyWithSecret> {
    const authApi = useAuthApi(event)

    const apiKey = await authApi.createApiKey({
      body: {
        name,
        configId: "org-keys",
        organizationId: orgId,
        userId: userId,
        expiresIn: expiresIn ?? (90 * 24 * 60 * 60)
      }
    })

    return {
      id: apiKey.id,
      name: apiKey.name || name,
      key: apiKey.key,
      prefix: apiKey.prefix || 'MG-',
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt
    }
  },

  /**
   * List all API keys for an organization.
   * Does NOT check membership or fetch/create the org — the caller handles that.
   */
  async listApiKeys(event: H3Event, orgId: string, userId?: string): Promise<ApiKeyListItem[]> {
    const authApi = useAuthApi(event)
    const result = await authApi.listApiKeys({ query: { organizationId: orgId, configId: "org-keys", } })

    return result.apiKeys.map((key: ApiKeyListItem) => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      enabled: key.enabled
    }))
  },

  /**
   * Delete (revoke) an API key.
   * Does NOT check membership or fetch/create the org — the caller handles that.
   */
  async deleteApiKey(event: H3Event, keyId: string): Promise<void> {
    const authApi = useAuthApi(event)
    await authApi.deleteApiKey({ body: { keyId, configId: "org-keys" } })
  }
}

import type { H3Event } from 'h3'
import { auth } from '#layers/BaseAuth/lib/auth'
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
      const result = await auth.api.verifyApiKey({ body: { key: apiKey } })

      if (!result.valid || !result.key) {
        return {
          success: false,
          error: { statusCode: 401, message: 'Invalid API key' }
        }
      }

      const keyData = result.key
      const orgId = keyData.referenceId
      const businessId = await businessOrgService.getBusinessIdFromOrg(orgId)

      if (!businessId) {
        return {
          success: false,
          error: { statusCode: 401, message: 'API key not associated with a business' }
        }
      }

      const isActive = await businessOrgService.isBusinessActive(businessId)
      if (!isActive) {
        return {
          success: false,
          error: { statusCode: 401, message: 'Business is inactive' }
        }
      }

      // SAFE: wrap JSON.parse in try/catch to handle malformed metadata
      let metadata = {}
      if (keyData.metadata) {
        try {
          metadata = JSON.parse(keyData.metadata)
        } catch {
          // If metadata is malformed, use empty object
          metadata = {}
        }
      }
      const connectedPlatforms = metadata.connectedPlatforms || []

      // userId may be undefined for org-level keys
      const userId = (keyData as any).userId ?? undefined

      return {
        success: true,
        context: {
          valid: true,
          keyId: keyData.id,
          orgId,
          userId,
          businessId,
          connectedPlatforms,
          name: keyData.name,
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

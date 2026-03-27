import { auth } from '#layers/BaseAuth/lib/auth'
import { businessOrgService } from '#layers/BaseAuth/server/services/business-org.service'

export interface ApiKeyContext {
  valid: boolean
  keyId: string
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

export interface CreateApiKeyOptions {
  name: string
  businessId: string
  userId: string
  expiresIn?: number
}

export interface ApiKeyWithSecret {
  id: string
  name: string
  key: string
  prefix: string
  expiresAt: Date | null
  createdAt: Date
}

export interface ApiKeyListItem {
  id: string
  name: string
  prefix: string
  expiresAt: Date | null
  createdAt: Date
  enabled: boolean
}

export const apiKeyService = {
  async verifyApiKey(apiKey: string): Promise<ApiKeyVerificationResult> {
    if (!apiKey) {
      return {
        success: false,
        error: {
          statusCode: 401,
          message: 'Missing API key. Include x-api-key header.'
        }
      }
    }

    try {
      const result = await auth.api.verifyApiKey({
        body: {
          key: apiKey
        }
      })

      if (!result.valid || !result.key) {
        return {
          success: false,
          error: {
            statusCode: 401,
            message: 'Invalid API key'
          }
        }
      }

      const keyData = result.key
      const orgId = keyData.referenceId

      const businessId = await businessOrgService.getBusinessIdFromOrg(orgId)

      if (!businessId) {
        return {
          success: false,
          error: {
            statusCode: 401,
            message: 'API key not associated with a business'
          }
        }
      }

      const isActive = await businessOrgService.isBusinessActive(businessId)
      if (!isActive) {
        return {
          success: false,
          error: {
            statusCode: 401,
            message: 'Business is inactive'
          }
        }
      }

      const metadata = keyData.metadata ? JSON.parse(keyData.metadata as string) : {}
      const connectedPlatforms = metadata.connectedPlatforms || []

      return {
        success: true,
        context: {
          valid: true,
          keyId: keyData.id,
          orgId,
          businessId,
          connectedPlatforms,
          name: keyData.name
        }
      }
    } catch (error) {
      return {
        success: false,
        error: {
          statusCode: 401,
          message: 'API key verification failed'
        }
      }
    }
  },

  async verifyApiKeyForBusiness(apiKey: string, requiredBusinessId: string): Promise<ApiKeyVerificationResult> {
    const result = await this.verifyApiKey(apiKey)

    if (!result.success || !result.context) {
      return result
    }

    if (result.context.businessId !== requiredBusinessId) {
      return {
        success: false,
        error: {
          statusCode: 403,
          message: 'API key does not have access to this business'
        }
      }
    }

    return result
  },

  async verifyApiKeyForPlatforms(apiKey: string, requiredPlatforms: string[]): Promise<ApiKeyVerificationResult> {
    const result = await this.verifyApiKey(apiKey)

    if (!result.success || !result.context) {
      return result
    }

    const { connectedPlatforms } = result.context

    const missingPlatforms = requiredPlatforms.filter(
      platform => !connectedPlatforms.includes(platform)
    )

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

  async createApiKey(options: CreateApiKeyOptions): Promise<ApiKeyWithSecret> {
    const { name, businessId, userId, expiresIn } = options

    const isMember = await businessOrgService.isUserMemberOfBusinessOrg(userId, businessId)
    if (!isMember) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You are not a member of this business'
      })
    }

    const orgId = await businessOrgService.getOrCreateOrgForBusiness(businessId)
    console.log({orgId})

    const apiKey = await auth.api.createApiKey({
      body: {
        name,
        organizationId: orgId,
        expiresIn: expiresIn || (90 * 24 * 60 * 60)
      },
      headers: new Headers()
    })

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: apiKey.key,
      prefix: apiKey.prefix,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt
    }
  },

  async listApiKeys(businessId: string, userId: string): Promise<ApiKeyListItem[]> {
    const isMember = await businessOrgService.isUserMemberOfBusinessOrg(userId, businessId)
    if (!isMember) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You are not a member of this business'
      })
    }

    const orgId = await businessOrgService.getOrCreateOrgForBusiness(businessId)

    const result = await auth.api.listApiKeys({
      query: {
        organizationId: orgId
      },
      headers: new Headers()
    })

    return result.apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      enabled: key.enabled
    }))
  },

  async deleteApiKey(keyId: string, businessId: string, userId: string): Promise<void> {
    const isMember = await businessOrgService.isUserMemberOfBusinessOrg(userId, businessId)
    if (!isMember) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You are not a member of this business'
      })
    }

    await auth.api.deleteApiKey({
      body: {
        keyId
      },
      headers: new Headers()
    })
  }
}

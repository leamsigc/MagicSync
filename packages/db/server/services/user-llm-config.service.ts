import { eq, and } from 'drizzle-orm'
import { type ServiceResponse } from './types'
import type { UserLlmConfigServiceType } from './interfaces'
import { userLlmConfigs, entityDetails, type UserLlmConfig } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { encryptSecret, isEncryptedSecret, revealSecret } from '#layers/BaseDB/server/utils/publish-crypto'

export type SupportedProvider = 'google' | 'ollama' | 'openai' | 'anthropic' | 'openrouter' | 'deepseek'

export const BUSINESS_LLM_OVERRIDE_TYPE = 'business_llm_override'
// entitydetails-kv: one row per (user, business); point reads by
// (entity_type, entity_id). like() scans acceptable under ~10k rows — revisit if exceeded.

export const SYSTEM_DEFAULT_PROVIDER: SupportedProvider = 'google'
export const SYSTEM_DEFAULT_MODEL = 'gemini-3-flash-preview'

export interface BusinessLlmOverride {
  provider: SupportedProvider
  model: string
  apiKey: string | null
  apiBaseUrl: string | null
  temperature: number
  maxTokens: number
  hasKey: boolean
  updatedAt: string
}

function overrideEntityId(userId: string, businessId: string): string {
  return `${userId}::${businessId}`
}

function systemDefaultConfig(userId: string): UserLlmConfig {
  return {
    id: 'default',
    userId,
    provider: SYSTEM_DEFAULT_PROVIDER,
    model: SYSTEM_DEFAULT_MODEL,
    apiKey: null,
    apiBaseUrl: null,
    isDefault: true,
    temperature: 0.7,
    maxTokens: 2048,
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function numOr(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback
}

function isOverrideShape(raw: unknown): raw is Record<string, unknown> {
  return !!raw && typeof raw === 'object' && !Array.isArray(raw)
}

function parseOverrideDetails(raw: unknown): BusinessLlmOverride | null {
  if (!isOverrideShape(raw)) return null
  const d = raw
  if (typeof d.provider !== 'string' || typeof d.model !== 'string') return null
  const stored = strOrNull(d.apiKey)
  const apiKey = stored ? revealSecret(stored) : null
  return {
    provider: d.provider as SupportedProvider,
    model: d.model,
    apiKey,
    apiBaseUrl: strOrNull(d.apiBaseUrl),
    temperature: numOr(d.temperature, 0.7),
    maxTokens: numOr(d.maxTokens, 2048),
    hasKey: !!apiKey,
    updatedAt: strOrNull(d.updatedAt) ?? new Date(0).toISOString()
  }
}

function existingEncryptedKey(row: { details: unknown } | undefined): string | null {
  if (!row) return null
  const key = (row.details as Record<string, unknown>)?.apiKey
  return typeof key === 'string' ? key : null
}

// API keys are encrypted at rest with publish-crypto (AES-256-GCM) and only
// ever decrypted into memory. Legacy plaintext rows fail closed to null via
// revealSecret, so the caller falls back to platform defaults.
function toStoredApiKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  return isEncryptedSecret(trimmed) ? trimmed : encryptSecret(trimmed)
}

function withRevealedKey(row: UserLlmConfig): UserLlmConfig {
  if (!row.apiKey) return row
  return { ...row, apiKey: revealSecret(row.apiKey) }
}

function toEffectiveConfig(userId: string, businessId: string, override: BusinessLlmOverride): UserLlmConfig {
  const now = new Date()
  return {
    id: overrideEntityId(userId, businessId),
    userId,
    provider: override.provider,
    model: override.model,
    apiKey: override.apiKey,
    apiBaseUrl: override.apiBaseUrl,
    isDefault: false,
    temperature: override.temperature,
    maxTokens: override.maxTokens,
    createdAt: now,
    updatedAt: now
  }
}

export interface CreateLlmConfigData {
  provider: SupportedProvider
  model: string
  apiKey?: string | null
  apiBaseUrl?: string | null
  isDefault?: boolean
  temperature?: number
  maxTokens?: number
}

export interface UpdateLlmConfigData {
  provider?: SupportedProvider
  model?: string
  apiKey?: string | null
  apiBaseUrl?: string | null
  isDefault?: boolean
  temperature?: number
  maxTokens?: number
}

export class UserLlmConfigService implements UserLlmConfigServiceType {
  private db = useDrizzle()

  async getConfigs(userId: string): Promise<ServiceResponse<UserLlmConfig[]>> {
    try {
      const configs = await this.db
        .select()
        .from(userLlmConfigs)
        .where(eq(userLlmConfigs.userId, userId))

      return { success: true, data: configs.map(withRevealedKey) }
    } catch (error) {
      return { success: false, error: 'Failed to fetch LLM configs' }
    }
  }

  async getDefaultConfig(userId: string): Promise<ServiceResponse<UserLlmConfig>> {
    try {
      const [config] = await this.db
        .select()
        .from(userLlmConfigs)
        .where(
          and(
            eq(userLlmConfigs.userId, userId),
            eq(userLlmConfigs.isDefault, true)
          )
        )
        .limit(1)

      if (!config) {
        return {
          success: true,
          data: {
            id: 'default',
            userId,
            provider: 'google',
            model: 'gemini-3-flash-preview',
            apiKey: null,
            apiBaseUrl: null,
            isDefault: true,
            temperature: 0.7,
            maxTokens: 2048,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }
      }

      return { success: true, data: withRevealedKey(config) }
    } catch (error) {
      return { success: false, error: 'Failed to fetch default LLM config' }
    }
  }

  async createConfig(
    userId: string,
    data: CreateLlmConfigData
  ): Promise<ServiceResponse<UserLlmConfig>> {
    try {
      const id = crypto.randomUUID()
      const now = new Date()

      // If this is set as default, unset other defaults
      if (data.isDefault) {
        await this.db
          .update(userLlmConfigs)
          .set({ isDefault: false, updatedAt: now })
          .where(eq(userLlmConfigs.userId, userId))
      }

      const [config] = await this.db
        .insert(userLlmConfigs)
        .values({
          id,
          userId,
          provider: data.provider,
          model: data.model,
          apiKey: toStoredApiKey(data.apiKey),
          apiBaseUrl: data.apiBaseUrl,
          isDefault: data.isDefault ?? false,
          temperature: data.temperature ?? 0.7,
          maxTokens: data.maxTokens ?? 2048,
          createdAt: now,
          updatedAt: now
        })
        .returning()

      return { success: true, data: withRevealedKey(config) }
    } catch (error) {
      return { success: false, error: 'Failed to create LLM config' }
    }
  }

  async updateConfig(
    userId: string,
    configId: string,
    data: UpdateLlmConfigData
  ): Promise<ServiceResponse<UserLlmConfig>> {
    try {
      const now = new Date()

      // If setting as default, unset other defaults
      if (data.isDefault) {
        await this.db
          .update(userLlmConfigs)
          .set({ isDefault: false, updatedAt: now })
          .where(eq(userLlmConfigs.userId, userId))
      }

      const { apiKey: rawKey, ...rest } = data
      const patch = {
        ...rest,
        ...(rawKey !== undefined ? { apiKey: toStoredApiKey(rawKey) } : {}),
        updatedAt: now,
      }
      const [updated] = await this.db
        .update(userLlmConfigs)
        .set(patch)
        .where(
          and(
            eq(userLlmConfigs.id, configId),
            eq(userLlmConfigs.userId, userId)
          )
        )
        .returning()

      if (!updated) {
        return { success: false, error: 'Config not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: withRevealedKey(updated) }
    } catch (error) {
      return { success: false, error: 'Failed to update LLM config' }
    }
  }

  async deleteConfig(
    userId: string,
    configId: string
  ): Promise<ServiceResponse<UserLlmConfig>> {
    try {
      const [deleted] = await this.db
        .delete(userLlmConfigs)
        .where(
          and(
            eq(userLlmConfigs.id, configId),
            eq(userLlmConfigs.userId, userId)
          )
        )
        .returning()

      if (!deleted) {
        return { success: false, error: 'Config not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: deleted }
    } catch (error) {
      return { success: false, error: 'Failed to delete LLM config' }
    }
  }

  async setDefault(
    userId: string,
    configId: string
  ): Promise<ServiceResponse<UserLlmConfig>> {
    return this.updateConfig(userId, configId, { isDefault: true })
  }

  async saveOverride(
    userId: string,
    businessId: string,
    data: CreateLlmConfigData
  ): Promise<ServiceResponse<BusinessLlmOverride>> {
    try {
      const entityId = overrideEntityId(userId, businessId)
      const [existing] = await this.db
        .select()
        .from(entityDetails)
        .where(and(eq(entityDetails.entityType, BUSINESS_LLM_OVERRIDE_TYPE), eq(entityDetails.entityId, entityId)))
        .limit(1)
      const rawKey = typeof data.apiKey === 'string' ? data.apiKey.trim() : ''
      const storedKey = rawKey ? encryptSecret(rawKey) : existingEncryptedKey(existing)
      const details = JSON.parse(JSON.stringify({
        provider: data.provider,
        model: data.model,
        apiKey: storedKey,
        apiBaseUrl: data.apiBaseUrl ?? null,
        temperature: data.temperature ?? 0.7,
        maxTokens: data.maxTokens ?? 2048,
        updatedAt: new Date().toISOString()
      }))
      if (existing) {
        await this.db.update(entityDetails).set({ details, updatedAt: new Date() }).where(eq(entityDetails.id, existing.id))
      } else {
        await this.db.insert(entityDetails).values({ id: crypto.randomUUID(), entityId, entityType: BUSINESS_LLM_OVERRIDE_TYPE, details })
      }
      const saved = await this.getOverride(userId, businessId)
      if (!saved.success || !saved.data) {
        return { success: false, error: 'Failed to save business LLM override' }
      }
      return { success: true, data: saved.data }
    } catch {
      return { success: false, error: 'Failed to save business LLM override' }
    }
  }

  async getOverride(
    userId: string,
    businessId: string
  ): Promise<ServiceResponse<BusinessLlmOverride | null>> {
    try {
      const entityId = overrideEntityId(userId, businessId)
      const [row] = await this.db
        .select()
        .from(entityDetails)
        .where(and(eq(entityDetails.entityType, BUSINESS_LLM_OVERRIDE_TYPE), eq(entityDetails.entityId, entityId)))
        .limit(1)
      if (!row) return { success: true, data: null }
      if (!row.entityId.startsWith(`${userId}::`)) return { success: true, data: null }
      return { success: true, data: parseOverrideDetails(row.details) }
    } catch {
      return { success: false, error: 'Failed to fetch business LLM override' }
    }
  }

  async clearOverride(
    userId: string,
    businessId: string
  ): Promise<ServiceResponse<boolean>> {
    try {
      const entityId = overrideEntityId(userId, businessId)
      await this.db
        .delete(entityDetails)
        .where(and(eq(entityDetails.entityType, BUSINESS_LLM_OVERRIDE_TYPE), eq(entityDetails.entityId, entityId)))
      return { success: true, data: true }
    } catch {
      return { success: false, error: 'Failed to clear business LLM override' }
    }
  }

  private async loadUserDefault(userId: string): Promise<ServiceResponse<UserLlmConfig>> {
    const fallback = await this.getDefaultConfig(userId)
    if (fallback.success && fallback.data) return { success: true, data: fallback.data }
    return { success: true, data: systemDefaultConfig(userId) }
  }

  async getEffectiveConfig(
    userId: string,
    businessId?: string | null
  ): Promise<ServiceResponse<UserLlmConfig>> {
    try {
      if (businessId) {
        const override = await this.getOverride(userId, businessId)
        if (override.success && override.data) {
          return { success: true, data: toEffectiveConfig(userId, businessId, override.data) }
        }
      }
      return this.loadUserDefault(userId)
    } catch {
      return { success: true, data: systemDefaultConfig(userId) }
    }
  }
}

export const userLlmConfigService = new UserLlmConfigService()

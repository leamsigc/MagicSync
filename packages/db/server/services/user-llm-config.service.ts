import { eq, and } from 'drizzle-orm'
import { type ServiceResponse } from './types'
import type { UserLlmConfigServiceType } from './interfaces'
import { userLlmConfigs, type UserLlmConfig } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'

export interface CreateLlmConfigData {
  provider: 'ollama' | 'openai' | 'anthropic' | 'openrouter'
  model: string
  apiKey?: string | null
  apiBaseUrl?: string | null
  isDefault?: boolean
  temperature?: number
  maxTokens?: number
}

export interface UpdateLlmConfigData {
  provider?: 'ollama' | 'openai' | 'anthropic' | 'openrouter'
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

      return { success: true, data: configs }
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
            provider: 'ollama',
            model: 'qwen3.5',
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

      return { success: true, data: config }
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
          apiKey: data.apiKey,
          apiBaseUrl: data.apiBaseUrl,
          isDefault: data.isDefault ?? false,
          temperature: data.temperature ?? 0.7,
          maxTokens: data.maxTokens ?? 2048,
          createdAt: now,
          updatedAt: now
        })
        .returning()

      return { success: true, data: config }
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

      const [updated] = await this.db
        .update(userLlmConfigs)
        .set({ ...data, updatedAt: now })
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

      return { success: true, data: updated }
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
}

export const userLlmConfigService = new UserLlmConfigService()

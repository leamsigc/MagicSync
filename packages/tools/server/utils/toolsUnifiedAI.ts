/**
 * Unified AI connection for the tools layer.
 *
 * Mirrors the scheduler's system connection strategy:
 * - System default: Google Gemini via env key
 * - Logged-in users can override with their own provider via user_llm_configs
 *
 * Auto-imported from server/utils.
 */
import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import type { H3Event } from 'h3'
import type { RequestLogger } from 'evlog'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'
import { businessContextResolver, contextErrorStatus } from '#layers/BaseDB/server/services/business-context-resolver.service'
import { wrapAiModel } from '#layers/BaseShared/server/utils/evlog'

const SYSTEM_DEFAULT_PROVIDER = 'google'
const SYSTEM_DEFAULT_MODEL = 'gemini-2.5-flash'
const DEFAULT_TEMPERATURE = 0.7

type ProviderName = 'google' | 'ollama' | 'openai' | 'anthropic' | 'openrouter' | 'deepseek'

const PROVIDER_BASE_URLS: Record<string, string> = {
  ollama: 'http://localhost:11434/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  deepseek: 'https://api.deepseek.com/v1',
}

function resolveApiKey(userKey?: string | null, ...envVars: string[]): string | undefined {
  if (userKey) return userKey
  for (const envVar of envVars) {
    const val = process.env[envVar]
    if (val) return val
  }
  return undefined
}

function createModel(provider: ProviderName, modelName: string, userApiKey?: string | null, apiBaseUrl?: string | null) {
  switch (provider) {
    case 'google': {
      const apiKey = resolveApiKey(userApiKey, 'NUXT_GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY')
      if (!apiKey) throw new Error('Missing Google Generative AI API key. Set NUXT_GOOGLE_GENERATIVE_AI_API_KEY in your .env file.')
      return google(modelName, { apiKey })
    }
    case 'anthropic': {
      const apiKey = resolveApiKey(userApiKey, 'NUXT_ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY')
      return anthropic(modelName, { apiKey: apiKey || undefined })
    }
    case 'openai': {
      const apiKey = resolveApiKey(userApiKey, 'NUXT_OPENAI_API_KEY', 'OPENAI_API_KEY')
      return openai.chat(modelName, { apiKey: apiKey || undefined })
    }
    case 'ollama': {
      const baseURL = apiBaseUrl || PROVIDER_BASE_URLS.ollama
      return openai.chat(modelName, { baseURL })
    }
    case 'openrouter': {
      const baseURL = apiBaseUrl || PROVIDER_BASE_URLS.openrouter
      const apiKey = resolveApiKey(userApiKey, 'NUXT_OPENROUTER_API_KEY', 'OPENROUTER_API_KEY')
      return openai.chat(modelName, { baseURL, apiKey: apiKey || undefined })
    }
    case 'deepseek': {
      const baseURL = apiBaseUrl || PROVIDER_BASE_URLS.deepseek
      const apiKey = resolveApiKey(userApiKey, 'NUXT_DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY')
      return openai.chat(modelName, { baseURL, apiKey: apiKey || undefined })
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`)
  }
}

interface ResolvedConfig {
  provider: ProviderName
  model: string
  apiKey?: string | null
  apiBaseUrl?: string | null
}

async function resolveConfig(userId?: string): Promise<ResolvedConfig> {
  if (userId) {
    const result = await userLlmConfigService.getDefaultConfig(userId)
    if (result.success && result.data && result.data.id !== 'default') {
      return {
        provider: result.data.provider as ProviderName,
        model: result.data.model,
        apiKey: result.data.apiKey,
        apiBaseUrl: result.data.apiBaseUrl,
      }
    }
  }

  return {
    provider: SYSTEM_DEFAULT_PROVIDER,
    model: SYSTEM_DEFAULT_MODEL,
  }
}

export interface ToolsBrandGrounding {
  businessId?: string | null
  useBusinessContext?: boolean
  event?: H3Event
}

function wantsBrandGrounding(userId?: string, grounding?: ToolsBrandGrounding): boolean {
  return !!userId
    && !!grounding
    && grounding.useBusinessContext === true
    && typeof grounding.businessId === 'string'
    && grounding.businessId.length > 0
}

async function brandSystemPrefix(
  userId: string | undefined,
  grounding: ToolsBrandGrounding | undefined,
): Promise<{ prefix: string, editionId: string | null }> {
  if (!wantsBrandGrounding(userId, grounding)) return { prefix: '', editionId: null }
  const result = await businessContextResolver.resolve(userId as string, {
    businessId: grounding?.businessId,
    useBusinessContext: true,
  }, grounding?.event)
  if (!result.success) {
    throw createError({ statusCode: contextErrorStatus(result.code), message: result.error })
  }
  if (!result.data.enabled || !result.data.prompt) return { prefix: '', editionId: null }
  return { prefix: `${result.data.prompt}\n\n---\n\n`, editionId: result.data.editionId }
}

export const toolsUnifiedAI = {
  async generateText(options: {
    systemPrompt?: string
    prompt: string
    temperature?: number
    userId?: string
    /** Request logger — when provided, token metrics are captured onto the wide event via evlog. */
    log?: RequestLogger
  } & ToolsBrandGrounding): Promise<{ text: string, contextEditionId?: string | null }> {
    const { systemPrompt, prompt, temperature = DEFAULT_TEMPERATURE, userId, log } = options

    const config = await resolveConfig(userId)
    const aiModel = createModel(config.provider, config.model, config.apiKey, config.apiBaseUrl)
    const brand = await brandSystemPrefix(userId, options)
    const system = brand.prefix ? `${brand.prefix}${systemPrompt ?? ''}` : systemPrompt

    const { text } = await generateText({
      model: wrapAiModel(log, aiModel),
      system,
      prompt,
      temperature,
    })

    return { text, contextEditionId: brand.editionId }
  },
}

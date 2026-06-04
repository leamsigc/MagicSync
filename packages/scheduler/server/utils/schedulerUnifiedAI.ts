/**
 * Unified AI Connection Utility for MagicSync Scheduler
 *
 * Provides a centralized interface for AI generation calls across all endpoints.
 * Supports multiple AI providers with user-configurable defaults.
 *
 * System default: Google Gemini (gemini-3-flash-preview)
 * User override: Each user can configure their own provider/model via user_llm_configs
 *
 * Auto-imported from utils folder in Nuxt server.
 * Usage:
 * ```ts
 * // For text generation
 * const result = await schedulerUnifiedAI.generateText({
 *   prompt: 'Split this content...',
 * });
 *
 * // For object generation with user config override
 * const result = await schedulerUnifiedAI.generateObject({
 *   prompt: 'Extract business info...',
 *   schema: MySchema,
 *   userId: currentUser.id, // optional — uses user's configured provider
 * });
 * ```
 */

import { generateText, generateObject, type LanguageModelV1 } from 'ai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service';

// System default configuration
const SYSTEM_DEFAULT_PROVIDER = 'google';
const SYSTEM_DEFAULT_MODEL = 'gemini-3-flash-preview';
const DEFAULT_TEMPERATURE = 0.7;

type ProviderName = 'google' | 'ollama' | 'openai' | 'anthropic' | 'openrouter' | 'deepseek';

const PROVIDER_BASE_URLS: Record<string, string> = {
  ollama: 'http://localhost:11434/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  deepseek: 'https://api.deepseek.com/v1',
};

function resolveApiKey(userKey?: string | null, ...envVars: string[]): string | undefined {
  if (userKey) return userKey;
  for (const envVar of envVars) {
    const val = process.env[envVar];
    if (val) return val;
  }
  return undefined;
}

function createModel(provider: ProviderName, modelName: string, userApiKey?: string | null, apiBaseUrl?: string | null): LanguageModelV1 {
  switch (provider) {
    case 'google': {
      const apiKey = resolveApiKey(userApiKey, 'NUXT_GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY');
      if (!apiKey) throw new Error('Missing Google Generative AI API key. Set NUXT_GOOGLE_GENERATIVE_AI_API_KEY in your .env file.');
      return google(modelName, { apiKey });
    }

    case 'anthropic': {
      const apiKey = resolveApiKey(userApiKey, 'NUXT_ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY');
      return anthropic(modelName, { apiKey: apiKey || undefined });
    }

    case 'openai': {
      const apiKey = resolveApiKey(userApiKey, 'NUXT_OPENAI_API_KEY', 'OPENAI_API_KEY');
      return openai.chat(modelName, { apiKey: apiKey || undefined });
    }

    case 'ollama': {
      const baseURL = apiBaseUrl || PROVIDER_BASE_URLS.ollama;
      return openai.chat(modelName, { baseURL });
    }

    case 'openrouter': {
      const baseURL = apiBaseUrl || PROVIDER_BASE_URLS.openrouter;
      const apiKey = resolveApiKey(userApiKey, 'NUXT_OPENROUTER_API_KEY', 'OPENROUTER_API_KEY');
      return openai.chat(modelName, { baseURL, apiKey: apiKey || undefined });
    }

    case 'deepseek': {
      const baseURL = apiBaseUrl || PROVIDER_BASE_URLS.deepseek;
      const apiKey = resolveApiKey(userApiKey, 'NUXT_DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY');
      return openai.chat(modelName, { baseURL, apiKey: apiKey || undefined });
    }

    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

interface ResolvedConfig {
  provider: ProviderName;
  model: string;
  apiKey?: string | null;
  apiBaseUrl?: string | null;
}

async function resolveConfig(userId?: string): Promise<ResolvedConfig> {
  if (userId) {
    const result = await userLlmConfigService.getDefaultConfig(userId);
    if (result.success && result.data && result.data.id !== 'default') {
      return {
        provider: result.data.provider as ProviderName,
        model: result.data.model,
        apiKey: result.data.apiKey,
        apiBaseUrl: result.data.apiBaseUrl,
      };
    }
  }

  return {
    provider: SYSTEM_DEFAULT_PROVIDER,
    model: SYSTEM_DEFAULT_MODEL,
  };
}

/**
 * Options for generateText calls
 */
export interface SchedulerGenerateTextOptions {
  /** System prompt - can be a custom string */
  systemPrompt?: string;
  /** The user prompt */
  prompt: string;
  /** Generation temperature (default: 0.7) */
  temperature?: number;
  /** Model to use (overrides user config and system default) */
  model?: string;
  /** Provider to use (overrides user config) */
  provider?: string;
  /** User ID to look up their configured AI provider */
  userId?: string;
}

/**
 * Options for generateObject calls
 */
export interface SchedulerGenerateObjectOptions<T extends z.ZodSchema> {
  /** System prompt - can be a custom string */
  systemPrompt?: string;
  /** The user prompt */
  prompt: string;
  /** Zod schema for structured output */
  schema: T;
  /** Generation temperature (default: 0.7) */
  temperature?: number;
  /** Model to use (overrides user config and system default) */
  model?: string;
  /** Provider to use (overrides user config) */
  provider?: string;
  /** User ID to look up their configured AI provider */
  userId?: string;
}

/**
 * Result type for generateText
 */
export interface SchedulerGenerateTextResult {
  text: string;
}

/**
 * Unified AI connection object with scheduler prefix
 */
export const schedulerUnifiedAI = {
  /**
   * Generate text content using the AI
   */
  async generateText(options: SchedulerGenerateTextOptions): Promise<SchedulerGenerateTextResult> {
    const {
      systemPrompt,
      prompt,
      temperature = DEFAULT_TEMPERATURE,
      model: modelOverride,
      provider: providerOverride,
      userId,
    } = options;

    const config = await resolveConfig(userId);
    const provider = (providerOverride || config.provider) as ProviderName;
    const modelName = modelOverride || config.model;

    const aiModel = createModel(provider, modelName, config.apiKey, config.apiBaseUrl);

    const { text } = await generateText({
      model: aiModel,
      system: systemPrompt,
      prompt,
      temperature,
    });

    return { text };
  },

  /**
   * Generate structured object using the AI
   */
  async generateObject<T extends z.ZodSchema>(
    options: SchedulerGenerateObjectOptions<T>
  ): Promise<{ object: z.infer<T> }> {
    const {
      systemPrompt,
      prompt,
      schema,
      temperature = DEFAULT_TEMPERATURE,
      model: modelOverride,
      provider: providerOverride,
      userId,
    } = options;

    const config = await resolveConfig(userId);
    const provider = (providerOverride || config.provider) as ProviderName;
    const modelName = modelOverride || config.model;

    const aiModel = createModel(provider, modelName, config.apiKey, config.apiBaseUrl);

    const { object } = await generateObject({
      model: aiModel,
      system: systemPrompt,
      schema,
      prompt,
      temperature,
    });

    return { object };
  },
};

/**
 * Backward compatibility alias
 * @deprecated Use schedulerUnifiedAI instead
 */
export const unifiedAI = schedulerUnifiedAI;

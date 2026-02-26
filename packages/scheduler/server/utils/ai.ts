import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

export interface AIConfig {
  provider?: 'google' | 'openai';
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIGenerateOptions {
  prompt: string;
  system?: string;
  config?: AIConfig;
  temperature?: number;
  maxTokens?: number;
}

type ModelProvider = ReturnType<typeof google>;

function getDefaultConfig(): AIConfig {
  return {
    provider: 'google',
    model: 'gemini-3-flash-preview',
    apiKey: process.env.NUXT_GOOGLE_GENERATIVE_AI_API_KEY,
    temperature: 0.7,
    maxTokens: 2000
  };
}

function initializeModel(config: AIConfig): ModelProvider {
  if (config.provider === 'google') {
    if (!config.apiKey) {
      const envApiKey = process.env.NUXT_GOOGLE_GENERATIVE_AI_API_KEY;
      if (!envApiKey) {
        throw new Error('Missing Google Generative AI API key. Please set NUXT_GOOGLE_GENERATIVE_AI_API_KEY in your environment variables.');
      }
      return google(config.model || 'gemini-3-flash-preview');
    }
    return google(config.model || 'gemini-3-flash-preview');
  }

  throw new Error(`Unsupported AI provider: ${config.provider}`);
}

export async function generateAIText(options: AIGenerateOptions): Promise<string> {
  const defaultConfig = getDefaultConfig();
  const mergedConfig: AIConfig = {
    ...defaultConfig,
    ...options.config
  };

  const model = initializeModel(mergedConfig);

  try {
    const { text } = await generateText({
      model,
      system: options.system || '',
      prompt: options.prompt,
      temperature: options.temperature ?? mergedConfig.temperature,
      maxTokens: options.maxTokens ?? mergedConfig.maxTokens
    });

    return text;
  } catch (error: any) {
    console.error('AI Generation Error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to generate AI content'
    });
  }
}

export async function generateAIJSON<T = any>(options: AIGenerateOptions): Promise<T> {
  const text = await generateAIText(options);

  try {
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanText);
  } catch (parseError) {
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {
        throw new Error('Failed to parse AI response as JSON');
      }
    }
    throw new Error('AI response is not valid JSON');
  }
}

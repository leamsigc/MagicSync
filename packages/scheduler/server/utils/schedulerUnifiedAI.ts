/**
 * Unified AI Connection Utility for MagicSync Scheduler
 *
 * Provides a centralized interface for AI generation calls across all endpoints.
 * Supports both generateText and generateObject with a consistent API.
 *
 * Auto-imported from utils folder in Nuxt server.
 * Usage:
 * ```ts
 * // For text generation
 * const result = await schedulerUnifiedAI.generateText({
 *   systemPrompt: 'social-content-creator', // or custom string
 *   prompt: 'Split this content...',
 * });
 *
 * // For object generation
 * const result = await schedulerUnifiedAI.generateObject({
 *   systemPrompt: 'business-researcher',
 *   prompt: 'Extract business info...',
 *   schema: MySchema,
 * });
 * ```
 */

import { generateText, generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

// Default model configuration
const DEFAULT_MODEL = 'gemini-3-flash-preview';
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Get the API key from environment
 * @throws Error if API key is not configured
 */
function getApiKey(): string {
  const apiKey = process.env.NUXT_GOOGLE_GENERATIVE_AI_API_KEY || '';
  if (!apiKey) {
    throw new Error('Missing Google Generative AI API key. Please set NUXT_GOOGLE_GENERATIVE_AI_API_KEY in your environment variables.');
  }
  return apiKey;
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
  /** Model to use (default: gemini-3-flash-preview) */
  model?: string;
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
  /** Model to use (default: gemini-3-flash-preview) */
  model?: string;
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
   * @param options - Generation options
   * @returns Generated text result
   */
  async generateText(options: SchedulerGenerateTextOptions): Promise<SchedulerGenerateTextResult> {
    getApiKey(); // Validate API key

    const {
      systemPrompt,
      prompt,
      temperature = DEFAULT_TEMPERATURE,
      model = DEFAULT_MODEL,
    } = options;

    const { text } = await generateText({
      model: google(model),
      system: systemPrompt,
      prompt,
      temperature,
    });

    return { text };
  },

  /**
   * Generate structured object using the AI
   * @param options - Generation options including Zod schema
   * @returns Generated object result
   */
  async generateObject<T extends z.ZodSchema>(
    options: SchedulerGenerateObjectOptions<T>
  ): Promise<{ object: z.infer<T> }> {
    getApiKey(); // Validate API key

    const {
      systemPrompt,
      prompt,
      schema,
      temperature = DEFAULT_TEMPERATURE,
      model = DEFAULT_MODEL,
    } = options;

    const { object } = await generateObject({
      model: google(model),
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

import { z } from 'zod'
import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

const SUPPORTED = ['google', 'ollama', 'openai', 'anthropic', 'openrouter', 'deepseek'] as const

const OverrideSchema = z.object({
  businessId: z.string().min(1).max(128),
  provider: z.enum(SUPPORTED),
  model: z.string().min(1).max(128),
  apiKey: z.string().max(1024).nullish(),
  apiBaseUrl: z.string().max(512).nullish(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(128).max(128000).optional()
})

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)
  const body = await readValidatedBody(event, OverrideSchema.parse)

  const result = await aiToolsFacade.saveLlmOverride(user.id, body.businessId, {
    provider: body.provider,
    model: body.model,
    apiKey: body.apiKey ?? null,
    apiBaseUrl: body.apiBaseUrl ?? null,
    temperature: body.temperature,
    maxTokens: body.maxTokens
  })

  if (result.error || !result.data) {
    throw createError({ statusCode: 500, statusMessage: result.error || 'Failed to save override' })
  }
  const { apiKey: _dropped, ...rest } = result.data
  return { ...rest, apiKey: null }
})

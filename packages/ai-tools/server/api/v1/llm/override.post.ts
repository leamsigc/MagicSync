import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'

// `system` = "use the operator's configured AI"; the service resolves it to
// SYSTEM_DEFAULT_PROVIDER/MODEL and never hands the sentinel to pi. Its
// `model` is irrelevant, so it may be empty — the account UI sends that when a
// user resets a business back to the system model.
const SUPPORTED = ['system', 'google', 'ollama', 'llama', 'openai', 'anthropic', 'openrouter', 'deepseek'] as const

const OverrideSchema = z.object({
  businessId: z.string().min(1).max(128),
  provider: z.enum(SUPPORTED),
  model: z.string().max(128).default(''),
  apiKey: z.string().max(1024).nullish(),
  apiBaseUrl: z.string().max(512).nullish(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(128).max(128000).optional(),
}).refine(input => input.provider === 'system' || input.model.length > 0, {
  message: 'A model is required unless the provider is "system"',
  path: ['model'],
})

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = OverrideSchema.parse(await readBody(event))

  const result = await userLlmConfigService.saveOverride(user.id, body.businessId, {
    provider: body.provider,
    model: body.model,
    apiKey: body.apiKey ?? null,
    apiBaseUrl: body.apiBaseUrl ?? null,
    temperature: body.temperature,
    maxTokens: body.maxTokens,
  })
  if (!result.success || !result.data) {
    throw createError({ statusCode: 500, statusMessage: result.error ?? 'Failed to save override' })
  }

  const { apiKey, ...rest } = result.data
  return { ...rest, apiKey: null, hasKey: Boolean(apiKey) }
})

import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'
import { createAgentModelRuntime, testModelConnection } from '#layers/BaseAgent/server/utils/pi-runtime'

const SUPPORTED = ['google', 'ollama', 'llama', 'openai', 'anthropic', 'openrouter', 'deepseek'] as const

const TestSchema = z.object({
  provider: z.enum(SUPPORTED).optional(),
  model: z.string().min(1).max(128).optional(),
  apiKey: z.string().max(512).nullish(),
  apiBaseUrl: z.string().max(512).nullish(),
  businessId: z.string().min(1).max(128).nullish(),
})

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = TestSchema.parse(await readBody(event))

  const effective = await userLlmConfigService.getEffectiveConfig(user.id, body.businessId ?? null)
  const provider = body.provider ?? effective.data?.provider ?? 'openai'
  const model = body.model ?? effective.data?.model
  if (!model) throw createError({ statusCode: 400, statusMessage: 'A model is required' })

  const runtime = await createAgentModelRuntime()
  const result = await testModelConnection(runtime, {
    provider,
    model,
    apiKey: body.apiKey ?? effective.data?.apiKey ?? null,
    apiBaseUrl: body.apiBaseUrl ?? effective.data?.apiBaseUrl ?? null,
  })
  if (!result.success) {
    throw createError({ statusCode: result.code === 'MODEL_NOT_AVAILABLE' ? 400 : 502, statusMessage: result.error })
  }
  return { ok: true, model_used: `${provider}/${model}`, latency_ms: result.data.latencyMs }
})

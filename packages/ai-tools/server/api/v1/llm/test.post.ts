import { z } from 'zod'
import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

const SUPPORTED = ['google', 'ollama', 'openai', 'anthropic', 'openrouter', 'deepseek'] as const

const TestSchema = z.object({
  provider: z.enum(SUPPORTED).optional(),
  model: z.string().min(1).max(128).optional(),
  apiKey: z.string().max(512).nullish(),
  apiBaseUrl: z.string().max(512).nullish(),
  businessId: z.string().min(1).max(128).nullish()
})

function forwardBody(body: { provider?: string, model?: string, apiKey?: string | null, apiBaseUrl?: string | null }, fallback: { provider?: string, model?: string } | null) {
  return {
    provider: body.provider ?? fallback?.provider ?? 'google',
    model: body.model ?? fallback?.model ?? 'gemini-3-flash-preview',
    api_key: body.apiKey || null,
    api_base: body.apiBaseUrl || null
  }
}

function testError(response: Response, payload: { detail?: unknown }) {
  const statusCode = response.status === 400 ? 400 : 502
  const detail = typeof payload?.detail === 'string' ? payload.detail.slice(0, 300) : 'LLM test failed'
  return createError({ statusCode, statusMessage: detail })
}

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)
  const body = await readValidatedBody(event, TestSchema.parse)

  const jwtResult = await aiToolsFacade.getLlmJwtContext(user.id, user.email || '', body.businessId ?? null)
  if (!jwtResult.data) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to build LLM context' })
  }

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  let response: Response
  try {
    response = await fetch(`${backendUrl}/api/v1/llm/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwtResult.data.token}`
      },
      body: JSON.stringify(forwardBody(body, jwtResult.data.config))
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'AI backend unreachable' })
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw testError(response, payload)
  return { ok: true, model_used: payload.model_used, latency_ms: payload.latency_ms }
})

import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

const FALLBACK_MODELS: Record<string, string | null> = {
  google: 'gemini-3-flash-preview',
  ollama: 'qwen3.5',
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20241022',
  openrouter: 'openai/gpt-4o',
  deepseek: 'deepseek-chat'
}

function fallbackProviders(activeProvider: string, activeModel: string, hasKey: boolean) {
  const providers = Object.entries(FALLBACK_MODELS).map(([provider, defaultModel]) => ({
    provider,
    default_model: defaultModel,
    server_key_configured: false,
    user_key_configured: provider === activeProvider ? hasKey : false
  }))
  return {
    providers,
    default_provider: 'google',
    default_model: 'gemini-3-flash-preview',
    active: { provider: activeProvider, model: activeModel }
  }
}

function fallbackFor(effective: { provider?: string, model?: string, apiKey?: string | null } | null) {
  const provider = effective?.provider || 'google'
  const model = effective?.model || 'gemini-3-flash-preview'
  return fallbackProviders(provider, model, !!effective?.apiKey)
}

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : null

  const jwtResult = await aiToolsFacade.getLlmJwtContext(user.id, user.email || '', businessId)
  const token = jwtResult.data?.token ?? ''
  const effective = jwtResult.data?.config ?? null

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  try {
    const response = await fetch(`${backendUrl}/api/v1/llm/providers`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!response.ok) return fallbackFor(effective)
    return await response.json()
  } catch {
    return fallbackFor(effective)
  }
})

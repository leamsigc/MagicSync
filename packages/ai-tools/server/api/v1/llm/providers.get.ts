import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'
import { createAgentModelRuntime, describeRuntimeProviders } from '#layers/BaseAgent/server/utils/pi-runtime'

const SERVER_KEY_ENV: Record<string, string | undefined> = {
  google: process.env.NUXT_GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  openai: process.env.NUXT_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY,
  deepseek: process.env.DEEPSEEK_API_KEY,
  ollama: 'local',
}

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : null

  const effective = await userLlmConfigService.getEffectiveConfig(user.id, businessId)
  const runtime = await createAgentModelRuntime()
  const discovered = await describeRuntimeProviders(runtime)

  return {
    providers: discovered.map(provider => ({
      provider: provider.id,
      name: provider.name,
      models: provider.models,
      default_model: provider.models[0] ?? null,
      server_key_configured: Boolean(SERVER_KEY_ENV[provider.id]),
      user_key_configured: provider.id === effective.data?.provider && Boolean(effective.data?.apiKey),
      configured: provider.configured,
    })),
    default_provider: effective.data?.provider ?? 'openai',
    default_model: effective.data?.model ?? null,
    active: {
      provider: effective.data?.provider ?? null,
      model: effective.data?.model ?? null,
    },
  }
})

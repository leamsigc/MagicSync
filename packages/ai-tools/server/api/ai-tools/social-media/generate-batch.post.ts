import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'
import { businessContextResolver, contextErrorStatus } from '#layers/BaseDB/server/services/business-context-resolver.service'

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)
  const body = await readBody(event)

  if (!body?.topic?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Topic is required' })
  }

  if (!body?.platforms || !Array.isArray(body.platforms) || body.platforms.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'At least one platform is required' })
  }

  const contextResult = await businessContextResolver.resolve(user.id, {
    businessId: body.businessId ?? body.business_id ?? null,
    useBusinessContext: body.useBusinessContext === true || body.use_business_context === true,
  }, event)
  if (!contextResult.success || !contextResult.data) {
    throw createError({ statusCode: contextErrorStatus(contextResult.code), message: contextResult.error })
  }
  const brandContext = contextResult.data
  const llmJwtResult = await aiToolsFacade.getLlmJwtContext(user.id, user.email || '', brandContext.businessId)
  const llmJwt = llmJwtResult.data?.token ?? ''

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  const result = await $fetch<{
    posts: Record<string, Array<{
      text: string
      hashtags: string[]
      platform: string
      character_count: number
      warning?: string
    }>>
    generated_count: number
    errors?: string[]
  }>(`${backendUrl}/api/v1/social-media/generate-batch`, {
    method: 'POST',
    body: {
      topic: body.topic,
      platforms: body.platforms,
      tone: body.tone || 'professional',
      include_hashtags: body.include_hashtags ?? true,
      include_cta: body.include_cta ?? false,
      count_per_platform: body.count_per_platform || 1,
      business_id: brandContext.businessId,
      use_business_context: brandContext.enabled,
      context_edition_id: brandContext.editionId,
      business_context: brandContext.prompt || undefined,
    },
    headers: { Authorization: `Bearer ${llmJwt}` },
  })

  return result
})

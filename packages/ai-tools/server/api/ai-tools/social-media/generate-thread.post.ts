import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'
import { businessContextResolver, contextErrorStatus } from '#layers/BaseDB/server/services/business-context-resolver.service'

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)
  const body = await readBody(event)

  if (!body?.topic?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Topic is required' })
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
    thread?: Array<{
      text: string
      hashtags: string[]
      character_count: number
      tweet_number: number
      warning?: string
    }>
    tweet_count?: number
    error?: string
  }>(`${backendUrl}/api/v1/social-media/generate-thread`, {
    method: 'POST',
    body: {
      topic: body.topic,
      platform: body.platform || 'twitter',
      tweet_count: body.tweet_count || 5,
      hook_first: body.hook_first ?? true,
      business_id: brandContext.businessId,
      use_business_context: brandContext.enabled,
      context_edition_id: brandContext.editionId,
      business_context: brandContext.prompt || undefined,
    },
    headers: { Authorization: `Bearer ${llmJwt}` },
  })

  return result
})

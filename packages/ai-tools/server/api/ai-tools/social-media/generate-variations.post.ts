import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'
import { businessContextResolver, contextErrorStatus } from '#layers/BaseDB/server/services/business-context-resolver.service'

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)
  const body = await readBody(event)

  if (!body?.base_content?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Base content is required' })
  }

  if (!body?.platform?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Platform is required' })
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
    variations?: Array<{
      text: string
      hashtags: string[]
      character_count: number
      warning?: string
    }>
    count?: number
    error?: string
  }>(`${backendUrl}/api/v1/social-media/generate-variations`, {
    method: 'POST',
    body: {
      base_content: body.base_content,
      platform: body.platform,
      count: body.count || 3,
      variation_type: body.variation_type || 'rephrase',
      business_id: brandContext.businessId,
      use_business_context: brandContext.enabled,
      context_edition_id: brandContext.editionId,
      business_context: brandContext.prompt || undefined,
    },
    headers: { Authorization: `Bearer ${llmJwt}` },
  })

  return result
})

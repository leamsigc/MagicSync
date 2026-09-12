import z from 'zod'
import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'
import { businessContextResolver, contextErrorStatus } from '#layers/BaseDB/server/services/business-context-resolver.service'

const ResearchRequestSchema = z.object({
  businessId: z.string().min(1).nullish(),
  brief: z.string().min(1).max(8000),
  referenceDocumentIds: z.array(z.string().min(1)).max(50).default([]),
  referenceUrls: z.array(z.string().url().max(2048)).max(10).default([]),
  platforms: z.array(z.string().min(1).max(40)).max(20).default([]),
  lookbackDays: z.number().int().min(1).max(365).default(30),
  desiredOutput: z.string().max(80).default('topic_candidates'),
  useBusinessContext: z.boolean().default(false),
  maxSources: z.number().int().min(1).max(30).default(10),
})

export default defineEventHandler(async (event) => {
  const user = await aiToolsFacade.authenticate(event)
  const body = await readValidatedBody(event, ResearchRequestSchema.parse)

  const contextResult = await businessContextResolver.resolve(user.id, {
    businessId: body.businessId ?? null,
    useBusinessContext: body.useBusinessContext,
  }, event)
  if (!contextResult.success || !contextResult.data) {
    throw createError({ statusCode: contextErrorStatus(contextResult.code), message: contextResult.error })
  }
  const brandContext = contextResult.data
  const llmJwtResult = await aiToolsFacade.getLlmJwtContext(user.id, user.email || '', brandContext.businessId)
  const llmJwt = llmJwtResult.data?.token ?? ''

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  return await $fetch(`${backendUrl}/api/v1/research/run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${llmJwt}` },
    body: {
      business_id: brandContext.businessId,
      brief: body.brief,
      reference_document_ids: body.referenceDocumentIds,
      reference_urls: body.referenceUrls,
      platforms: body.platforms,
      lookback_days: body.lookbackDays,
      desired_output: body.desiredOutput,
      use_business_context: brandContext.enabled,
      business_context: brandContext.prompt || undefined,
      context_edition_id: brandContext.editionId,
      max_sources: body.maxSources,
    },
  })
})

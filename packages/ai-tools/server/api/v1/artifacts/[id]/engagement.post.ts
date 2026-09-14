import { analyticsService } from '#layers/BaseDB/server/services/analytics.service'
import { loadArtifactContext } from '#ai-tools/server/utils/artifact-context'
import { generationErrorStatus, resolveCheckPostIds } from '#ai-tools/server/utils/socialAi'

export default defineEventHandler(async (event) => {
  const { userId, businessId, artifact } = await loadArtifactContext(event)
  const body = (await readBody(event).catch(() => null)) ?? {} as { postIds?: unknown }
  const postIds = resolveCheckPostIds(body, artifact.postId)
  if (postIds.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This draft has no published post yet — engagement is measured from published posts',
    })
  }
  const rates = await analyticsService.calculateEngagement(userId, businessId, postIds, event)
  if (!rates.success) {
    throw createError({ statusCode: generationErrorStatus(rates.code), statusMessage: rates.error })
  }
  return {
    result: {
      results: rates.data.rates,
      count: rates.data.rates.length,
      source: 'authoritative',
      version: rates.data.version,
    },
  }
})

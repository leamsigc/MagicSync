import type { H3Event } from 'h3'
import { analyticsService } from '#layers/BaseDB/server/services/analytics.service'
import { scoreDraftVirality, scorePlatformVirality, splitArtifactOutput } from '#layers/BaseShared/server/utils/virality'
import { loadArtifactContext } from '#ai-tools/server/utils/artifact-context'
import { generationErrorStatus } from '#ai-tools/server/utils/socialAi'

async function viralityForPublished(userId: string, businessId: string, postId: string, event: H3Event) {
  const measured = await analyticsService.getPostPerformance(userId, businessId, postId, event)
  if (!measured.success) {
    throw createError({ statusCode: generationErrorStatus(measured.code), statusMessage: measured.error })
  }
  const metrics = measured.data.metrics
  return {
    post_id: postId,
    score: metrics?.viralityScore ?? null,
    engagement_rate: metrics?.engagementRate ?? null,
    reason: metrics && metrics.viralityScore !== null
      ? 'Measured engagement and reach'
      : measured.data.warnings[0] ?? 'Insufficient metric coverage',
    source: 'authoritative',
    version: measured.data.version,
  }
}

function overallText(caption: string, variants: Record<string, string>): string {
  if (caption.trim()) return caption
  return Object.values(variants).join('\n\n')
}

export default defineEventHandler(async (event) => {
  const { userId, businessId, artifact } = await loadArtifactContext(event)
  if (artifact.postId) return { result: await viralityForPublished(userId, businessId, artifact.postId, event) }
  const { caption, variants } = splitArtifactOutput(artifact.output)
  const platforms = Object.keys(variants)
  const overall = scoreDraftVirality(overallText(caption, variants))
  return {
    result: {
      post_id: null,
      ...overall,
      platforms: platforms.map(platform => scorePlatformVirality(variants[platform] ?? '', platform)),
    },
  }
})

import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { PLATFORMS } from '../../utils/platforms'
import { requireMcp, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

interface HashtagsResponse {
  hashtags?: string[]
  count?: number
  error?: string
}

export default defineMcpTool({
  description: 'Suggest hashtags for a topic and platform, tuned for reach vs niche balance.',
  inputSchema: {
    topic: z.string().min(1).describe('Topic of the post'),
    platform: PLATFORMS.describe('Target platform'),
    count: z.number().int().min(1).max(30).default(5).describe('How many hashtags'),
    style: z.enum(['mixed', 'trending', 'niche', 'branded']).default('mixed'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    const userId = await resolveUserId(mcp)
    const config = useRuntimeConfig()
    const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

    try {
      const result = await $fetch<HashtagsResponse>(`${backendUrl}/api/v1/social-media/generate-hashtags`, {
        method: 'POST',
        body: { topic: args.topic, platform: args.platform, count: args.count, style: args.style },
        headers: { 'X-User-Id': userId },
      })
      if (result.error || !result.hashtags) {
        throw new Error(result.error || 'Hashtag generation failed')
      }
      await logMcpCall(mcp, 'suggest-hashtags', undefined, 'success', `platform=${args.platform} count=${result.hashtags.length}`)
      return { hashtags: result.hashtags }
    }
    catch (error) {
      await logMcpCall(mcp, 'suggest-hashtags', undefined, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})

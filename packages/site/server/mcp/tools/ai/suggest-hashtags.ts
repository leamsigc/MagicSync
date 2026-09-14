import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { PLATFORMS } from '../../utils/platforms'
import { requireMcp } from '../../utils/mcp-context'
import { resolveMcpAiContext } from '../../utils/mcp-ai-context'
import { logMcpCall } from '../../utils/mcp-audit'
import { completeForUser, extractJsonObject } from '#layers/BaseAgent/server/utils/run-config'

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
    const ai = await resolveMcpAiContext(mcp)

    try {
      const result = await completeForUser(ai.ownerId, {
        businessId: mcp.businessId,
        useBusinessContext: false,
        system: ai.businessContext,
        maxTokens: 800,
        prompt: [
          `Suggest ${args.count} ${args.style} hashtags for a ${args.platform} post about: ${args.topic}.`,
          'Return strict JSON: {"hashtags": string[]}.',
        ].join('\n'),
      })
      if (!result.success) throw new Error(result.error)
      const json = result.data.json ?? extractJsonObject(result.data.text) ?? {}
      const hashtags = Array.isArray(json.hashtags) ? json.hashtags.filter(item => typeof item === 'string') : []
      if (hashtags.length === 0) throw new Error('Hashtag generation failed')
      await logMcpCall(mcp, 'suggest-hashtags', undefined, 'success', `platform=${args.platform} count=${hashtags.length}`)
      return { hashtags }
    }
    catch (error) {
      await logMcpCall(mcp, 'suggest-hashtags', undefined, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})

import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { PLATFORMS } from '../../utils/platforms'
import { requireMcp } from '../../utils/mcp-context'
import { resolveMcpAiContext } from '../../utils/mcp-ai-context'
import { logMcpCall } from '../../utils/mcp-audit'
import { buildCapabilityRunContext } from '#layers/BaseAgent/server/capabilities/run-context'
import { runCapability } from '#layers/BaseAgent/server/capabilities'
import '#layers/BaseAgent/server/capabilities/social'

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
      const ctx = await buildCapabilityRunContext(ai.ownerId, mcp.businessId, {
        useBusinessContext: false,
        capability: 'social.hashtags',
      })
      const outcome = await runCapability('social.hashtags', {
        topic: args.topic,
        platform: args.platform,
        count: args.count,
        style: args.style,
        system: ai.businessContext,
      }, ctx)
      if (!outcome.ok) throw new Error(outcome.error)
      const hashtags = outcome.output.hashtags
      await logMcpCall(mcp, 'suggest-hashtags', undefined, 'success', `platform=${args.platform} count=${hashtags.length}`)
      return { hashtags }
    }
    catch (error) {
      await logMcpCall(mcp, 'suggest-hashtags', undefined, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})

import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { PLATFORMS } from '../../utils/platforms'
import { requireMcp } from '../../utils/mcp-context'
import { resolveMcpAiContext } from '../../utils/mcp-ai-context'
import { logMcpCall } from '../../utils/mcp-audit'
import { buildCapabilityRunContext } from '#layers/BaseAgent/server/capabilities/run-context'
import { runCapability } from '#layers/BaseAgent/server/capabilities'
import '#layers/BaseAgent/server/capabilities/social'

interface GeneratePost {
  text: string
  hashtags: string[]
  platform: string
  character_count: number
  warning?: string
}

export default defineMcpTool({
  description: 'Generate AI post copy for a topic and platform (with hashtags, CTA optional). Uses the business owner\u2019s LLM config. Pair with create-post: generate first, then publish.',
  inputSchema: {
    topic: z.string().min(1).describe('Topic or subject of the post'),
    platform: PLATFORMS.describe('Target platform (length limits and style adapt per platform)'),
    tone: z.enum(['professional', 'casual', 'humorous', 'inspirational', 'educational', 'promotional']).default('professional'),
    includeHashtags: z.boolean().default(true),
    includeCta: z.boolean().default(false).describe('End with a call to action'),
    additionalContext: z.string().optional().describe('Brand voice notes, audience, constraints'),
    maxLength: z.number().int().positive().optional().describe('Hard cap on characters'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    const ai = await resolveMcpAiContext(mcp)

    try {
      const ctx = await buildCapabilityRunContext(ai.ownerId, mcp.businessId, {
        useBusinessContext: false,
        capability: 'social.caption',
      })
      const outcome = await runCapability('social.caption', {
        topic: args.topic,
        platform: args.platform,
        tone: args.tone,
        includeHashtags: args.includeHashtags,
        includeCta: args.includeCta,
        additionalContext: args.additionalContext,
        maxLength: args.maxLength,
        system: ai.businessContext,
      }, ctx)
      if (!outcome.ok) throw new Error(outcome.error)
      const text = outcome.output.text
      const post: GeneratePost = {
        text,
        hashtags: outcome.output.hashtags,
        platform: args.platform,
        character_count: text.length,
      }
      await logMcpCall(mcp, 'generate-caption', undefined, 'success', `platform=${args.platform}`)
      return post
    }
    catch (error) {
      await logMcpCall(mcp, 'generate-caption', undefined, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})

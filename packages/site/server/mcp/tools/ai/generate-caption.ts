import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { PLATFORMS } from '../../utils/platforms'
import { requireMcp } from '../../utils/mcp-context'
import { resolveMcpAiContext } from '../../utils/mcp-ai-context'
import { logMcpCall } from '../../utils/mcp-audit'
import { completeForUser, extractJsonObject } from '#layers/BaseAgent/server/utils/run-config'

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
      const result = await completeForUser(ai.ownerId, {
        businessId: mcp.businessId,
        useBusinessContext: false,
        system: ai.businessContext,
        maxTokens: 1200,
        prompt: [
          `Write one ${args.platform} post about: ${args.topic}.`,
          `Tone: ${args.tone}.`,
          args.includeHashtags ? 'Include 3-5 relevant hashtags.' : 'Do not include hashtags.',
          args.includeCta ? 'End with a clear call to action.' : '',
          args.additionalContext ? `Extra context: ${args.additionalContext}` : '',
          args.maxLength ? `Keep the caption under ${args.maxLength} characters.` : '',
          'Return strict JSON: {"text": string, "hashtags": string[]}.',
        ].filter(Boolean).join('\n'),
      })
      if (!result.success) throw new Error(result.error)
      const json = result.data.json ?? extractJsonObject(result.data.text) ?? {}
      const text = String(json.text ?? result.data.text)
      const post: GeneratePost = {
        text,
        hashtags: Array.isArray(json.hashtags) ? json.hashtags.filter(item => typeof item === 'string') : [],
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

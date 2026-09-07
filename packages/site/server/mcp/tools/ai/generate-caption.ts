import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { PLATFORMS } from '../../utils/platforms'
import { requireMcp, resolveUserId } from '../../utils/mcp-context'
import { logMcpCall } from '../../utils/mcp-audit'

interface GenerateResponse {
  post?: {
    text: string
    hashtags: string[]
    platform: string
    character_count: number
    warning?: string
  }
  error?: string
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
    const userId = await resolveUserId(mcp)
    const config = useRuntimeConfig()
    const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

    try {
      const result = await $fetch<GenerateResponse>(`${backendUrl}/api/v1/social-media/generate`, {
        method: 'POST',
        body: {
          topic: args.topic,
          platform: args.platform,
          tone: args.tone,
          include_hashtags: args.includeHashtags,
          include_cta: args.includeCta,
          additional_context: args.additionalContext || '',
          max_length: args.maxLength,
        },
        headers: { 'X-User-Id': userId },
      })
      if (result.error || !result.post) {
        throw new Error(result.error || 'AI generation failed')
      }
      await logMcpCall(mcp, 'generate-caption', undefined, 'success', `platform=${args.platform}`)
      return result.post
    }
    catch (error) {
      await logMcpCall(mcp, 'generate-caption', undefined, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})

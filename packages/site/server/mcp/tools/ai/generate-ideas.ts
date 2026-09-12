import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { PLATFORMS } from '../../utils/platforms'
import { requireMcp } from '../../utils/mcp-context'
import { resolveMcpAiContext } from '../../utils/mcp-ai-context'
import { logMcpCall } from '../../utils/mcp-audit'

interface HooksResponse {
  hooks?: Array<{ hook: string, hook_type: string }>
  count?: number
  error?: string
}

export default defineMcpTool({
  description: 'Generate scroll-stopping content hooks/ideas for a topic and platform. Use for brainstorming before generate-caption.',
  inputSchema: {
    topic: z.string().min(1).describe('Topic or niche to ideate on'),
    platform: PLATFORMS.describe('Target platform'),
    count: z.number().int().min(1).max(10).default(5).describe('How many hooks to generate'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    const ai = await resolveMcpAiContext(mcp)
    const config = useRuntimeConfig()
    const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

    try {
      const result = await $fetch<HooksResponse>(`${backendUrl}/api/v1/social-media/generate-hooks`, {
        method: 'POST',
        body: {
          topic: args.topic,
          platform: args.platform,
          count: args.count,
          business_id: mcp.businessId,
          use_business_context: !!ai.businessContext,
          context_edition_id: ai.editionId,
          business_context: ai.businessContext,
        },
        headers: { Authorization: `Bearer ${ai.token}` },
      })
      if (result.error || !result.hooks) {
        throw new Error(result.error || 'Idea generation failed')
      }
      await logMcpCall(mcp, 'generate-ideas', undefined, 'success', `platform=${args.platform} count=${result.hooks.length}`)
      return { hooks: result.hooks }
    }
    catch (error) {
      await logMcpCall(mcp, 'generate-ideas', undefined, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})

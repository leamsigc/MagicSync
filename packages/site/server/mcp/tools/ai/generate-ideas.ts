import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { PLATFORMS } from '../../utils/platforms'
import { requireMcp } from '../../utils/mcp-context'
import { resolveMcpAiContext } from '../../utils/mcp-ai-context'
import { logMcpCall } from '../../utils/mcp-audit'
import { buildCapabilityRunContext } from '#layers/BaseAgent/server/capabilities/run-context'
import { runCapability } from '#layers/BaseAgent/server/capabilities'
import '#layers/BaseAgent/server/capabilities/social'

interface Hook {
  hook: string
  hook_type: string
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

    try {
      const ctx = await buildCapabilityRunContext(ai.ownerId, mcp.businessId, {
        useBusinessContext: false,
        capability: 'social.hooks',
      })
      const outcome = await runCapability('social.hooks', {
        topic: args.topic,
        platform: args.platform,
        count: args.count,
        system: ai.businessContext,
      }, ctx)
      if (!outcome.ok) throw new Error(outcome.error)
      const hooks = outcome.output.hooks as Hook[]
      await logMcpCall(mcp, 'generate-ideas', undefined, 'success', `platform=${args.platform} count=${hooks.length}`)
      return { hooks }
    }
    catch (error) {
      await logMcpCall(mcp, 'generate-ideas', undefined, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})

import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { PLATFORMS } from '../../utils/platforms'
import { requireMcp } from '../../utils/mcp-context'
import { resolveMcpAiContext } from '../../utils/mcp-ai-context'
import { logMcpCall } from '../../utils/mcp-audit'
import { completeForUser, extractJsonObject } from '#layers/BaseAgent/server/utils/run-config'

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
      const result = await completeForUser(ai.ownerId, {
        businessId: mcp.businessId,
        useBusinessContext: false,
        system: ai.businessContext,
        maxTokens: 1200,
        prompt: [
          `Write ${args.count} scroll-stopping hooks for a ${args.platform} post about: ${args.topic}.`,
          'Return strict JSON: {"hooks": [{"hook": string, "hook_type": string}]}.',
        ].join('\n'),
      })
      if (!result.success) throw new Error(result.error)
      const json = result.data.json ?? extractJsonObject(result.data.text) ?? {}
      const rawHooks = Array.isArray(json.hooks) ? json.hooks : []
      const hooks = rawHooks
        .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
        .map(entry => ({ hook: String(entry.hook ?? ''), hook_type: String(entry.hook_type ?? 'general') }))
        .filter((entry): entry is Hook => entry.hook.length > 0)
      if (hooks.length === 0) throw new Error('Idea generation failed')
      await logMcpCall(mcp, 'generate-ideas', undefined, 'success', `platform=${args.platform} count=${hooks.length}`)
      return { hooks }
    }
    catch (error) {
      await logMcpCall(mcp, 'generate-ideas', undefined, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})

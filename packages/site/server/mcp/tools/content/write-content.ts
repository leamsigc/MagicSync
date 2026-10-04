import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { requireMcp } from '../../utils/mcp-context'
import { resolveMcpAiContext } from '../../utils/mcp-ai-context'
import { contentToolResult } from '../../utils/content-tool-result'
import { buildCapabilityRunContext, runCapability } from '#layers/BaseAgent/server/capabilities'

export default defineMcpTool({
  title: 'Write review-ready content',
  group: 'content',
  tags: ['content-pipeline', 'drafting'],
  description: 'Turn a brief into a review-ready article plus platform captions for the business bound to this Claude connector. It stops at human review and never publishes.',
  inputSchema: {
    title: z.string().min(1).max(200).describe('Content title'),
    brief: z.string().min(1).max(10000).describe('Research brief or source material'),
    platforms: z.array(z.string().min(1).max(40)).max(12).default([]).describe('Target platform names'),
    itemId: z.string().min(1).optional().describe('Existing content card to update'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  async handler(args) {
    const mcp = requireMcp()
    const ai = await resolveMcpAiContext(mcp)
    const context = await buildCapabilityRunContext(ai.ownerId, mcp.businessId, { useBusinessContext: true, capability: 'content.write' })
    const outcome = await runCapability('content.write', args, context)
    if (!outcome.ok) throw new Error(outcome.error)
    return contentToolResult({
      status: 'needs_review',
      summary: 'Draft created and placed in the review queue.',
      nextAction: 'Review the artifact in MagicSync before calling publish-content.',
      data: outcome.output,
    })
  },
})

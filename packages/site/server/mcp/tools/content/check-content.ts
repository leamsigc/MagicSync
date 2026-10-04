import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { requireMcp } from '../../utils/mcp-context'
import { resolveMcpAiContext } from '../../utils/mcp-ai-context'
import { contentToolResult } from '../../utils/content-tool-result'
import { buildCapabilityRunContext, runCapability } from '#layers/BaseAgent/server/capabilities'

const operation = z.enum(['seo-audit', 'extend', 'rewrite', 'internal-linking', 'social-post', 'carousel-draft'])

export default defineMcpTool({
  title: 'Check or transform content',
  group: 'content',
  tags: ['content-pipeline', 'seo'],
  description: 'Audit or transform supplied content without saving or publishing it. Use seo-audit for a deterministic report; other operations return a proposed result for review.',
  inputSchema: {
    operation: operation.describe('Check or transformation to run'),
    content: z.string().min(1).max(30000).describe('Markdown or plain text content'),
    topic: z.string().max(500).optional().describe('Optional topic context'),
    platforms: z.array(z.string().min(1).max(40)).max(12).default([]).describe('Target platforms for social output'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  async handler(args) {
    const mcp = requireMcp()
    const ai = await resolveMcpAiContext(mcp)
    const context = await buildCapabilityRunContext(ai.ownerId, mcp.businessId, { useBusinessContext: true, capability: 'content.check' })
    const outcome = await runCapability('content.check', args, context)
    if (!outcome.ok) throw new Error(outcome.error)
    return contentToolResult({
      status: 'ready',
      summary: `${args.operation} result is ready for review.`,
      nextAction: 'Apply the proposed result in MagicSync or ask Claude to refine it.',
      data: outcome.output,
    })
  },
})

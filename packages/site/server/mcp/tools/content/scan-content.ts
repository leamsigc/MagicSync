import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { requireMcp } from '../../utils/mcp-context'
import { resolveMcpAiContext } from '../../utils/mcp-ai-context'
import { contentToolResult } from '../../utils/content-tool-result'
import { buildCapabilityRunContext, runCapability } from '#layers/BaseAgent/server/capabilities'

export default defineMcpTool({
  title: 'Scan content ideas',
  group: 'content',
  tags: ['content-pipeline', 'research'],
  description: 'Research a topic — or the business itself when no topic is given — for the business bound to this Claude connector. Returns grounded content ideas with the sources behind them; it never creates or publishes content.',
  inputSchema: {
    topic: z.string().min(1).max(300).optional().describe('Topic to research; omit to scan the business itself'),
    count: z.number().int().min(1).max(10).default(6).describe('How many ideas to return'),
    platforms: z.array(z.string().min(1).max(40)).max(12).default([]).describe('Target platform names'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
  async handler(args) {
    const mcp = requireMcp()
    const ai = await resolveMcpAiContext(mcp)
    const context = await buildCapabilityRunContext(ai.ownerId, mcp.businessId, { useBusinessContext: true, capability: 'content.scan' })
    const outcome = await runCapability('content.scan', { topic: args.topic, count: args.count, platforms: args.platforms }, context)
    if (!outcome.ok) throw new Error(outcome.error)
    return contentToolResult({
      status: 'ready',
      summary: 'Content ideas are ready to pick from.',
      nextAction: 'Call write-content with the title and brief of the idea you picked.',
      data: outcome.output,
    })
  },
})

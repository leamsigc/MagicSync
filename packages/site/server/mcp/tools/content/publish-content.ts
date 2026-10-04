import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { requireMcp, requireScope } from '../../utils/mcp-context'
import { resolveMcpAiContext } from '../../utils/mcp-ai-context'
import { contentToolResult } from '../../utils/content-tool-result'
import { buildCapabilityRunContext, runCapability } from '#layers/BaseAgent/server/capabilities'

export default defineMcpTool({
  title: 'Publish approved content',
  group: 'content',
  tags: ['content-pipeline', 'publishing', 'destructive'],
  description: 'Publish one already-approved content card for the business bound to this Claude connector. Requires full access and an explicit confirmation; never publishes implicitly.',
  inputSchema: {
    itemId: z.string().min(1).describe('Content card ID'),
    provider: z.enum(['github', 'wordpress']).default('wordpress').describe('Delivery provider'),
    targetAccountIds: z.array(z.string().min(1)).min(1).optional().describe('Exact connected account IDs to target'),
    confirm: z.literal(true).describe('Must be true to confirm the release'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  async handler(args) {
    const mcp = requireMcp()
    requireScope(mcp, 'full')
    const ai = await resolveMcpAiContext(mcp)
    const context = await buildCapabilityRunContext(ai.ownerId, mcp.businessId, { useBusinessContext: true, capability: 'content.publish' })
    const outcome = await runCapability('content.publish', args, context)
    if (!outcome.ok) throw new Error(outcome.error)
    return contentToolResult({
      status: 'published',
      summary: 'Approved content was released through the publishing service.',
      nextAction: 'Use get-post or the MagicSync calendar to verify delivery status.',
      data: outcome.output,
    })
  },
})

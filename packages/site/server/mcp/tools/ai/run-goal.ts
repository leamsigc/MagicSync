import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { requireMcp } from '../../utils/mcp-context'
import { resolveMcpAiContext } from '../../utils/mcp-ai-context'
import { logMcpCall } from '../../utils/mcp-audit'
import { buildCapabilityRunContext, runCapability } from '#layers/BaseAgent/server/capabilities'

/** MCP adapter for the same goal.execute capability used by the HTTP goal route. */
export default defineMcpTool({
  description: 'Create a clear, verified plan for the bound business goal and return one recommended next action.',
  inputSchema: {
    goal: z.string().min(1).max(2000).describe('Business goal in the owner\'s own words, e.g. "Help me get more customers"'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    const ai = await resolveMcpAiContext(mcp)
    try {
      const runContext = await buildCapabilityRunContext(ai.ownerId, mcp.businessId, {
        useBusinessContext: true,
        capability: 'goal.execute',
      })
      const outcome = await runCapability('goal.execute', { goal: args.goal }, runContext)
      if (!outcome.ok) throw new Error(outcome.error)
      await logMcpCall(mcp, 'run-goal', undefined, 'success', `status=completed run=${outcome.output.goalRunId}`)
      return {
        goalRunId: outcome.output.goalRunId,
        status: 'completed',
        summary: outcome.output.summary,
        result: outcome.output,
      }
    }
    catch (error) {
      await logMcpCall(mcp, 'run-goal', undefined, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})

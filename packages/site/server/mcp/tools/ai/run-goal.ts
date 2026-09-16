import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
import { requireMcp } from '../../utils/mcp-context'
import { resolveMcpAiContext } from '../../utils/mcp-ai-context'
import { logMcpCall } from '../../utils/mcp-audit'
import { completeForUser } from '#layers/BaseAgent/server/utils/run-config'
import { goalOrchestratorService } from '#layers/BaseAgent/server/agentic/goal-orchestrator.service'

/**
 * MCP entry into the same agentic orchestrator the chat and API use: no
 * separate prompts, no separate agent logic. The completion is bound to the
 * business owner's effective model via the shared `completeForUser` path.
 */
export default defineMcpTool({
  description: 'Run a MagicSync agentic goal: MagicSync plans and executes research, analysis, opportunity discovery and marketing planning for the bound business, then returns a verified result with recommended next actions.',
  inputSchema: {
    goal: z.string().min(1).max(2000).describe('Business goal in the owner\'s own words, e.g. "Help me get more customers"'),
  },
  enabled: event => !!event.context.mcp?.valid,
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  async handler(args) {
    const mcp = requireMcp()
    const ai = await resolveMcpAiContext(mcp)
    try {
      const outcome = await goalOrchestratorService.executeGoal({
        userId: ai.ownerId,
        businessId: mcp.businessId,
        goal: args.goal,
        complete: async ({ system, prompt, maxTokens }) => {
          const result = await completeForUser(ai.ownerId, {
            businessId: mcp.businessId,
            system,
            prompt,
            maxTokens: maxTokens ?? 1600,
            useBusinessContext: false,
          })
          if (!result.success) throw new Error(result.error)
          return result.data.text
        },
        systemContext: ai.businessContext,
      })
      if (outcome.status === 'failed') throw new Error(outcome.error)
      await logMcpCall(mcp, 'run-goal', undefined, 'success', `status=${outcome.status}`)
      return outcome
    }
    catch (error) {
      await logMcpCall(mcp, 'run-goal', undefined, 'failure', error instanceof Error ? error.message : String(error))
      throw error
    }
  },
})

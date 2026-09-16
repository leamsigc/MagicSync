import { Type } from 'typebox'
import { defineTool, type ToolDefinition } from '@earendil-works/pi-coding-agent'
import { goalOrchestratorService } from '../../agentic/goal-orchestrator.service'
import { createAgentComplete } from '../../utils/pi-runtime'
import type { AgentToolContext } from '../tool-context'

/**
 * Chat-side goal entry: the orchestrator (not the chat model) plans and runs
 * the steps. Headless by design — the caller receives the verified outcome;
 * streaming progress is exposed by the dedicated goal API for goal UIs.
 */
export function createGoalTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'execute_goal',
      label: 'Execute a business goal',
      description: 'Turn a business-owner goal (for example "help me get more customers" or "research my competitors") into a planned, executed and verified run. Use for broad business goals, not for board or card tasks.',
      parameters: Type.Object({
        goal: Type.String({ description: 'The business goal in the owner\'s own words' }),
      }),
      execute: async (_toolCallId, params) => {
        if (!ctx.modelRuntime || !ctx.model) {
          throw new Error('GOAL_UNAVAILABLE: no model runtime is configured for this run')
        }
        const outcome = await goalOrchestratorService.executeGoal({
          userId: ctx.userId,
          businessId: ctx.businessId,
          goal: params.goal,
          complete: createAgentComplete(ctx.modelRuntime, ctx.model),
          event: ctx.event,
          log: ctx.log,
        })
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(outcome) }],
          details: outcome,
        }
      },
    }),
  ]
}

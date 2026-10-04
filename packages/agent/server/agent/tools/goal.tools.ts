import { defineTool, type ToolDefinition } from '@flue/runtime'
import * as v from 'valibot'
import { runCapability } from '../../capabilities'
import type { AgentToolContext } from '../tool-context'
import { toolFailure } from './tool-result'

const toolError = (code: string | undefined, message: string): never => toolFailure(code, message, 'GOAL_FAILED')

/**
 * Chat-side goal entry: the orchestrator (not the chat model) plans and runs
 * the steps. Headless by design — the caller receives the verified outcome;
 * streaming progress is exposed by the dedicated goal API for goal UIs.
 *
 * T29: the model call is the server-owned `ctx.complete` the runner injects per
 * run — the Flue-derived completion helper (`flue/complete.ts`) that replaced
 * the pi `createAgentComplete(runtime, model, …)` this tool used to rebuild.
 */
export function createGoalTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'execute_goal',
      description: 'Turn a business-owner goal (for example "help me get more customers" or "research my competitors") into a planned, executed and verified run. Use for broad business goals, not for board or card tasks.',
      input: v.object({
        goal: v.pipe(v.string(), v.description('The business goal in the owner\'s own words')),
      }),
      run: async (toolCtx) => {
        const complete = ctx.complete
        if (!complete) toolError('GOAL_UNAVAILABLE', 'no model runtime is configured for this run')
        const outcome = await runCapability('goal.execute', { goal: toolCtx.data.goal }, {
          userId: ctx.userId,
          businessId: ctx.businessId,
          complete,
          systemContext: '',
          event: ctx.event,
          log: ctx.log,
          onEvent: ctx.emit,
        })
        if (!outcome.ok) toolError(outcome.code, outcome.error)
        return { output: outcome.output }
      },
    }),
  ]
}

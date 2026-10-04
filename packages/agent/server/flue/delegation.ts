import type { ToolDefinition, ToolContext } from '@flue/runtime'

/**
 * T27 — delegate guards for the Flue subagent set.
 *
 * The pi delegation loop that used to live in
 * `server/agent/tools/subagent.tools.ts` is gone: delegation now runs on
 * Flue's built-in `task` tool against the delegates declared by
 * `createSpecialistSubagents` (see `specialists.ts`). Everything a delegate
 * needs beyond its own render comes from these two helpers, which replace the
 * pi loop's two custom behaviours:
 *
 * 1. **Bounded turns.** The loop used `shouldStopAfterTurn` at
 *    `SUBAGENT_MAX_TURNS = 6`. Flue exposes no turn cap for a delegate, so the
 *    cap is enforced at the delegate's tool boundary instead: after the cap
 *    every allowlisted tool answers with a typed `SUBAGENT_TURN_BUDGET`
 *    refusal carrying `truncated: true`, and the delegate's answer contract
 *    (`delegationResultContract`) makes it finalise with `"truncated": true`.
 *    The budget is created per delegate render, so it resets for every task.
 * 2. **Carousel payload passthrough.** The old loop scraped the delegate's tool
 *    results and surfaced the carousel JSON to the parent. Flue deliberately
 *    returns only the delegate's *final message* to the parent, so the payload
 *    has to travel through the delegate's answer. A carousel tool result (JSON
 *    with an array `slides`) is therefore wrapped in an explicit passthrough
 *    envelope that names the contract, and the answer contract tells the
 *    delegate to copy `payload` verbatim — `artifactId` and `version`
 *    included — into its `carousel` field.
 */

/** Preserved cap from the deleted pi delegation loop. */
export const SUBAGENT_MAX_TURNS = 6

/** Typed marker a delegate sees once its turn budget is spent. */
export const TURN_BUDGET_CODE = 'SUBAGENT_TURN_BUDGET'

interface TurnBudget {
  max: number
  spent: number
}

function budgetRefusal(budget: TurnBudget): Record<string, unknown> {
  return {
    error: TURN_BUDGET_CODE,
    message: `Turn budget exhausted after ${budget.max} tool turns. Answer now with "truncated": true and the best result you have.`,
    truncated: true,
    turns: budget.max,
  }
}

/** Unwrap a Flue tool run result (`{ output }` envelope or a bare value). */
function outputOf(result: unknown): unknown {
  return (result && typeof result === 'object' && 'output' in result)
    ? (result as { output: unknown }).output
    : result
}

function isCarouselPayload(output: unknown): boolean {
  return !!output && typeof output === 'object' && Array.isArray((output as { slides?: unknown[] }).slides)
}

/** Name the passthrough so the delegate copies the payload instead of summarizing it. */
function carouselEnvelope(payload: unknown): Record<string, unknown> {
  return {
    passthrough: 'carousel',
    instruction: 'Set your "carousel" field to `payload` verbatim — slides, artifactId and version unchanged.',
    payload,
  }
}

async function guardedRun(budget: TurnBudget, tool: ToolDefinition, ctx: ToolContext<never>): Promise<{ output?: unknown, terminate?: boolean }> {
  budget.spent += 1
  if (budget.spent > budget.max) return { output: budgetRefusal(budget) }
  const result = await tool.run(ctx as never)
  const output = outputOf(result)
  if (isCarouselPayload(output)) return { output: carouselEnvelope(output) }
  return { output }
}

/**
 * Wrap one allowlisted delegate tool with the turn budget and the carousel
 * passthrough. One budget is shared by every tool of a single delegate render.
 */
function guardDelegateTool(tool: ToolDefinition, budget: TurnBudget): ToolDefinition {
  return {
    ...tool,
    run: (ctx: ToolContext<never>) => guardedRun(budget, tool, ctx),
  } as ToolDefinition
}

/** Guard every tool a delegate mounts (called inside the delegate render). */
export function guardDelegateTools(tools: ToolDefinition[]): ToolDefinition[] {
  const budget: TurnBudget = { max: SUBAGENT_MAX_TURNS, spent: 0 }
  return tools.map(tool => guardDelegateTool(tool, budget))
}

/**
 * The strict-JSON answer contract a delegate must follow so its final message
 * — the only thing `task` hands back to the parent — carries the same payload
 * the old pi loop exposed in the tool result.
 */
export function delegationResultContract(shape: string): string {
  return [
    `Return strict JSON with no prose and no code fences: ${shape}.`,
    `Add "truncated": true only when a tool answered ${TURN_BUDGET_CODE}; otherwise false.`,
    'When a tool returns a "passthrough": "carousel" envelope, set your "carousel" field to its payload verbatim — slides, artifactId and version unchanged.',
  ].join('\n')
}
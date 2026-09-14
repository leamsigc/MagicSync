export interface AgentLimits {
  maxTurns: number
  maxToolCalls: number
  tokenBudget: number
  toolTimeoutMs: number
  maxConcurrency: number
}

export const AGENT_LIMIT_DEFAULTS: AgentLimits = {
  maxTurns: 12,
  maxToolCalls: 40,
  tokenBudget: 200_000,
  toolTimeoutMs: 60_000,
  maxConcurrency: 3,
}

export type LimitCheck =
  | { allowed: true }
  | { allowed: false, code: string, reason: string }

const ALLOWED: LimitCheck = { allowed: true }

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

/** §3.1 limits from env with safe defaults. */
export function readAgentLimits(env: NodeJS.ProcessEnv = process.env): AgentLimits {
  return {
    maxTurns: readPositiveInt(env.AGENT_MAX_TURNS, AGENT_LIMIT_DEFAULTS.maxTurns),
    maxToolCalls: readPositiveInt(env.AGENT_MAX_TOOL_CALLS, AGENT_LIMIT_DEFAULTS.maxToolCalls),
    tokenBudget: readPositiveInt(env.AGENT_TOKEN_BUDGET, AGENT_LIMIT_DEFAULTS.tokenBudget),
    toolTimeoutMs: readPositiveInt(env.AGENT_TOOL_TIMEOUT_MS, AGENT_LIMIT_DEFAULTS.toolTimeoutMs),
    maxConcurrency: readPositiveInt(env.AGENT_MAX_CONCURRENCY, AGENT_LIMIT_DEFAULTS.maxConcurrency),
  }
}

function checkBudget(used: number, max: number, code: string): LimitCheck {
  if (used < max) return ALLOWED
  return { allowed: false, code, reason: `${code}: used ${used} of ${max}` }
}

export function enforceTurnLimit(turnsUsed: number, limits: AgentLimits = readAgentLimits()): LimitCheck {
  return checkBudget(turnsUsed, limits.maxTurns, 'AGENT_TURN_LIMIT')
}

export function enforceToolCallLimit(toolCalls: number, limits: AgentLimits = readAgentLimits()): LimitCheck {
  return checkBudget(toolCalls, limits.maxToolCalls, 'AGENT_TOOL_CALL_LIMIT')
}

export function checkTokenBudget(tokensUsed: number, limits: AgentLimits = readAgentLimits()): LimitCheck {
  return checkBudget(tokensUsed, limits.tokenBudget, 'AGENT_TOKEN_BUDGET')
}

/** Run a task with the per-tool timeout signal (caller maps abort to a tool error). */
export async function withToolTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  limits: AgentLimits = readAgentLimits(),
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), limits.toolTimeoutMs)
  try {
    return await task(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

/** Bounded-parallelism runner used for batch tool/board work. */
export async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  maxConcurrency: number = readAgentLimits().maxConcurrency,
): Promise<T[]> {
  const results = new Array<T>(tasks.length)
  const workers = Math.max(1, Math.min(maxConcurrency, tasks.length))
  let next = 0
  async function runWorker() {
    while (next < tasks.length) {
      const index = next
      next += 1
      results[index] = await tasks[index]()
    }
  }
  await Promise.all(Array.from({ length: workers }, () => runWorker()))
  return results
}

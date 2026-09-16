import type { RequestLogger } from 'evlog'
import type { ToolDefinition } from '@earendil-works/pi-coding-agent'
import { emitLog } from '#layers/BaseShared/server/utils/evlog'
import type { AgentToolContext } from '../../tool-context'
import { detectRegex } from './detect'
import { createPiiTools } from './tools'

export * from './detect'
export { createPiiTools } from './tools'

export interface PiiPlugin {
  /** Agent-callable tools (pii_scan). */
  tools: ToolDefinition[]
  /** Counts-only PII screen for logs; values never leave this function. */
  screen: (stage: string, text: string) => void
}

/**
 * Log PII findings as type:count pairs. Raw values are never logged —
 * only the counts leave this function.
 */
export function logPiiScreen(log: RequestLogger | undefined, stage: string, text: string): void {
  const counts = new Map<string, number>()
  for (const match of detectRegex(text)) counts.set(match.type, (counts.get(match.type) ?? 0) + 1)
  if (counts.size === 0) return
  emitLog(log, { message: 'pii.screen-detected', stage, types: [...counts].map(([type, total]) => `${type}:${total}`) })
}

/**
 * PII plugin composer (pi-factory style: takes the server-owned tool
 * context, returns tools + screening). Wired into sessions through the
 * tool registry — see `server/agent/tools/index.ts`.
 */
export function createPiiPlugin(ctx: AgentToolContext): PiiPlugin {
  return {
    tools: createPiiTools(ctx),
    screen: (stage, text) => logPiiScreen(ctx.log, stage, text),
  }
}

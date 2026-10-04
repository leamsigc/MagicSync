import type { ToolDefinition } from '@flue/runtime'
import type { AgentToolContext } from '../tool-context'
import { createAgentTools } from './index'

/**
 * T28 — the Flue per-agent tool mount and the server-owned allowlist guard that
 * replaces the pi `tool_call` extension (`extensions/guard.extension.ts`,
 * deleted here).
 *
 * Two things changed with the runtime:
 *
 * 1. **Mounts, not the whole catalog.** `createAgentTools(ctx)` is the *bag*
 *    for one run (40 tools today). A Flue agent mounts only what it needs, so
 *    the bag goes through `mountAgentTools(bag, { agent, allowedTools })` and the
 *    model sees the agent's handful — `MAX_TOOLS_PER_TURN` is the small-model
 *    budget (T11) measured on the wire by `tests/small-model.test.mjs`.
 * 2. **The guard is an interceptor, not an extension hook.** There is no pi
 *    `ExtensionAPI` to hang `tool_call` on, so the guard is split in two:
 *    `selectAgentTools` (the mount filter, which audits each withheld tool as
 *    blocked) and `guardAgentTools` (the call-time interceptor, which audits
 *    every invocation and refuses anything not on the allowlist).
 *    `mountAgentTools` is the composition an agent render uses.
 */
export const TOOL_NOT_ALLOWED = 'TOOL_NOT_ALLOWED'

/**
 * Small-model budget: how many tools one model turn may offer, framework tools
 * included (T11). `task` is always offered; `activate_skill` whenever the agent
 * mounts skills — every specialist does.
 */
export const MAX_TOOLS_PER_TURN = 7

/** Flue's own tools, offered on top of our mount. Never ours to gate. */
export const FRAMEWORK_TOOL_NAMES = ['task', 'activate_skill'] as const

/** Tools a mount adds to the model on top of ours (`activate_skill` needs skills). */
export const FRAMEWORK_TOOL_COUNT = FRAMEWORK_TOOL_NAMES.length

export interface ToolAuditEntry {
  toolName: string
  blocked: boolean
  reason?: string
  /** Agent/session the allowlist belongs to. */
  agent?: string
}

export interface ToolGuardOptions {
  /** Agent or session the allowlist belongs to (audit context). */
  agent: string
  /** Server-owned allowlist. Anything else is never mounted and never runs. */
  allowedTools: readonly string[]
  /** Audit sink; omitted means "no observer", exactly like the old extension. */
  onAudit?: (entry: ToolAuditEntry) => void
}

/**
 * The chat orchestrator's mount: four of our tools plus Flue's `task` and
 * `activate_skill` is the whole turn. Everything else in the catalog is reached
 * through a specialist delegate or the `/api/v1/content/*` capabilities.
 */
export const CHAT_AGENT_MOUNT: readonly string[] = [
  'board_list',
  'write_post',
  'generate_carousel',
  'schedule_post',
  'schedule_direct_posts',
]

/** Tools offered to the model for a mount of `ourTools` (framework included). */
export function offeredToolCount(ourTools: readonly string[]): number {
  return ourTools.length + FRAMEWORK_TOOL_COUNT
}

/** Typed refusal a model sees when a guarded tool is not on the allowlist. */
function refusal(agent: string): Record<string, unknown> {
  return {
    error: TOOL_NOT_ALLOWED,
    message: `${TOOL_NOT_ALLOWED}: tool is not enabled for ${agent}`,
    blocked: true,
  }
}

/**
 * Call-time interceptor: re-checks the allowlist and emits the audit event the
 * pi `tool_call` hook used to emit, then delegates to the real `run`. It is the
 * second line — a tool that reached a mount without being selected (a stale bag
 * entry, a renamed tool) is refused here instead of running.
 */
function interceptTool(
  tool: ToolDefinition,
  options: ToolGuardOptions,
  isAllowed: (name: string) => boolean,
  audit: (entry: ToolAuditEntry) => void,
): ToolDefinition {
  const guarded: ToolDefinition = {
    ...tool,
    run: async (toolCtx) => {
      if (!isAllowed(tool.name)) {
        audit({ toolName: tool.name, blocked: true, reason: TOOL_NOT_ALLOWED, agent: options.agent })
        return { output: refusal(options.agent) }
      }
      audit({ toolName: tool.name, blocked: false, agent: options.agent })
      return tool.run(toolCtx as never) as { output?: unknown }
    },
  }
  return guarded
}

function auditSink(options: ToolGuardOptions): (entry: ToolAuditEntry) => void {
  return options.onAudit ?? (() => {})
}

/**
 * Mount filter: keep only the allowlisted tools. Every withheld tool is audited
 * as blocked, so a narrowed mount stays as observable as the old extension's
 * per-call refusal was.
 */
export function selectAgentTools(tools: ToolDefinition[], options: ToolGuardOptions): ToolDefinition[] {
  const allowed = new Set(options.allowedTools)
  const audit = auditSink(options)
  for (const tool of tools) {
    if (allowed.has(tool.name)) continue
    audit({ toolName: tool.name, blocked: true, reason: TOOL_NOT_ALLOWED, agent: options.agent })
  }
  return tools.filter(tool => allowed.has(tool.name))
}

/** The interceptor alone: wrap every tool it is given, allowed or not. */
export function guardAgentTools(tools: ToolDefinition[], options: ToolGuardOptions): ToolDefinition[] {
  const allowed = new Set(options.allowedTools)
  const audit = auditSink(options)
  const isAllowed = (name: string) => allowed.has(name)
  return tools.map(tool => interceptTool(tool, options, isAllowed, audit))
}

/** What an agent render mounts: the allowlist, then the interceptor. */
export function mountAgentTools(tools: ToolDefinition[], options: ToolGuardOptions): ToolDefinition[] {
  return guardAgentTools(selectAgentTools(tools, options), options)
}

/** The server-owned tool bag for one run, keyed by tool name. */
export function createAgentToolBag(ctx: AgentToolContext): Record<string, ToolDefinition> {
  return Object.fromEntries(createAgentTools(ctx).map(tool => [tool.name, tool]))
}

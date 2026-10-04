import type { SubagentDefinition, ToolDefinition } from '@flue/runtime'

/**
 * T29 — the server-owned binding seam between `agent-runner.service.ts` and the
 * ONE registered Flue agent (`MagicSyncAgent`).
 *
 * Why a registry instead of a per-run agent function: `start()` registers the
 * agent set, and `getFlueRuntime`'s singleton key is built from those names —
 * so a fresh agent closure per request would change the key and re-boot the
 * runtime on every call (draining in-flight conversations). The runner must
 * therefore dispatch to a stable identity, and the per-run facts (model
 * specifier, system instruction, guarded tool mount) arrive at render time.
 *
 * Flue hands the agent function the conversation id (`AgentProps.id`), which is
 * exactly the address the runner chose in `init(agent, { id })`. That id keys
 * this registry. Nothing in it is ever model-supplied: the model chooses tool
 * *arguments*, never the mount, the prompt, or the model.
 *
 * Tenant identity is closed over inside the bound `ToolDefinition`s (see
 * `agent/tools/mounts.ts`) and inside the prebuilt subagent definitions (see
 * `createSpecialistSubagents`); a binding carries closures, never identity fields.
 */
export interface AgentBinding {
  /** Flue model specifier, `provider-id/model-id`, resolved per run (T26). */
  model: string
  /** System instruction for this conversation's turns. */
  instructions: string
  /** The guarded per-agent mount; empty mounts none. */
  tools: readonly ToolDefinition[]
  /** Prebuilt specialist delegates; empty mounts none (unbound spike path). */
  subagents?: readonly SubagentDefinition[]
}

const bindings = new Map<string, AgentBinding>()

/** Bind one conversation to a run. Overwrites any earlier binding for the id. */
export function bindAgentConversation(conversationId: string, binding: AgentBinding): void {
  bindings.set(conversationId, binding)
}

/** Drop the binding once the run settled (or failed to start). */
export function releaseAgentConversation(conversationId: string): void {
  bindings.delete(conversationId)
}

/** The binding for a conversation id, or undefined for an unbound one. */
export function agentBinding(conversationId: string | undefined): AgentBinding | undefined {
  return conversationId === undefined ? undefined : bindings.get(conversationId)
}

/** Bound conversation ids (test/inspection seam). */
export function boundConversationIds(): string[] {
  return [...bindings.keys()]
}
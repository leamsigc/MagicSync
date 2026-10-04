import type { RequestLogger } from 'evlog'
import { init } from '@flue/runtime'
import { emitLog } from '#layers/BaseShared/server/utils/evlog'
import type { AgentComplete } from '../agent/tool-context'
import { bindAgentConversation, releaseAgentConversation } from './agent-bindings'
import { MagicSyncAgent } from './magicsync-agent'
import { getFlueRuntime, type BusinessProviderRegistration } from './runtime'

/**
 * T29 — the Flue-derived completion helper, replacing the pi
 * `createAgentComplete(runtime, model, …)` that `server/utils/pi-runtime.ts`
 * owned (its replacement for the tools that call a model inside a tool run).
 *
 * A completion is one model call: `{ system, prompt }` in, text out. On Flue
 * that is a conversation turn, not a raw provider call, so it runs as a
 * throwaway conversation on the SAME registered agent identity the chat runner
 * uses — which keeps the boot options (and therefore the runtime singleton)
 * stable. Each call gets its own conversation id so completions never inherit
 * each other's history.
 *
 * The instruction is the caller's `system` prompt plus a fixed contract; Flue
 * exposes no per-call `maxTokens` (the model's declared `maxTokens` applies),
 * so the hint is carried as an instruction instead.
 */
const COMPLETION_CONTRACT = [
  'Answer with exactly the requested content and nothing else.',
  'No preamble, no sign-off, no markdown code fences around plain prose or JSON.',
].join(' ')

export interface FlueCompleteOptions {
  /** Request logger for the `ai.call.*` pair this completion emits. */
  log?: RequestLogger
  /** `ai.call` call name (defaults to `agent.complete`). */
  callName?: string
  /** Extra correlation fields on both `ai.call` events. */
  metadata?: Record<string, unknown>
}

/** Token budget as an instruction hint — Flue has no per-call cap. */
function withTokenHint(system: string, maxTokens?: number): string {
  if (!maxTokens) return system
  return `${system} [about ${maxTokens} tokens]`.trim()
}

function logPreview(value: unknown, limit = 12000): string {
  let serialized = ''
  try {
    serialized = typeof value === 'string' ? value : JSON.stringify(value)
  }
  catch {
    serialized = String(value)
  }
  return serialized.length > limit ? `${serialized.slice(0, limit)}…` : serialized
}

/**
 * Bind a plain-text completion to one business's Flue provider. The returned
 * function is the `AgentComplete` the agent tools receive (`ctx.complete`), and
 * it is safe to call from inside a tool run: the completion conversation is
 * independent of the conversation that run belongs to.
 */
export function createFlueComplete(
  registration: Pick<BusinessProviderRegistration, 'modelSpecifier'>,
  options: FlueCompleteOptions = {},
): AgentComplete {
  const callName = options.callName ?? 'agent.complete'
  const correlation = { ...options.metadata }
  return async (input) => {
    const startedAt = Date.now()
    const system = withTokenHint([input.system, COMPLETION_CONTRACT].filter(Boolean).join('\n\n'), input.maxTokens)
    emitLog(options.log, {
      message: 'ai.call.started',
      callName,
      input: { system: logPreview(system), prompt: logPreview(input.prompt) },
      ...correlation,
    })
    const conversationId = `complete-${crypto.randomUUID()}`
    try {
      // Same boot options as the chat runner and the T25 HTTP mount: one
      // runtime, one registered agent identity, one conversation per call.
      await getFlueRuntime({ agents: [MagicSyncAgent] })
      bindAgentConversation(conversationId, { model: registration.modelSpecifier, instructions: system, tools: [] })
      const handle = init(MagicSyncAgent, { id: conversationId })
      const receipt = await handle.dispatch({ message: input.prompt })
      const output = (await handle.read(receipt)).text.trim()
      emitLog(options.log, {
        message: 'ai.call.completed',
        callName,
        output: logPreview(output),
        durationMs: Date.now() - startedAt,
        ...correlation,
      })
      return output
    }
    catch (error) {
      emitLog(options.log, {
        message: 'ai.call.failed',
        callName,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
        ...correlation,
      })
      throw error
    }
    finally {
      releaseAgentConversation(conversationId)
    }
  }
}
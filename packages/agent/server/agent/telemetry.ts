import { AsyncLocalStorage } from 'node:async_hooks'
import type { RequestLogger } from 'evlog'
import { emitAiCallEvent } from '#layers/BaseShared/server/utils/evlog'

/**
 * T19 AI-call telemetry (PRD §5.4/§5.5): one `ai.call` evlog event per model
 * call, correlated by run/capability, honouring the AGENT_AI_LOG policy:
 * - `metadata` (default): model, provider, tokens, latency, tool names, finish
 *   reason, error — no prompt or output content.
 * - `redacted`: as above plus input/output with secrets, emails, phones scrubbed.
 * - `payload`: full final input + output, truncated to AGENT_AI_LOG_MAX_BYTES.
 * API keys/credential material are never logged at any level.
 *
 * Registered ONCE at agent-layer boot (`server/plugins/ai-telemetry.ts` via
 * `ensureAiCallTelemetry`); nothing elsewhere logs model traffic. The Flue
 * `instrument({ model })` interceptor wraps every provider call correlated by
 * `turnId`; `observe()` receives `turn_request` (the full final request,
 * in-process only), `turn`, `tool`, `submission_settled`, `log`.
 */

export type AiLogPolicy = 'metadata' | 'redacted' | 'payload'

/** Last-resort sink for events emitted without a request logger (tests, jobs). */
const aiCallSink: Array<Record<string, unknown>> = []

/** Inspect collected ai.call events (test/inspection seam). */
export function getAiCallSink(): Array<Record<string, unknown>> {
  return aiCallSink
}

/** Clear the sink (test seam). */
export function clearAiCallSink(): void {
  aiCallSink.length = 0
}

export function aiLogPolicy(): AiLogPolicy {
  const raw = (process.env.AGENT_AI_LOG ?? 'metadata').toLowerCase()
  return raw === 'redacted' || raw === 'payload' ? raw : 'metadata'
}

export function aiLogMaxBytes(): number {
  const parsed = Number.parseInt(process.env.AGENT_AI_LOG_MAX_BYTES ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20000
}

/** Per-run correlation carried across async boundaries (jobs, MCP, chat). */
export interface AiCallContext {
  runId?: string
  capability?: string
  agent?: string
  purpose?: string
  userId?: string
  businessId?: string
}

const aiCallStorage = new AsyncLocalStorage<AiCallContext>()

/** Run `fn` with ai.call correlation attached (precedent: mcp-request.ts). */
export function withAiCallContext<T>(context: AiCallContext, fn: () => T): T {
  return aiCallStorage.run(context, fn)
}

/** Correlation for the current execution (undefined outside a context). */
export function aiCallContext(): AiCallContext | undefined {
  return aiCallStorage.getStore()
}

const CREDENTIAL_KEYS = /api[-_]?key|authorization|token|secret|password|credential/i

/** Strip credential material — never logged at any policy level. */
function scrubCredentials(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => scrubCredentials(item))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (CREDENTIAL_KEYS.test(key) && (typeof item === 'string' || typeof item === 'number')) continue
      out[key] = scrubCredentials(item)
    }
    return out
  }
  if (typeof value === 'string') {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
      .replace(/sk-[A-Za-z0-9]{8,}/g, '[redacted-key]')
  }
  return value
}

function scrubPersonal(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted-email]')
      .replace(/(\+?\d[\d\s().-]{7,}\d)/g, '[redacted-phone]')
  }
  if (Array.isArray(value)) return value.map(scrubPersonal)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) out[key] = scrubPersonal(item)
    return out
  }
  return value
}

function truncate(text: string, maxBytes: number): string {
  if (text.length <= maxBytes) return text
  return `${text.slice(0, maxBytes)}…[truncated ${text.length - maxBytes}B]`
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function serialize(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return String(value)
  }
}

export interface AiCallTelemetry {
  callId: string
  submissionId?: string
  runId?: string
  capability?: string
  agent?: string
  purpose?: string
  provider: string
  model: string
  latencyMs: number
  finishReason?: string
  error?: string
  usage?: { promptTokens?: number, completionTokens?: number, cachedTokens?: number }
  /** The final request payload available in-process (Flue `turn_request`). */
  input?: unknown
  /** The assistant output for the call. */
  output?: unknown
  toolNames?: string[]
  log?: RequestLogger
  [key: string]: unknown
}

/** Emit one `ai.call` event under the configured content policy. Never throws. */
export function emitAiCall(fields: AiCallTelemetry): void {
  try {
    const policy = aiLogPolicy()
    const maxBytes = aiLogMaxBytes()
    const { input, output, log, ...base } = fields
    const record: Record<string, unknown> = { contentPolicy: policy, ...base }

    if (policy === 'metadata') {
      record.input = undefined
      record.output = undefined
    } else if (policy === 'redacted') {
      record.input = scrubPersonal(scrubCredentials(input))
      record.output = scrubPersonal(scrubCredentials(output))
    } else {
      record.input = safeJson(truncate(serialize(scrubCredentials(input)), maxBytes))
      record.output = safeJson(truncate(serialize(scrubCredentials(output)), maxBytes))
    }

    emitAiCallEvent(log, record)
    aiCallSink.push(record)
    if (aiCallSink.length > 200) aiCallSink.shift()
  } catch {
    // observability must never break the pipeline
  }
}

interface AiCallRowInput {
  userId?: string
  businessId?: string
  capability?: string
  provider: string
  model: string
  latencyMs: number
  tokensUsed: number
  error?: string
}

/** Background `agent_runs` writes awaiting completion (test seam: flush). */
const pendingRecordWrites: Array<Promise<unknown>> = []

/** Await outstanding per-call row writes (tests; production is fire-and-forget). */
export function flushAiCallRecords(): Promise<unknown[]> {
  const pending = [...pendingRecordWrites]
  pendingRecordWrites.length = 0
  return Promise.all(pending)
}

/**
 * Compact per-call row into the existing `agent_runs` for debugging without a
 * log drain (§5.4). Best-effort: never throws, skips when no user is known.
 * The service module is imported lazily so DB-free tests never touch Drizzle.
 */
async function writeAiCallRow(input: AiCallRowInput): Promise<void> {
  if (!input.userId) return
  try {
    const { agentRunService } = await import('../services/agent-run.service')
    const started = await agentRunService.start(input.userId, {
      businessId: input.businessId ?? null,
      agentName: `ai.call:${input.capability ?? 'model'}`,
    })
    if (!started.success) return
    await agentRunService.finish(started.data.id, {
      status: input.error ? 'failed' : 'completed',
      tokensUsed: input.tokensUsed,
      durationMs: input.latencyMs,
      toolEvents: [],
      summary: `${input.provider}/${input.model} · ${input.latencyMs}ms · ${input.tokensUsed}tok${input.error ? ` · ${input.error}` : ''}`.slice(0, 500),
    })
  } catch {
    // observability must never break the pipeline
  }
}

/** Queue a per-call row write (fire-and-forget; flush in tests). */
export function recordAiCallRow(input: AiCallRowInput): void {
  const pending = writeAiCallRow(input)
  pendingRecordWrites.push(pending)
  if (pendingRecordWrites.length > 500) pendingRecordWrites.shift()
  void pending.catch(() => {})
}

/**
 * Install the Flue `instrument()` subscriber that turns the runtime event
 * stream into per-model-call `ai.call` events. Registered once at agent-layer
 * boot. Returns the unsubscribe function.
 */
export async function installAiCallTelemetry(): Promise<() => void> {
  const { instrument } = await import('@flue/runtime')
  const turnStarted = new Map<string, number>()
  const turnInputs = new Map<string, { messages?: unknown, tools?: Array<{ name: string }> }>()

  const uninstall = await instrument({
    observe: (event) => {
      if (event.type === 'turn_start') {
        turnStarted.set(event.turnId, Date.now())
        return
      }
      if (event.type === 'turn_request') {
        // The full final request payload, in-process only (PRD §5.4).
        turnInputs.set(event.turnId, {
          messages: event.request?.input?.messages,
          tools: event.request?.input?.tools?.map((tool: { name?: string }) => ({ name: tool.name ?? '' })),
        })
        return
      }
      if (event.type !== 'turn') return
      const startedAt = turnStarted.get(event.turnId) ?? Date.now()
      turnStarted.delete(event.turnId)
      const input = turnInputs.get(event.turnId)
      turnInputs.delete(event.turnId)
      const request = event.request
      const response = event.response
      const output = response.output
      const outputBlocks = (output?.content ?? []) as Array<{ type?: string, text?: string }>
      const outputText = outputBlocks
        .filter(block => block.type === 'text')
        .map(block => block.text ?? '')
        .join('\n')
      const context = aiCallContext()
      const error = event.isError ? response.error?.message ?? 'model call failed' : undefined
      const usage = response.usage
        ? {
            promptTokens: response.usage.input,
            completionTokens: response.usage.output,
            cachedTokens: response.usage.cacheRead,
          }
        : undefined
      emitAiCall({
        callId: event.turnId,
        submissionId: event.submissionId,
        runId: context?.runId,
        capability: context?.capability,
        agent: event.agentName ?? context?.agent,
        purpose: event.purpose ?? context?.purpose,
        provider: request.providerId,
        model: request.requestedModel,
        latencyMs: event.durationMs ?? (Date.now() - startedAt),
        finishReason: response.finishReason,
        error,
        usage,
        input,
        output: outputText !== '' ? outputText : output,
        toolNames: input?.tools?.map(tool => tool.name) ?? [],
      })
      recordAiCallRow({
        userId: context?.userId,
        businessId: context?.businessId,
        capability: context?.capability,
        provider: request.providerId,
        model: request.requestedModel,
        latencyMs: event.durationMs ?? (Date.now() - startedAt),
        tokensUsed: (usage?.promptTokens ?? 0) + (usage?.completionTokens ?? 0),
        error,
      })
    },
    interceptor: async (operation, _ctx, next) => {
      if (operation.type === 'model') turnStarted.set(operation.turnId, Date.now())
      return next()
    },
    dispose: () => {
      turnStarted.clear()
      turnInputs.clear()
    },
  })
  return () => {
    void uninstall()
  }
}

const TELEMETRY_KEY = '__magicsync_ai_telemetry__'

/**
 * Idempotent boot registration (HMR-safe via globalThis). Called once from
 * the agent-layer Nitro plugin; safe to call from every entry instead.
 */
export async function ensureAiCallTelemetry(): Promise<void> {
  const globalScope = globalThis as Record<string, unknown>
  if (globalScope[TELEMETRY_KEY]) return
  globalScope[TELEMETRY_KEY] = true
  try {
    const uninstall = await installAiCallTelemetry()
    globalScope[TELEMETRY_KEY] = uninstall
  } catch {
    globalScope[TELEMETRY_KEY] = undefined
  }
}

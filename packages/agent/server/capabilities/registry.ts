import { z } from 'zod'
import type { H3Event } from 'h3'
import type { RequestLogger } from 'evlog'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import type { AgentComplete } from '../agent/tool-context'

/**
 * The capability registry (PRD-FLUE-AGENT-MIGRATION §4.4): one entry, one
 * registry, one dispatch table. Every AI capability is declared exactly once
 * here; HTTP routes, chat, MCP tools, jobs and pipeline nodes all call
 * `runCapability` — none of them write prompts, pick skills, or call models.
 */

export const CapabilityStreamSchema = z.enum(['none', 'sse'])
export type CapabilityStream = z.infer<typeof CapabilityStreamSchema>

export const CapabilityRenderSchema = z.enum([
  'text',
  'research',
  'ideas',
  'plan',
  'carousel',
  'draft',
  'board',
  'delivery',
])
export type CapabilityRender = z.infer<typeof CapabilityRenderSchema>

/** Step descriptor driving the chat step rail (T23) and progress events. */
export interface CapabilityStepDescriptor {
  id: string
  label: string
}

/**
 * A capability = the smallest unit of AI work the product can ask for.
 * `agent` owns behavior; input/output zod schemas are validated at the
 * boundaries (entry + return); `consequential` gates execution on approval (T12).
 */
export interface Capability<In = unknown, Out = unknown> {
  /** Dot-namespaced id, e.g. 'goal.execute', 'content.ideas'. */
  id: string
  /** Human title used in progress UI and the chat RunCard header. */
  title: string
  /** One-line plain-language description (never exposes internal vocabulary). */
  description: string
  agent: (input: unknown, ctx: CapabilityRunContext) => Promise<ServiceResponse<Out>>
  inputSchema: z.ZodType<In>
  outputSchema: z.ZodType<Out>
  steps?: CapabilityStepDescriptor[]
  consequential?: boolean
  stream: CapabilityStream
  render?: CapabilityRender
}

/**
 * Runtime context resolved server-side and injected into every capability.
 * Tenant identity never comes from the model (PRD §4.1).
 */
export interface CapabilityRunContext {
  userId: string
  businessId: string
  /** Completion bound to the caller's effective model (run-config). */
  complete: AgentComplete
  /** Business-grounded context (Brand Playbook) assembled for this run. */
  systemContext: string
  event?: H3Event
  log?: RequestLogger
  /** Progress listener for streaming runs (SSE adapter feeds this). */
  onEvent?: (event: { type: string, [key: string]: unknown }) => void
  /** Approval grant for consequential capabilities (T12); absent = unapproved. */
  approval?: { goalRunId: string, stepId: string }
}

class CapabilityRegistry {
  private capabilities = new Map<string, Capability>()

  register(capability: Capability): void {
    if (this.capabilities.has(capability.id)) {
      throw new Error(`Capability already registered: ${capability.id}`)
    }
    this.capabilities.set(capability.id, capability)
  }

  get(id: string): Capability | undefined {
    return this.capabilities.get(id)
  }

  has(id: string): boolean {
    return this.capabilities.has(id)
  }

  list(): Capability[] {
    return [...this.capabilities.values()]
  }
}

export const capabilityRegistry = new CapabilityRegistry()

export type CapabilityOutcome<Out> =
  | { ok: true, output: Out }
  | { ok: false, error: string, code?: string }

/**
 * Validate input, then enforce the T12 approval gate for consequential
 * capabilities before any agent runs. Separated so `runCapability` keeps
 * its complexity budget while every entry funnels through one gate.
 */
async function enterCapability<In>(
  capability: Capability<In, unknown>,
  capabilityId: string,
  rawInput: unknown,
  ctx: CapabilityRunContext,
): Promise<{ ok: true, input: In } | { ok: false, outcome: CapabilityOutcome<never> }> {
  const parsed = capability.inputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      ok: false,
      outcome: {
        ok: false,
        error: `Invalid input for ${capabilityId}: ${parsed.error.issues[0]?.message ?? ''}`,
        code: 'VALIDATION_ERROR',
      },
    }
  }
  if (capability.consequential === true) {
    const { checkCapabilityApproval, emitApprovalRequired } = await import('../flue/approvals')
    const granted = await checkCapabilityApproval(ctx, capability.id)
    if (!granted) {
      await emitApprovalRequired(ctx, capability.id)
      return {
        ok: false,
        outcome: {
          ok: false,
          error: `Capability ${capabilityId} requires explicit approval before it can run`,
          code: 'APPROVAL_REQUIRED',
        },
      }
    }
  }
  return { ok: true, input: parsed.data }
}

/**
 * Capabilities are normally registered by the import side effect of
 * `./index`. That side effect is not dependable: Nitro code-splits each route
 * into its own chunk, so a route that imports `runCapability` from this file
 * directly can end up with its OWN copy of `capabilityRegistry` while
 * `index.ts` (and the `import './content'` that registers `content.scan`) was
 * evaluated in a different chunk. The registry then stays empty and the route
 * fails with `422 Unknown capability: <id>` (CAPABILITY_UNKNOWN).
 *
 * `resolveCapability` closes that gap: on a miss it pulls the aggregator into
 * THIS module graph once and retries. The dynamic import also avoids a static
 * cycle, since `index.ts` re-exports from this file.
 */
let registrationEnsured = false

async function ensureRegistered(): Promise<void> {
  if (registrationEnsured) return
  registrationEnsured = true
  try {
    await import('./index')
  } catch {
    // Leave `registrationEnsured` true: a failed load must not retry per call.
  }
}

async function resolveCapability<In, Out>(capabilityId: string): Promise<Capability<In, Out> | undefined> {
  const found = capabilityRegistry.get(capabilityId) as Capability<In, Out> | undefined
  if (found) return found
  await ensureRegistered()
  return capabilityRegistry.get(capabilityId) as Capability<In, Out> | undefined
}

/**
 * THE single entry point. Parse → authorize (caller already did auth; tenant
 * ids are injected) → approval gate (consequential only) → run the
 * capability agent → validate output → return. A route/job/MCP tool is an
 * adapter around this call; nothing else.
 */
export async function runCapability<In, Out>(
  capabilityId: string,
  rawInput: unknown,
  ctx: CapabilityRunContext,
): Promise<CapabilityOutcome<Out>> {
  const capability = await resolveCapability<In, Out>(capabilityId)
  if (!capability) {
    return { ok: false, error: `Unknown capability: ${capabilityId}`, code: 'CAPABILITY_UNKNOWN' }
  }
  const entered = await enterCapability(capability, capabilityId, rawInput, ctx)
  if (!entered.ok) return entered.outcome as CapabilityOutcome<Out>
  try {
    const result = await capability.agent(entered.input, ctx)
    if (!result.success) {
      return { ok: false, error: result.error, code: result.code }
    }
    const verified = capability.outputSchema.safeParse(result.data)
    if (!verified.success) {
      return {
        ok: false,
        error: `Capability ${capabilityId} returned invalid output`,
        code: 'CAPABILITY_OUTPUT_INVALID',
      }
    }
    return { ok: true, output: verified.data as Out }
  } catch (error) {
    // Preserve coded errors thrown by the model binding (MODEL_NOT_CONFIGURED,
    // MODEL_NOT_AVAILABLE, PROVIDER_FAILED) so adapters keep their status map.
    const code = typeof (error as { code?: unknown } | null)?.code === 'string'
      ? (error as { code: string }).code
      : 'CAPABILITY_FAILED'
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Capability failed',
      code,
    }
  }
}

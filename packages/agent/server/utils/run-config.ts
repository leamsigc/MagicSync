import type { H3Event } from 'h3'
import type { RequestLogger } from 'evlog'
import { z } from 'zod'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { businessContextResolver } from '#layers/BaseDB/server/services/business-context-resolver.service'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'
import type { ModelRuntime } from '@earendil-works/pi-coding-agent'
import type { Model } from '@earendil-works/pi-ai'
import {
  applyRunApiKey,
  applyRunBaseUrl,
  registerRuntimeModel,
  DYNAMIC_MODEL_PROVIDERS,
  createAgentComplete,
  createAgentModelRuntime,
  resolveRunModel,
  type CompleteInput,
} from './pi-runtime'

export interface RunConfig {
  runtime: ModelRuntime
  model: Model<any>
  provider: string
  modelId: string
  apiKey: string | null
  apiBaseUrl: string | null
  systemContext: string
  complete: (input: CompleteInput) => Promise<string>
}

export function runConfigErrorStatus(code?: string): number {
  return code === 'NOT_FOUND' ? 404 : 400
}

const JsonObjectSchema = z.record(z.string(), z.unknown())

interface BraceScan {
  depth: number
  start: number
  inString: boolean
  escaped: boolean
}

function stripCodeFences(raw: string): string {
  return raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? raw
}

function repairTrailingCommas(json: string): string {
  return json.replace(/,\s*([}\]])/g, '$1')
}

function advanceString(scan: BraceScan, ch: string): void {
  if (scan.escaped) scan.escaped = false
  else if (ch === '\\') scan.escaped = true
  else if (ch === '"') scan.inString = false
}

function openBrace(scan: BraceScan, index: number): void {
  if (scan.depth === 0) scan.start = index
  scan.depth += 1
}

function closeBrace(scan: BraceScan, index: number, text: string, out: string[]): void {
  if (scan.depth === 0) return
  scan.depth -= 1
  if (scan.depth > 0 || scan.start < 0) return
  out.push(text.slice(scan.start, index + 1))
}

function nextScanChar(scan: BraceScan, ch: string, index: number, text: string, out: string[]): void {
  if (scan.inString) {
    advanceString(scan, ch)
    return
  }
  if (ch === '"') scan.inString = true
  else if (ch === '{') openBrace(scan, index)
  else if (ch === '}') closeBrace(scan, index, text, out)
}

/** Balanced `{...}` candidates, longest first — prose braces never match. */
function balancedCandidates(text: string): string[] {
  const scan: BraceScan = { depth: 0, start: -1, inString: false, escaped: false }
  const out: string[] = []
  for (let index = 0; index < text.length; index++) {
    nextScanChar(scan, text[index]!, index, text, out)
  }
  return out.sort((a, b) => b.length - a.length)
}

function tryParseObject(candidate: string): Record<string, unknown> | null {
  for (const text of [candidate, repairTrailingCommas(candidate)]) {
    try {
      const parsed = JsonObjectSchema.safeParse(JSON.parse(text))
      if (parsed.success) return parsed.data
    }
    catch {
      // Try the repaired variant next, then the next candidate.
    }
  }
  return null
}

/**
 * Lenient JSON-object extraction for small-model output: strips markdown
 * fences, skips prose braces via balanced-brace scan, and tolerates trailing
 * commas. Returns null only when no usable object exists.
 */
export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const text = stripCodeFences(raw)
  for (const candidate of balancedCandidates(text)) {
    const parsed = tryParseObject(candidate)
    if (parsed) return parsed
  }
  return null
}

/**
 * One resolution path for provider/model/key + current Brand Playbook context.
 * Context failure is loud (PRD failure semantics).
 */
export async function buildAgentRunConfig(
  userId: string,
  businessId: string,
  event: H3Event,
  log?: RequestLogger,
): Promise<ServiceResponse<RunConfig>> {
  const context = await businessContextResolver.resolve(userId, {
    businessId,
    useBusinessContext: true,
    includePersonalKnowledge: false,
  }, event)
  if (!context.success) return { success: false, error: context.error, code: context.code }

  const llm = await userLlmConfigService.getEffectiveConfig(userId, businessId)
  const provider = llm.data?.provider ?? process.env.AGENT_DEFAULT_PROVIDER
  const modelId = llm.data?.model ?? process.env.AGENT_DEFAULT_MODEL
  if (!provider || !modelId) {
    return { success: false, error: 'No model configured for this business', code: 'MODEL_NOT_CONFIGURED' }
  }

  const runtime = await createAgentModelRuntime()
  if (llm.data?.apiBaseUrl) applyRunBaseUrl(runtime, provider, llm.data.apiBaseUrl)
  if (llm.data?.apiKey) await applyRunApiKey(runtime, provider, llm.data.apiKey)
  let model = resolveRunModel(runtime, provider, modelId)
  if (!model && DYNAMIC_MODEL_PROVIDERS.has(provider)) {
    registerRuntimeModel(runtime, provider, modelId)
    model = resolveRunModel(runtime, provider, modelId)
  }
  if (!model) {
    return { success: false, error: `Model ${provider}/${modelId} is not available`, code: 'MODEL_NOT_AVAILABLE' }
  }

  return {
    success: true,
    data: {
      runtime,
      model,
      provider,
      modelId,
      apiKey: llm.data?.apiKey ?? null,
      apiBaseUrl: llm.data?.apiBaseUrl ?? null,
      systemContext: context.data.prompt,
      complete: createAgentComplete(runtime, model, {
        log,
        callName: 'agent.run-config.complete',
        metadata: { userId, businessId, provider, model: modelId },
      }),
    },
  }
}

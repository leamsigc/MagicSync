import type { H3Event } from 'h3'
import { z } from 'zod'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { businessContextResolver } from '#layers/BaseDB/server/services/business-context-resolver.service'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'
import type { ModelRuntime } from '@earendil-works/pi-coding-agent'
import type { Model } from '@earendil-works/pi-ai'
import {
  applyRunApiKey,
  applyRunBaseUrl,
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

export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const parsed = JsonObjectSchema.safeParse(JSON.parse(raw.slice(start, end + 1)))
    return parsed.success ? parsed.data : null
  }
  catch {
    return null
  }
}

export interface UserCompletionInput {
  system?: string
  prompt: string
  businessId?: string | null
  useBusinessContext?: boolean
  event?: H3Event
  maxTokens?: number
}

/** One-shot completion for feature endpoints (social, tools) on the effective model. */
export async function completeForUser(
  userId: string,
  input: UserCompletionInput,
): Promise<ServiceResponse<{ text: string, json: Record<string, unknown> | null }>> {
  const llm = await userLlmConfigService.getEffectiveConfig(userId, input.businessId ?? null)

  let brandPrompt = ''
  if (input.useBusinessContext) {
    const context = await businessContextResolver.resolve(userId, {
      businessId: input.businessId ?? null,
      useBusinessContext: true,
    }, input.event)
    if (!context.success) return { success: false, error: context.error, code: context.code }
    brandPrompt = context.data.prompt
  }

  const provider = llm.data?.provider ?? process.env.AGENT_DEFAULT_PROVIDER
  const modelId = llm.data?.model ?? process.env.AGENT_DEFAULT_MODEL
  if (!provider || !modelId) {
    return { success: false, error: 'No model configured for this user', code: 'MODEL_NOT_CONFIGURED' }
  }

  const runtime = await createAgentModelRuntime()
  if (llm.data?.apiBaseUrl) applyRunBaseUrl(runtime, provider, llm.data.apiBaseUrl)
  if (llm.data?.apiKey) await applyRunApiKey(runtime, provider, llm.data.apiKey)
  const model = resolveRunModel(runtime, provider, modelId)
  if (!model) {
    return { success: false, error: `Model ${provider}/${modelId} is not available`, code: 'MODEL_NOT_AVAILABLE' }
  }

  try {
    const text = await createAgentComplete(runtime, model)({
      system: [input.system, brandPrompt].filter(Boolean).join('\n\n'),
      prompt: input.prompt,
      maxTokens: input.maxTokens ?? 1600,
    })
    return { success: true, data: { text, json: extractJsonObject(text) } }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Generation failed', code: 'PROVIDER_FAILED' }
  }
}

/**
 * One resolution path for provider/model/key + current Brand Playbook context.
 * Context failure is loud (PRD failure semantics).
 */
export async function buildAgentRunConfig(
  userId: string,
  businessId: string,
  event: H3Event,
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
  const model = resolveRunModel(runtime, provider, modelId)
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
      complete: createAgentComplete(runtime, model),
    },
  }
}

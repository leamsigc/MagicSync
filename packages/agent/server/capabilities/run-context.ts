import type { H3Event } from 'h3'
import type { RequestLogger } from 'evlog'
import type { CapabilityRunContext } from './registry'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'
import { businessContextResolver } from '#layers/BaseDB/server/services/business-context-resolver.service'
import { applyRunApiKey, applyRunBaseUrl, createAgentComplete, createAgentModelRuntime, registerRuntimeModel, resolveRunModel, DYNAMIC_MODEL_PROVIDERS } from '../utils/pi-runtime'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'

/**
 * T20: assemble the capability run context — the tenant identity + effective
 * model binding for one capability run. Brand-context failures are loud
 * (coded throw): a branded operation never runs ungrounded by accident.
 */
export async function buildCapabilityRunContext(
  userId: string,
  businessId: string | null | undefined,
  options: {
    useBusinessContext?: boolean
    event?: H3Event
    log?: RequestLogger
    capability?: string
  } = {},
): Promise<CapabilityRunContext> {
  const llm = await userLlmConfigService.getEffectiveConfig(userId, businessId ?? null)

  let systemContext = ''
  if (options.useBusinessContext) {
    const context = await businessContextResolver.resolve(userId, {
      businessId: businessId ?? null,
      useBusinessContext: true,
    }, options.event)
    if (!context.success) {
      throw Object.assign(new Error(context.error), { code: context.code ?? 'CONTEXT_FAILED' })
    }
    systemContext = context.data.prompt
  }

  const provider = llm.data?.provider ?? process.env.AGENT_DEFAULT_PROVIDER
  const modelId = llm.data?.model ?? process.env.AGENT_DEFAULT_MODEL

  const complete = async (input: { system?: string, prompt: string, maxTokens?: number }) => {
    if (!provider || !modelId) {
      throw Object.assign(new Error('No model configured for this user'), { code: 'MODEL_NOT_CONFIGURED' })
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
      throw Object.assign(new Error(`Model ${provider}/${modelId} is not available`), { code: 'MODEL_NOT_AVAILABLE' })
    }
    return createAgentComplete(runtime, model, {
      log: options.log,
      callName: options.capability ?? 'capability.run',
      metadata: { userId, businessId: businessId ?? null, provider, model: modelId },
    })({
      system: [input.system, systemContext].filter(Boolean).join('\n\n'),
      prompt: input.prompt,
      maxTokens: input.maxTokens,
    })
  }

  return {
    userId,
    businessId: businessId ?? '',
    complete,
    systemContext,
    event: options.event,
    log: options.log,
  }
}

export type { ServiceResponse }

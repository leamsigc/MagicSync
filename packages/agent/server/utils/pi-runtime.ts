import { fileURLToPath } from 'node:url'
import { ModelRuntime, type CreateModelRuntimeOptions } from '@earendil-works/pi-coding-agent'
import { InMemoryCredentialStore, InMemoryModelsStore, type Model } from '@earendil-works/pi-ai'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'

export interface AgentModelRuntimeOptions {
  /** Server-owned models.json path. Defaults to AGENT_MODELS_PATH, then the deployment template. */
  modelsPath?: string
  /** Opt in to remote catalog refresh. Off unless explicitly enabled. */
  allowCatalogNetwork?: boolean
  /** Remaining ModelRuntime.create() options (signal, ...). Credentials and models stay in memory. */
  createOptions?: Omit<CreateModelRuntimeOptions, 'modelsPath' | 'allowModelNetwork' | 'credentials' | 'modelsStore'>
}

/** Deployment models.json template, overridable per deploy via AGENT_MODELS_PATH. */
export function resolveDeploymentModelsPath(): string {
  return process.env.AGENT_MODELS_PATH ?? fileURLToPath(new URL('../agent/models.json', import.meta.url))
}

/**
 * Build the pi model runtime. Credentials and model catalogs live in memory:
 * per-business API keys are injected per run and never persisted, and pi never
 * reads or writes a tenant/global home directory.
 */
export async function createAgentModelRuntime(options: AgentModelRuntimeOptions = {}): Promise<ModelRuntime> {
  const modelsPath = options.modelsPath ?? resolveDeploymentModelsPath()
  return ModelRuntime.create({
    ...options.createOptions,
    credentials: new InMemoryCredentialStore(),
    modelsStore: new InMemoryModelsStore(),
    modelsPath,
    allowModelNetwork: options.allowCatalogNetwork ?? false,
  })
}

/** Inject the per-business API key at run start. Never persisted (runtime override). */
export async function applyRunApiKey(runtime: ModelRuntime, providerId: string, apiKey: string): Promise<void> {
  await runtime.setRuntimeApiKey(providerId, apiKey)
}

/** Point a provider at the per-business base URL (Ollama/proxy/custom gateway). */
export function applyRunBaseUrl(runtime: ModelRuntime, providerId: string, baseUrl: string): void {
  runtime.registerProvider(providerId, { baseUrl })
}

/** Resolve the per-business provider/model pair, including custom model names. */
export function resolveRunModel(runtime: ModelRuntime, providerId: string, modelId: string): Model<any> | undefined {
  return runtime.getModel(providerId, modelId)
}

export interface RuntimeProviderInfo {
  id: string
  name: string
  models: string[]
  configured: boolean
}

/** Provider/model discovery for the LLM settings UI (no network when PI_OFFLINE). */
export async function describeRuntimeProviders(runtime: ModelRuntime): Promise<RuntimeProviderInfo[]> {
  const providers: RuntimeProviderInfo[] = []
  for (const provider of runtime.getProviders()) {
    const auth = await runtime.checkAuth(provider.id)
    providers.push({
      id: provider.id,
      name: provider.name,
      models: runtime.getModels(provider.id).map(model => model.id),
      configured: auth?.configured === true,
    })
  }
  return providers
}

export interface TestConnectionInput {
  provider: string
  model: string
  apiKey?: string | null
  apiBaseUrl?: string | null
}

/** Live connection test against the resolved model (used by /api/v1/llm/test). */
export async function testModelConnection(
  runtime: ModelRuntime,
  input: TestConnectionInput,
): Promise<ServiceResponse<{ latencyMs: number }>> {
  if (input.apiBaseUrl) applyRunBaseUrl(runtime, input.provider, input.apiBaseUrl)
  if (input.apiKey) await applyRunApiKey(runtime, input.provider, input.apiKey)
  const model = resolveRunModel(runtime, input.provider, input.model)
  if (!model) {
    return { success: false, error: `Model ${input.provider}/${input.model} is not available`, code: 'MODEL_NOT_AVAILABLE' }
  }
  const startedAt = Date.now()
  try {
    await runtime.completeSimple(model, { messages: [{ role: 'user', content: 'ping' }] }, { maxTokens: 8 })
    return { success: true, data: { latencyMs: Date.now() - startedAt } }
  }
  catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Provider test failed', code: 'PROVIDER_AUTH_FAILED' }
  }
}

export interface CompleteInput {
  system?: string
  prompt: string
  maxTokens?: number
}

/** Bind a plain-text completion to a resolved model for tool-internal calls. */
export function createAgentComplete(runtime: ModelRuntime, model: Model<any>) {
  return async (input: CompleteInput): Promise<string> => {
    const message = await runtime.completeSimple(model, {
      ...(input.system ? { systemPrompt: input.system } : {}),
      messages: [{ role: 'user', content: input.prompt }],
    }, input.maxTokens ? { maxTokens: input.maxTokens } : undefined)
    const parts: string[] = []
    for (const block of message.content) {
      if (block.type === 'text') parts.push(block.text)
    }
    return parts.join('\n').trim()
  }
}

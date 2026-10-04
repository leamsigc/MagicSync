import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ModelRuntime, type CreateModelRuntimeOptions } from '@earendil-works/pi-coding-agent'
import { InMemoryCredentialStore, InMemoryModelsStore, type Model } from '@earendil-works/pi-ai'
import type { RequestLogger } from 'evlog'
import { emitLog } from '#layers/BaseShared/server/utils/evlog'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import deploymentModelsRaw from '../agent/models.json?raw'

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

const MATERIALIZED_MODELS_NAME = 'magicsync-agent-models.json'

/**
 * Write the build-time bundled models.json template to the OS temp dir
 * (rewritten only when stale) and return its path. Used when the source
 * file is unreachable at runtime.
 */
export function materializeDeploymentModelsPath(): string {
  const path = join(tmpdir(), MATERIALIZED_MODELS_NAME)
  const current = existsSync(path) ? readFileSync(path, 'utf8') : null
  if (current !== deploymentModelsRaw) writeFileSync(path, deploymentModelsRaw)
  return path
}

/**
 * Effective models.json path for ModelRuntime.create(). Nitro bundles server
 * code, so `import.meta.url` points into `.nuxt/dev` (or `.output/server` in
 * production) where the relative template no longer exists — pi then loads an
 * empty catalog and every deployment provider (llama, ollama, ...) resolves
 * to MODEL_NOT_AVAILABLE. The template is also imported via `?raw` (same
 * mechanism as server/agent prompts/skills), so fall back to a materialized
 * copy of the bundled contents when the source file is missing.
 */
export function resolveEffectiveModelsPath(): string {
  if (process.env.AGENT_MODELS_PATH) return process.env.AGENT_MODELS_PATH
  const sourcePath = fileURLToPath(new URL('../agent/models.json', import.meta.url))
  if (existsSync(sourcePath)) return sourcePath
  return materializeDeploymentModelsPath()
}

/**
 * Build the pi model runtime. Credentials and model catalogs live in memory:
 * per-business API keys are injected per run and never persisted, and pi never
 * reads or writes a tenant/global home directory.
 */
export async function createAgentModelRuntime(options: AgentModelRuntimeOptions = {}): Promise<ModelRuntime> {
  const modelsPath = options.modelsPath ?? resolveEffectiveModelsPath()
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

const CUSTOM_MODEL_DEFAULTS = {
  reasoning: false,
  input: ['text'] as ('text' | 'image')[],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 32768,
  maxTokens: 8192,
}

/** Base URL fallback per provider from the bundled deployment template. */
function deploymentBaseUrl(providerId: string): string | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(deploymentModelsRaw)
  } catch {
    return undefined
  }
  if (!parsed || typeof parsed !== 'object') return undefined
  const providers = (parsed as { providers?: Record<string, { baseUrl?: string }> }).providers
  return providers?.[providerId]?.baseUrl
}

/**
 * Register an ad-hoc model for a local OpenAI-compatible provider (llama.cpp /
 * Ollama servers expose arbitrary model ids via /v1/models that aren't in
 * models.json). Merges over the previous registration, keeping its baseUrl.
 * `api`/`baseUrl` ride along explicitly because pi validates each
 * registration on its own — without a models.json entry to inherit them from
 * the registration throws and dynamic providers can never resolve.
 * Returns false when the model could not be registered.
 */
export function registerRuntimeModel(runtime: ModelRuntime, providerId: string, modelId: string): boolean {
  if (runtime.getModel(providerId, modelId)) return true
  try {
    const baseUrl = runtime.getProvider(providerId)?.baseUrl ?? deploymentBaseUrl(providerId)
    runtime.registerProvider(providerId, {
      ...(baseUrl ? { baseUrl } : {}),
      models: [{
        id: modelId,
        name: modelId,
        api: 'openai-completions',
        reasoning: CUSTOM_MODEL_DEFAULTS.reasoning,
        input: CUSTOM_MODEL_DEFAULTS.input,
        cost: CUSTOM_MODEL_DEFAULTS.cost,
        contextWindow: CUSTOM_MODEL_DEFAULTS.contextWindow,
        maxTokens: CUSTOM_MODEL_DEFAULTS.maxTokens,
      }],
    })
    return runtime.getModel(providerId, modelId) !== undefined
  }
  catch {
    return false
  }
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

/** Providers whose servers expose arbitrary model ids (e.g. llama.cpp /v1/models). */
export const DYNAMIC_MODEL_PROVIDERS = new Set(['llama', 'ollama'])

/**
 * Fetch live model ids from a local server's OpenAI-compatible /models endpoint
 * (llama.cpp, Ollama). Returns [] on any failure — never throws.
 */
export async function fetchServerModelIds(baseUrl: string, apiKey?: string | null, timeoutMs = 4000): Promise<string[]> {
  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/models`
    const headers: Record<string, string> = {}
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return []
    const body = await res.json() as { data?: Array<Record<string, unknown>>, models?: Array<Record<string, unknown>> }
    const raw = body.data ?? body.models ?? []
    const ids = raw
      .map(m => typeof m === 'object' && m !== null ? (m.id ?? m.model) : undefined)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
    return [...new Set(ids)]
  }
  catch {
    return []
  }
}

/** Live connection test against the resolved model (used by /api/v1/llm/test). */
export async function testModelConnection(
  runtime: ModelRuntime,
  input: TestConnectionInput,
): Promise<ServiceResponse<{ latencyMs: number }>> {
  if (input.apiBaseUrl) applyRunBaseUrl(runtime, input.provider, input.apiBaseUrl)
  if (input.apiKey) await applyRunApiKey(runtime, input.provider, input.apiKey)
  let model = resolveRunModel(runtime, input.provider, input.model)
  if (!model && DYNAMIC_MODEL_PROVIDERS.has(input.provider) && input.apiBaseUrl) {
    // Local servers list their real model ids at /models. If the user-entered id
    // matches one (exact, or base name without a :quant suffix), use THAT id —
    // the request then always matches what the server serves.
    const serverIds = await fetchServerModelIds(input.apiBaseUrl, input.apiKey)
    const wanted = input.model.toLowerCase()
    const match = serverIds.find(id => id === input.model)
      ?? serverIds.find(id => id.toLowerCase() === wanted)
      ?? serverIds.find(id => id.toLowerCase().split(':')[0] === wanted.split(':')[0])
    if (match) {
      registerRuntimeModel(runtime, input.provider, match)
      model = resolveRunModel(runtime, input.provider, match)
    }
  }
  if (!model && DYNAMIC_MODEL_PROVIDERS.has(input.provider)) {
    registerRuntimeModel(runtime, input.provider, input.model)
    model = resolveRunModel(runtime, input.provider, input.model)
  }
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

export interface AgentCompleteOptions {
  log?: RequestLogger
  callName?: string
  metadata?: Record<string, unknown>
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

/** Bind a plain-text completion to a resolved model for tool-internal calls. */
export function createAgentComplete(
  runtime: ModelRuntime,
  model: Model<any>,
  options: AgentCompleteOptions = {},
) {
  return async (input: CompleteInput): Promise<string> => {
    const callName = options.callName ?? 'agent.complete'
    const startedAt = Date.now()
    emitLog(options.log, {
      message: 'ai.call.started',
      callName,
      input: { system: logPreview(input.system ?? ''), prompt: logPreview(input.prompt), maxTokens: input.maxTokens },
      ...options.metadata,
    })
    try {
      const message = await runtime.completeSimple(model, {
        ...(input.system ? { systemPrompt: input.system } : {}),
        messages: [{ role: 'user', content: input.prompt }],
      }, input.maxTokens ? { maxTokens: input.maxTokens } : undefined)
      const parts: string[] = []
      for (const block of message.content) {
        if (block.type === 'text') parts.push(block.text)
      }
      const output = parts.join('\n').trim()
      emitLog(options.log, {
        message: 'ai.call.completed',
        callName,
        output: logPreview(output),
        durationMs: Date.now() - startedAt,
        ...options.metadata,
      })
      return output
    }
    catch (error) {
      emitLog(options.log, {
        message: 'ai.call.failed',
        callName,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
        ...options.metadata,
      })
      throw error
    }
  }
}

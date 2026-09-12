import { fileURLToPath } from 'node:url'
import { ModelRuntime, type CreateModelRuntimeOptions } from '@earendil-works/pi-coding-agent'
import { InMemoryCredentialStore, InMemoryModelsStore, type Model } from '@earendil-works/pi-ai'

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

/** Resolve the per-business provider/model pair, including custom model names. */
export function resolveRunModel(runtime: ModelRuntime, providerId: string, modelId: string): Model | undefined {
  return runtime.getModel(providerId, modelId)
}

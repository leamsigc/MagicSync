import { createHash } from 'node:crypto'
import {
  createProvider,
  type AuthResult,
  type Model,
  type ModelCost,
  type OpenAICompletionsCompat,
  type Provider,
} from '@earendil-works/pi-ai'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import { setProvider, type Agent, type ToolDefinition } from '@flue/runtime'
import deploymentModelsRaw from '../agent/models.json?raw'

/**
 * Flue runtime boot for the MagicSync agent layer (PRD-FLUE-AGENT-MIGRATION T04).
 *
 * Flue (`@flue/runtime/node`) is embedded in the Nitro server process with
 * `start()`: agent functions are registered once, provider credentials are
 * injected per run, and the built-in in-memory SQLite persistence keeps
 * conversations for the process lifetime (the durable cross-restart adapter
 * lands with the Flue persistence work in T06+).
 *
 * Boot is guarded by a module-scoped singleton so dev HMR never double-boots
 * the runtime (PRD §5.2 / risk table).
 */

/**
 * Per-business providers (PRD-FLUE-RUNTIME-CONVERGENCE T26, decision D1).
 *
 * Flue's model layer is pi-ai's `Provider` protocol, unwrapped: the runtime
 * holds ONE module-scoped `Models` registry, `setProvider()` upserts into it
 * keyed by `provider.id`, and each `useModel('id/model')` resolves against it
 * per model call. Two consequences drive everything below:
 *
 * 1. **Credentials live in a closure.** `auth.apiKey.resolve()` returns the
 *    business's key (`{ auth: { apiKey }, source }` — an `AuthResult`, NOT
 *    `{ type: 'api_key', key }`), so no credential is written to disk or to a
 *    shared store.
 * 2. **The registry key is the isolation boundary.** `setProvider()` REPLACES
 *    the entry for one id. Registering every business under its shared
 *    provider id (`deepseek`) would make the last registration win for all of
 *    them — the exact cross-tenant race the T26 STOP gate guards. So a
 *    business's provider is registered under a **business-scoped id**
 *    (`ms-<digest>`): its entry is private, and re-registering it can only ever
 *    replace its own credentials. Platform defaults (no business) keep their
 *    plain provider id, matching `AGENT_DEFAULT_PROVIDER`.
 */

export interface FlueStartOptions {
  /** Agent functions this runtime serves. */
  agents: Agent[]
  /**
   * Provider objects for the boot registration — `buildBusinessProvider(...).provider`,
   * or a hermetic stub provider. Omitted keeps Flue's built-in providers; an
   * empty array registers none, leaving the registry to `setProvider()` calls.
   *
   * Deliberately loose: the T08 slice runners pass `unknown`
   * (`server/flue/slice-a.ts`, `slice-b.ts`); T29 types those to `FlueProvider`.
   */
  providers?: readonly unknown[]
  /** Agent function identity override (anonymous/inline test agents). */
  named?: Array<{ agent: Agent, name: string }>
}

export interface FlueRuntime {
  stop: () => Promise<void>
}

interface RuntimeModule {
  start: (options: {
    agents: ReadonlyArray<Agent | { agent: Agent, name?: string }>
    providers?: readonly Provider[]
  }) => Promise<FlueRuntime>
}

let runtimePromise: Promise<FlueRuntime> | null = null
let runtimeOptionsKey = ''

function optionsKey(options: FlueStartOptions): string {
  const names = options.named?.map(entry => entry.name) ?? options.agents.map(agent => (agent as { agentName?: string }).agentName ?? agent.name)
  const providers = options.providers ? options.providers.length : 'builtin'
  return `${names.sort().join(',')}|${providers}`
}

async function doStart(options: FlueStartOptions): Promise<FlueRuntime> {
  const imported: unknown = await import('@flue/runtime/node')
  const mod = imported as RuntimeModule
  const agents = options.named ?? options.agents
  // `FlueStartOptions.providers` stays `unknown[]` for the T08 slice callers; the
  // boot boundary is where pi's real `Provider` contract is asserted.
  const providers = options.providers as readonly Provider[] | undefined
  return mod.start({
    agents,
    ...(providers ? { providers } : {}),
  })
}

/** Drain a runtime promise, whatever it resolved to. Never throws. */
async function stopRuntime(running: Promise<FlueRuntime> | null): Promise<void> {
  if (!running) return
  try {
    await (await running).stop()
  } catch {
    // A runtime that never finished starting has nothing to drain, and teardown
    // must never fail the request that asked for it.
  }
}

/**
 * Boot (or return the already-booted) Flue runtime. Safe to call from every
 * request: the singleton resolves once per process. HMR invalidates the
 * module and re-boots with the fresh closure — never two live runtimes.
 *
 * A changed option set (different agents or boot providers) displaces the live
 * runtime: it is drained BEFORE `start()`, because Flue refuses to boot a
 * second runtime in a process that still has one. Per-business credentials must
 * therefore never reach this function — they go through
 * `registerBusinessProvider()`, which leaves the boot options (and this key)
 * stable so tenants share one runtime.
 */
export function getFlueRuntime(options: FlueStartOptions): Promise<FlueRuntime> {
  const key = optionsKey(options)
  if (runtimePromise && key === runtimeOptionsKey) return runtimePromise
  const displaced = runtimePromise
  runtimeOptionsKey = key
  runtimePromise = (async () => {
    await stopRuntime(displaced)
    return doStart(options)
  })()
  return runtimePromise
}

/** Test seam: drop the cached runtime without stopping it (process-scoped tests). */
export function resetFlueRuntimeForTests(): void {
  runtimePromise = null
  runtimeOptionsKey = ''
}

/** Stop the booted runtime if any (test teardown for singleton users). Never throws. */
export async function stopFlueRuntime(): Promise<void> {
  const running = runtimePromise
  runtimePromise = null
  runtimeOptionsKey = ''
  await stopRuntime(running)
}

// ---------------------------------------------------------------------------
// Providers (T26) — one OpenAI-compatible provider per business, credentials
// held in the closure and isolated by a business-scoped registry key.
// ---------------------------------------------------------------------------

/** A pi provider on the OpenAI-completions wire protocol (Ollama, llama.cpp, DeepSeek, OpenRouter, custom gateways). */
export type FlueProvider = Provider<'openai-completions'>

/** One model the provider declares; undeclared ids fail Flue's model resolution. */
export interface ProviderModelDescriptor {
  id: string
  name?: string
  contextWindow?: number
  maxTokens?: number
  reasoning?: boolean
  input?: Array<'text' | 'image'>
  cost?: ModelCost
}

export interface BuildProviderInput {
  /** Registry key. Business-scoped for tenants (see `providerRegistryId`). */
  providerId: string
  /** Display name; defaults to the provider id. */
  providerName?: string
  baseUrl: string
  /** Empty/absent = keyless local server (Ollama): the resolver reports no apiKey. */
  apiKey?: string | null
  models: readonly ProviderModelDescriptor[]
  /** Wire-compatibility overrides from the deployment catalog (developer role, reasoning effort, ...). */
  compat?: OpenAICompletionsCompat
}

/**
 * Zero-cost metadata defaults for catalog entries that declare none. Mirrors
 * `CUSTOM_MODEL_DEFAULTS` in `server/utils/pi-runtime.ts` so a model resolves
 * with the same limits on the Flue path as on the pi path.
 */
const MODEL_DEFAULTS = {
  reasoning: false,
  input: ['text'] as Array<'text' | 'image'>,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 32768,
  maxTokens: 8192,
}

/**
 * `AuthResult` for one provider: `{ auth: { apiKey }, source }`. The gotcha is
 * load-bearing — returning a stored `ApiKeyCredential`
 * (`{ type: 'api_key', key }`) makes Flue read `auth.apiKey` off `undefined`.
 */
function resolveProviderAuth(apiKey: string | null | undefined, source: string): AuthResult {
  const key = apiKey?.trim() ?? ''
  if (key === '') return { auth: {}, source: 'keyless' }
  return { auth: { apiKey: key }, source }
}

function toModel(
  providerId: string,
  baseUrl: string,
  descriptor: ProviderModelDescriptor,
  compat?: OpenAICompletionsCompat,
): Model<'openai-completions'> {
  return {
    id: descriptor.id,
    name: descriptor.name ?? descriptor.id,
    api: 'openai-completions',
    provider: providerId,
    baseUrl,
    reasoning: descriptor.reasoning ?? MODEL_DEFAULTS.reasoning,
    input: descriptor.input ?? [...MODEL_DEFAULTS.input],
    cost: descriptor.cost ?? MODEL_DEFAULTS.cost,
    contextWindow: descriptor.contextWindow ?? MODEL_DEFAULTS.contextWindow,
    maxTokens: descriptor.maxTokens ?? MODEL_DEFAULTS.maxTokens,
    ...(compat ? { compat } : {}),
  }
}

/**
 * Build the pi provider object Flue registers. The API key is captured by the
 * `resolve()` closure and nowhere else — nothing is persisted, and the
 * provider object is immutable once built.
 */
export function buildOpenAiCompatProvider(input: BuildProviderInput): FlueProvider {
  const source = input.providerName ?? input.providerId
  const { providerId, baseUrl } = input
  return createProvider<'openai-completions'>({
    id: providerId,
    name: source,
    baseUrl,
    auth: {
      apiKey: {
        name: `${source} key`,
        resolve: () => Promise.resolve(resolveProviderAuth(input.apiKey, source)),
      },
    },
    models: input.models.map(model => toModel(providerId, baseUrl, model, input.compat)),
    api: openAICompletionsApi(),
  })
}

/** Deployment-catalog provider entry (`server/agent/models.json`). */
interface CatalogProviderEntry {
  name?: string
  baseUrl?: string
  /** `"$ENV_VAR"` reference or a literal key. Never persisted; resolved per run. */
  apiKey?: string
  compat?: OpenAICompletionsCompat
  models?: Array<ProviderModelDescriptor>
}

let catalogCache: Record<string, CatalogProviderEntry> | null = null

/**
 * The bundled deployment catalog, parsed once. `?raw` keeps it available under
 * the Nitro bundle, where the relative file no longer exists (the same reason
 * `server/utils/pi-runtime.ts` materializes it).
 */
function deploymentCatalog(): Record<string, CatalogProviderEntry> {
  if (catalogCache) return catalogCache
  let parsed: unknown
  try {
    parsed = JSON.parse(deploymentModelsRaw)
  }
  catch {
    return {}
  }
  const providers = (parsed as { providers?: unknown } | null)?.providers
  catalogCache = (providers && typeof providers === 'object' ? providers : {}) as Record<string, CatalogProviderEntry>
  return catalogCache
}

/**
 * One business's effective LLM config — the fields
 * `userLlmConfigService.getEffectiveConfig()` returns (`user-llm-config.service.ts`).
 */
export interface BusinessProviderConfig {
  /** Owning business; `null` is the platform default (one shared entry). */
  businessId: string | null
  /** Deployment provider id (`ollama`, `llama`, `deepseek`, `openrouter`) or a custom gateway id. */
  provider: string
  model: string
  apiKey?: string | null
  /** Per-business base URL override (proxy, gateway, LAN Ollama). */
  apiBaseUrl?: string | null
  maxTokens?: number | null
}

export interface BusinessProviderRegistration {
  /** Registry key the provider was registered under. */
  providerId: string
  provider: FlueProvider
  modelId: string
  /** `provider-id/model-id`, ready for `useModel()`. */
  modelSpecifier: string
  /** True when the config carried no API key (local/keyless server). */
  keyless: boolean
}

/** Error carrying the repo's coded-error convention for provider misconfiguration. */
export class FlueProviderConfigError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'FlueProviderConfigError'
    this.code = code
  }
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

/**
 * Registry key for one config's provider. Business-scoped ids keep each
 * business's `setProvider()` upsert inside its own registry entry, so two
 * tenants on the same provider (`deepseek`) can never observe each other's
 * key. The platform default keeps its plain id, matching
 * `AGENT_DEFAULT_PROVIDER` / `defaultModelSpecifier()`.
 */
export function providerRegistryId(config: Pick<BusinessProviderConfig, 'businessId' | 'provider'>): string {
  if (!config.businessId) return config.provider
  return `ms-${digest(config.businessId)}`
}

/** Base URL: the per-business override wins, else the deployment catalog default. */
/**
 * Resolve a catalog `apiKey`, which is an `"$ENV_VAR"` reference (`$NUXT_OPENAI_API_KEY`)
 * or a literal. This is the operator's key: the one used when a tenant has no
 * key of their own, which is exactly what "use the system AI" means.
 */
function resolveCatalogKey(entry: CatalogProviderEntry | undefined): { key: string, fromEnv: boolean } {
  const raw = entry?.apiKey?.trim() ?? ''
  if (!raw.startsWith('$')) return { key: raw, fromEnv: false }
  return { key: process.env[raw.slice(1)]?.trim() ?? '', fromEnv: true }
}

function resolveBaseUrl(config: BusinessProviderConfig, entry: CatalogProviderEntry | undefined): string {
  const override = config.apiBaseUrl?.trim() ?? ''
  const baseUrl = override !== '' ? override : (entry?.baseUrl?.trim() ?? '')
  if (baseUrl === '') {
    throw new FlueProviderConfigError(
      `No base URL configured for provider "${config.provider}" — set one in the business LLM settings`,
      'MODEL_NOT_CONFIGURED',
    )
  }
  return baseUrl
}

/** Catalog descriptors for a provider, ignoring malformed entries. */
function catalogDescriptors(entry: CatalogProviderEntry | undefined): ProviderModelDescriptor[] {
  const models = entry?.models ?? []
  return models.filter(model => typeof model.id === 'string' && model.id !== '')
}

/** Last write wins per id, but only for fields the later entry actually sets. */
function mergeDescriptors(entries: Array<ProviderModelDescriptor>): ProviderModelDescriptor[] {
  const merged = new Map<string, ProviderModelDescriptor>()
  for (const entry of entries) {
    const defined = Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined))
    merged.set(entry.id, { ...merged.get(entry.id), ...defined } as ProviderModelDescriptor)
  }
  return [...merged.values()]
}

/**
 * Models the provider declares: the deployment catalog for that provider plus
 * the business's own selection. The union matters because `llama`/`ollama`
 * servers publish arbitrary ids through `/v1/models` (the `DYNAMIC_MODEL_PROVIDERS`
 * case in `pi-runtime.ts`) and gateways like OpenRouter serve far more ids than
 * the bundled template lists.
 */
function declaredModels(config: BusinessProviderConfig, entry: CatalogProviderEntry | undefined): ProviderModelDescriptor[] {
  const effective: ProviderModelDescriptor = {
    id: config.model,
    maxTokens: config.maxTokens ?? undefined,
  }
  return mergeDescriptors([...catalogDescriptors(entry), effective])
}

/**
 * Build (but do not register) one business's provider plus the model specifier
 * for `useModel()`. Throws `FlueProviderConfigError` when no base URL resolves.
 */
export function buildBusinessProvider(config: BusinessProviderConfig): BusinessProviderRegistration {
  const entry = deploymentCatalog()[config.provider]
  const providerId = providerRegistryId(config)
  // A tenant with no key of their own must fall back to the operator's key from
  // the catalog. Without this the provider is registered keyless, the request
  // fails with "No API key for provider: ms-<digest>", and chat is dead for
  // every user on the system model. Local servers (ollama/llama) declare no key
  // and correctly stay keyless.
  const ownKey = config.apiKey?.trim() ?? ''
  const fallback = ownKey === '' ? resolveCatalogKey(entry) : { key: '', fromEnv: false }
  const apiKey = ownKey !== '' ? ownKey : fallback.key
  const provider = buildOpenAiCompatProvider({
    providerId,
    providerName: entry?.name ?? config.provider,
    baseUrl: resolveBaseUrl(config, entry),
    apiKey,
    models: declaredModels(config, entry),
    ...(entry?.compat ? { compat: entry.compat } : {}),
  })
  return {
    providerId,
    provider,
    modelId: config.model,
    modelSpecifier: `${providerId}/${config.model}`,
    // "keyless" means no real credential is in play: no tenant key and no
    // operator key sourced from the environment. A local server's literal
    // placeholder ("ollama") satisfies the transport but protects nothing, so
    // it still counts as keyless.
    keyless: apiKey === '' || (ownKey === '' && !fallback.fromEnv),
  }
}

/**
 * Register one business's provider with the Flue runtime and return the model
 * specifier its agent must declare. Safe to call per run: the registration is
 * idempotent per business, carries no credential in the registry key, and only
 * ever replaces that business's own entry.
 */
export function registerBusinessProvider(config: BusinessProviderConfig): BusinessProviderRegistration {
  const registration = buildBusinessProvider(config)
  setProvider(registration.provider)
  return registration
}

/** Extract the agent function's identity for logging/telemetry. */
export function agentIdentity(agent: Agent): string {
  return (agent as { agentName?: string }).agentName ?? agent.name ?? 'anonymous-agent'
}

export type { ToolDefinition }

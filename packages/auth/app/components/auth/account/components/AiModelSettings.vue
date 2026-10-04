<i18n src="../../../../pages/app/account/components/AiModelSettings.json"></i18n>
<script lang="ts" setup>
interface Props {
  mode: 'global' | 'override'
  businessId?: string
}

const props = withDefaults(defineProps<Props>(), { businessId: '' })
const emit = defineEmits<{ saved: [] }>()

const { t } = useI18n()
const toast = useToast()

const PROVIDERS = ['system', 'google', 'ollama', 'llama', 'openai', 'anthropic', 'openrouter', 'deepseek'] as const
type Provider = typeof PROVIDERS[number]

const MODELS: Record<Provider, string[]> = {
  system: ['system-default'],
  google: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview-customtools'],
  ollama: ['qwen3.5', 'llama3.2', 'mistral', 'phi3', 'gemma2', 'codegemma'],
  llama: ['prism-ml/Ternary-Bonsai-2-27B-gguf:Q2_0'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
  openrouter: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.1-405b-instruct', 'mistralai/mistral-large'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner']
}

const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_MAX_TOKENS = 2048
const LOCAL_DEFAULT_MAX_TOKENS = 120000

const selectedProvider = ref<Provider>('google')
const selectedModel = ref('gemini-3.5-flash')
const useCustomModel = ref(false)
const customModelName = ref('')
const apiKey = ref('')
const apiBaseUrl = ref('')
const temperature = ref(DEFAULT_TEMPERATURE)
const maxTokens = ref(DEFAULT_MAX_TOKENS)
const hasKey = ref(false)
const existingId = ref<string | null>(null)
const hasOverride = ref(false)

const isSaving = ref(false)
const isTesting = ref(false)
const isClearing = ref(false)
const testLatency = ref<number | null>(null)

// "Use the system AI" applies in BOTH modes. In override mode it persists a
// `system` sentinel for the business; in global mode there is no sentinel to
// store — the honest action is to delete the user's own row so the server
// falls back to the operator's configured provider/model/key. Hiding it here
// (it was gated to `override`) is what left /app/account with no way out.
const providerItems = computed(() => PROVIDERS.map(provider => ({ label: t(`providers.${provider}`), value: provider })))
const availableModels = computed(() => MODELS[selectedProvider.value] ?? [])
const isSystemProvider = computed(() => selectedProvider.value === 'system')
const isLocalProvider = computed(() => isLocalProviderName(selectedProvider.value))
const showCustomModelInput = computed(() => isLocalProvider.value && useCustomModel.value)
const showApiKeyField = computed(() => !isLocalProvider.value && !isSystemProvider.value)
const showBaseUrlField = computed(() => isLocalProvider.value)
const keyPlaceholder = computed(() => hasKey.value ? t('keySaved') : t('apiKeyPlaceholder'))
const baseUrlPlaceholder = computed(() => selectedProvider.value === 'llama'
  ? 'http://localhost:8888/v1'
  : selectedProvider.value === 'ollama' ? 'http://localhost:11434/v1' : t('baseUrlPlaceholder'))
const cardTitle = computed(() => props.mode === 'global' ? t('titleGlobal') : t('titleOverride'))
const cardSubtitle = computed(() => props.mode === 'global' ? t('subtitleGlobal') : t('subtitleOverride'))

function isLocalProviderName(provider: Provider) {
  return provider === 'ollama' || provider === 'llama'
}

function isPresetModel(provider: Provider, model: string) {
  return (MODELS[provider] ?? []).includes(model)
}

function getEffectiveModel() {
  if (showCustomModelInput.value) {
    return customModelName.value.trim()
  }
  return selectedModel.value
}

function syncCustomStateFromModel() {
  if (!isLocalProvider.value) {
    useCustomModel.value = false
    return
  }
  if (isPresetModel(selectedProvider.value, selectedModel.value)) {
    useCustomModel.value = false
    return
  }
  useCustomModel.value = true
  customModelName.value = selectedModel.value
}

function applyLocalDefaults() {
  if (maxTokens.value === DEFAULT_MAX_TOKENS) {
    maxTokens.value = LOCAL_DEFAULT_MAX_TOKENS
  }
}

function resetGenerationControls() {
  apiKey.value = ''
  apiBaseUrl.value = ''
  hasKey.value = false
  temperature.value = DEFAULT_TEMPERATURE
  maxTokens.value = DEFAULT_MAX_TOKENS
}

function applySystemDefaults() {
  resetGenerationControls()
}

function applyProviderDefaults(provider: Provider) {
  selectedModel.value = MODELS[provider]?.[0] ?? ''
  useCustomModel.value = false
  customModelName.value = ''
  if (provider === 'system') {
    applySystemDefaults()
    return
  }
  if (isLocalProviderName(provider)) {
    applyLocalDefaults()
  }
}

function selectSystemProvider() {
  selectedProvider.value = 'system'
  applyProviderDefaults('system')
  existingId.value = null
}

function applyLoaded(data: { provider: Provider, model: string, apiBaseUrl?: string | null, temperature?: number, maxTokens?: number, hasKey?: boolean, id?: string }) {
  selectedProvider.value = data.provider
  selectedModel.value = data.model
  apiBaseUrl.value = data.apiBaseUrl ?? ''
  temperature.value = data.temperature ?? DEFAULT_TEMPERATURE
  maxTokens.value = data.maxTokens ?? DEFAULT_MAX_TOKENS
  hasKey.value = !!data.hasKey
  existingId.value = data.id ?? null
  syncCustomStateFromModel()
}

async function loadConfig() {
  try {
    if (props.mode === 'global') {
      const data = await $fetch<{ provider: Provider, model: string, apiBaseUrl: string | null, temperature: number, maxTokens: number, hasKey: boolean, id: string }>('/api/ai-tools/llm/default')
      applyLoaded(data)
    } else {
      const data = await $fetch<{ provider: Provider, model: string, apiBaseUrl: string | null, temperature: number, maxTokens: number, hasKey: boolean } | null>(`/api/v1/llm/override?businessId=${props.businessId}`)
      hasOverride.value = !!data
      if (data) applyLoaded(data)
    }
  } catch {
    toast.add({ title: t('loadError'), color: 'error' })
  }
}

function handleProviderChange(value: unknown) {
  if (typeof value !== 'string') return
  const next = value as Provider
  selectedProvider.value = next
  applyProviderDefaults(next)
}

function handleCustomToggle(value: unknown) {
  const enabled = value === true || value === 'true'
  useCustomModel.value = enabled
  if (enabled && customModelName.value === '') {
    customModelName.value = selectedModel.value
  }
}

function isCustomModelMissing() {
  return showCustomModelInput.value && getEffectiveModel() === ''
}

async function saveGlobalConfig() {
  const payload = buildPayload()
  if (existingId.value && existingId.value !== 'default') {
    await $fetch(`/api/ai-tools/llm/${existingId.value}`, { method: 'PUT', body: payload })
    return
  }
  await $fetch('/api/ai-tools/llm', { method: 'POST', body: payload })
}

async function saveOverrideConfig() {
  await $fetch('/api/v1/llm/override', {
    method: 'POST',
    body: { ...buildPayload(), businessId: props.businessId }
  })
  hasOverride.value = true
}

async function handleSave() {
  if (isCustomModelMissing()) {
    toast.add({ title: t('customModelRequired'), color: 'error' })
    return
  }
  // Global mode has no `system` row representation — storing one handed the
  // literal string "system" to every AI route, which then threw
  // "Unsupported AI provider: system". "Use the system AI" means *no row*.
  if (props.mode === 'global' && isSystemProvider.value) {
    await handleUseSystemAi()
    return
  }
  isSaving.value = true
  try {
    if (props.mode === 'global') {
      await saveGlobalConfig()
    } else {
      await saveOverrideConfig()
    }
    if (apiKey.value) hasKey.value = true
    apiKey.value = ''
    toast.add({ title: t('saved'), color: 'success' })
    emit('saved')
    await loadConfig()
  } catch {
    toast.add({ title: t('saveError'), color: 'error' })
  } finally {
    isSaving.value = false
  }
}

function buildPayload() {
  return {
    provider: selectedProvider.value,
    model: getEffectiveModel(),
    apiKey: apiKey.value || null,
    apiBaseUrl: apiBaseUrl.value || null,
    isDefault: true,
    temperature: temperature.value,
    maxTokens: maxTokens.value
  }
}

async function handleTest() {
  if (isCustomModelMissing()) {
    toast.add({ title: t('customModelRequired'), color: 'error' })
    return
  }
  isTesting.value = true
  testLatency.value = null
  try {
    const result = await $fetch<{ ok: boolean, latency_ms: number }>('/api/v1/llm/test', {
      method: 'POST',
      body: {
        provider: selectedProvider.value,
        model: getEffectiveModel(),
        apiKey: apiKey.value || undefined,
        apiBaseUrl: apiBaseUrl.value || undefined,
        businessId: props.mode === 'override' ? props.businessId : undefined
      }
    })
    testLatency.value = result.latency_ms
    toast.add({ title: t('testOk', { ms: result.latency_ms }), color: 'success' })
  } catch (error: unknown) {
    const message = error instanceof Error && 'data' in error
      ? String((error as { data?: { message?: string } }).data?.message ?? t('testError'))
      : t('testError')
    toast.add({ title: message, color: 'error' })
  } finally {
    isTesting.value = false
  }
}

/** Drop the per-business override entirely, reverting to the user's own default. */
async function handleClearOverride() {
  isClearing.value = true
  try {
    await $fetch(`/api/v1/llm/override?businessId=${props.businessId}`, { method: 'DELETE' })
    hasOverride.value = false
    toast.add({ title: t('cleared'), color: 'success' })
    emit('saved')
    await loadConfig()
  } catch {
    toast.add({ title: t('clearError'), color: 'error' })
  } finally {
    isClearing.value = false
  }
}

/**
 * Reset to the operator's configured AI.
 *
 * The two modes need different mechanics, and conflating them is why this
 * used to look like it worked while changing nothing:
 *
 * - override: persist a `system` sentinel for this business.
 * - global: `user_llm_configs` has no sentinel representation, and storing
 *   one would hand the literal string "system" to pi, which cannot resolve it.
 *   So DELETE the user's row; `getDefaultConfig` then returns the system
 *   config on its own. `id: 'default'` is the synthetic id for "no row", so
 *   there is nothing to delete and the account is already on the system AI.
 */
async function handleUseSystemAi() {
  isClearing.value = true
  try {
    if (props.mode === 'global') {
      if (existingId.value && existingId.value !== 'default') {
        await $fetch(`/api/ai-tools/llm/${existingId.value}`, { method: 'DELETE' })
      }
      existingId.value = null
      hasKey.value = false
      resetGenerationControls()
    } else {
      await $fetch('/api/v1/llm/override', {
        method: 'POST',
        body: { businessId: props.businessId, provider: 'system', model: '' },
      })
      hasOverride.value = true
    }
    selectSystemProvider()
    toast.add({ title: t('systemApplied'), color: 'success' })
    emit('saved')
    await loadConfig()
  } catch {
    toast.add({ title: t('clearError'), color: 'error' })
  } finally {
    isClearing.value = false
  }
}

// ── Tool backends (ScrapeGraphAI + LangSearch + Python tools service) ────────
interface ToolBackendsState {
  scrapegraph: { hasKey: boolean }
  langsearch: { hasKey: boolean }
  python: { url: string | null, hasToken: boolean }
}

type ToolKind = 'scrapegraph' | 'langsearch' | 'python'

const toolBackends = ref<ToolBackendsState | null>(null)
const scrapegraphApiKey = ref('')
const langsearchApiKey = ref('')
const pythonBackendUrl = ref('')
const pythonBackendToken = ref('')
const toolSaving = ref(false)
const toolTesting = ref<ToolKind | null>(null)
const toolLatency = ref<{ scrapegraph: number | null, langsearch: number | null, python: number | null }>({ scrapegraph: null, langsearch: null, python: null })

const scrapegraphKeyPlaceholder = computed(() =>
  toolBackends.value?.scrapegraph.hasKey ? t('tools.scrapegraphKeySaved') : t('tools.scrapegraphKeyPlaceholder'),
)
const langsearchKeyPlaceholder = computed(() =>
  toolBackends.value?.langsearch.hasKey ? t('tools.langsearchKeySaved') : t('tools.langsearchKeyPlaceholder'),
)
const pythonTokenPlaceholder = computed(() =>
  toolBackends.value?.python.hasToken ? t('tools.pythonTokenSaved') : '',
)

async function loadToolBackends() {
  if (props.mode !== 'global') return
  try {
    const data = await $fetch<ToolBackendsState>('/api/v1/integrations/tools')
    toolBackends.value = data
    pythonBackendUrl.value = data.python.url ?? ''
  }
  catch {
    toast.add({ title: t('tools.loadError'), color: 'error' })
  }
}

async function handleSaveToolBackends() {
  toolSaving.value = true
  try {
    const data = await $fetch<ToolBackendsState>('/api/v1/integrations/tools', {
      method: 'POST',
      body: {
        scrapegraphApiKey: scrapegraphApiKey.value || undefined,
        langsearchApiKey: langsearchApiKey.value || undefined,
        pythonBackendUrl: pythonBackendUrl.value.trim() || null,
        pythonBackendToken: pythonBackendToken.value || undefined,
      },
    })
    toolBackends.value = data
    scrapegraphApiKey.value = ''
    langsearchApiKey.value = ''
    pythonBackendToken.value = ''
    toast.add({ title: t('tools.saved'), color: 'success' })
  }
  catch {
    toast.add({ title: t('tools.saveError'), color: 'error' })
  }
  finally {
    toolSaving.value = false
  }
}

function toolTestPayload(kind: ToolKind) {
  if (kind === 'scrapegraph') return { kind, apiKey: scrapegraphApiKey.value || undefined }
  if (kind === 'langsearch') return { kind, apiKey: langsearchApiKey.value || undefined }
  return { kind, url: pythonBackendUrl.value.trim() || undefined, token: pythonBackendToken.value || undefined }
}

async function handleTestTool(kind: ToolKind) {
  toolTesting.value = kind
  toolLatency.value[kind] = null
  try {
    const result = await $fetch<{ ok: boolean, latencyMs: number }>('/api/v1/integrations/tools/test', {
      method: 'POST',
      body: toolTestPayload(kind),
    })
    toolLatency.value[kind] = result.latencyMs
    toast.add({ title: t('tools.testOk', { ms: result.latencyMs }), color: 'success' })
  }
  catch {
    toast.add({ title: t('tools.testError'), color: 'error' })
  }
  finally {
    toolTesting.value = null
  }
}

onMounted(() => {
  loadConfig()
  loadToolBackends()
})
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-xl font-semibold">{{ cardTitle }}</h2>
      <p class="text-sm text-muted-foreground">{{ cardSubtitle }}</p>
    </template>

    <div class="space-y-4">
      <UFormField :label="t('provider')" name="provider">
        <USelect v-model="selectedProvider" :items="providerItems" value-key="value"
          @update:model-value="handleProviderChange" />
      </UFormField>

      <UFormField :label="t('model')" name="model">
        <USelect v-if="!showCustomModelInput" v-model="selectedModel" :items="availableModels"
          :placeholder="t('selectModel')" :disabled="isSystemProvider" />
        <UInput v-else v-model="customModelName" :placeholder="t('customModelPlaceholder')" autocomplete="off" />
      </UFormField>

      <div v-if="isSystemProvider" v-motion-fade :duration="250" data-testid="system-ai-notice">
        <p class="text-sm text-muted-foreground">{{ t('systemNotice') }}</p>
      </div>

      <div v-if="isLocalProvider" v-motion-fade :duration="250">
        <UCheckbox :model-value="useCustomModel" :label="t('useCustomModel')"
          @update:model-value="handleCustomToggle" />
        <p class="text-xs text-muted-foreground mt-1">{{ t('customModelHelp') }}</p>
      </div>

      <div v-if="showApiKeyField" v-motion-fade :duration="250">
        <UFormField :label="t('apiKey')" name="apiKey">
          <UInput v-model="apiKey" type="password" :placeholder="keyPlaceholder" autocomplete="off" />
        </UFormField>
        <p class="text-xs text-muted-foreground mt-1">{{ t('apiKeyHelp') }}</p>
      </div>

      <div v-if="showBaseUrlField" v-motion-fade :duration="250">
        <UFormField :label="t('baseUrl')" name="apiBaseUrl">
          <UInput v-model="apiBaseUrl" :placeholder="baseUrlPlaceholder" />
        </UFormField>
      </div>

      <div v-if="!isSystemProvider" v-motion-fade :duration="250">
        <UFormField :label="t('temperature')" name="temperature">
          <URange v-model="temperature" :min="0" :max="2" :step="0.1" />
        </UFormField>
        <p class="text-xs text-muted-foreground">{{ t('temperatureHelp') }}</p>

        <UFormField :label="t('maxTokens')" name="maxTokens">
          <UInput v-model="maxTokens" type="number" :min="128" :max="128000" />
        </UFormField>
      </div>

      <div v-if="testLatency !== null" v-motion-slide-bottom :duration="250">
        <UBadge color="success" variant="subtle">{{ t('testOk', { ms: testLatency }) }}</UBadge>
      </div>

      <div class="flex items-center gap-2">
        <UButton :loading="isSaving" @click="handleSave">{{ t('save') }}</UButton>
        <UButton v-if="!isSystemProvider" color="neutral" variant="outline" :loading="isTesting" @click="handleTest">{{
          t('testConnection') }}</UButton>
        <UButton v-if="!isSystemProvider" color="neutral" variant="outline" :loading="isClearing"
          data-testid="use-system-ai" @click="handleUseSystemAi">
          {{ t('useSystemAi') }}
        </UButton>
        <UButton v-if="mode === 'override' && hasOverride" color="neutral" variant="ghost" :loading="isClearing"
          data-testid="clear-override" @click="handleClearOverride">
          {{ t('clearOverride') }}
        </UButton>
      </div>
    </div>
  </UCard>

  <UCard v-if="mode === 'global'" v-motion-fade-visible :duration="250" class="mt-6" data-testid="tool-backends-card">
    <template #header>
      <h2 class="text-xl font-semibold">{{ t('tools.title') }}</h2>
      <p class="text-sm text-muted-foreground">{{ t('tools.subtitle') }}</p>
    </template>

    <div class="space-y-6">
      <div class="space-y-3">
        <h3 class="text-sm font-semibold">{{ t('tools.scrapegraphKey') }}</h3>
        <UFormField :label="t('tools.scrapegraphKey')" name="scrapegraphApiKey">
          <UInput v-model="scrapegraphApiKey" type="password" :placeholder="scrapegraphKeyPlaceholder"
            autocomplete="off" class="w-full" data-testid="scrapegraph-key" />
        </UFormField>
        <p class="text-xs text-muted-foreground">{{ t('tools.scrapegraphHelp') }}</p>
        <div class="flex items-center gap-2">
          <UButton color="neutral" variant="outline" :loading="toolTesting === 'scrapegraph'"
            data-testid="scrapegraph-test" @click="handleTestTool('scrapegraph')">
            {{ t('tools.testScrapegraph') }}
          </UButton>
          <UBadge v-if="toolLatency.scrapegraph !== null" v-motion-fade :duration="200" color="success"
            variant="subtle">
            {{ t('tools.testOk', { ms: toolLatency.scrapegraph }) }}
          </UBadge>
        </div>
      </div>

      <div class="space-y-3 border-t border-default pt-4">
        <h3 class="text-sm font-semibold">{{ t('tools.langsearchKey') }}</h3>
        <UFormField :label="t('tools.langsearchKey')" name="langsearchApiKey">
          <UInput v-model="langsearchApiKey" type="password" :placeholder="langsearchKeyPlaceholder" autocomplete="off"
            class="w-full" data-testid="langsearch-key" />
        </UFormField>
        <p class="text-xs text-muted-foreground">{{ t('tools.langsearchHelp') }}</p>
        <div class="flex items-center gap-2">
          <UButton color="neutral" variant="outline" :loading="toolTesting === 'langsearch'"
            data-testid="langsearch-test" @click="handleTestTool('langsearch')">
            {{ t('tools.testLangsearch') }}
          </UButton>
          <UBadge v-if="toolLatency.langsearch !== null" v-motion-fade :duration="200" color="success" variant="subtle">
            {{ t('tools.testOk', { ms: toolLatency.langsearch }) }}
          </UBadge>
        </div>
      </div>

      <div class="space-y-3 border-t border-default pt-4">
        <h3 class="text-sm font-semibold">{{ t('tools.pythonUrl') }}</h3>
        <UFormField :label="t('tools.pythonUrl')" name="pythonBackendUrl">
          <UInput v-model="pythonBackendUrl" :placeholder="t('tools.pythonUrlPlaceholder')" class="w-full"
            data-testid="python-backend-url" />
        </UFormField>
        <UFormField :label="t('tools.pythonToken')" name="pythonBackendToken">
          <UInput v-model="pythonBackendToken" type="password" :placeholder="pythonTokenPlaceholder" autocomplete="off"
            class="w-full" data-testid="python-backend-token" />
        </UFormField>
        <p class="text-xs text-muted-foreground">{{ t('tools.pythonHelp') }}</p>
        <div class="flex items-center gap-2">
          <UButton color="neutral" variant="outline" :loading="toolTesting === 'python'"
            data-testid="python-backend-test" @click="handleTestTool('python')">
            {{ t('tools.testPython') }}
          </UButton>
          <UBadge v-if="toolLatency.python !== null" v-motion-fade :duration="200" color="success" variant="subtle">
            {{ t('tools.testOk', { ms: toolLatency.python }) }}
          </UBadge>
        </div>
      </div>

      <UButton :loading="toolSaving" data-testid="tool-backends-save" @click="handleSaveToolBackends">
        {{ t('tools.save') }}
      </UButton>
    </div>
  </UCard>
</template>

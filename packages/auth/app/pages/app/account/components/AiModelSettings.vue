<i18n src="./AiModelSettings.json"></i18n>
<script lang="ts" setup>
interface Props {
  mode: 'global' | 'override'
  businessId?: string
}

const props = withDefaults(defineProps<Props>(), { businessId: '' })
const emit = defineEmits<{ saved: [] }>()

const { t } = useI18n()
const toast = useToast()

const PROVIDERS = ['google', 'ollama', 'openai', 'anthropic', 'openrouter', 'deepseek'] as const
type Provider = typeof PROVIDERS[number]

const MODELS: Record<Provider, string[]> = {
  google: ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  ollama: ['qwen3.5', 'llama3.2', 'mistral', 'phi3', 'gemma2', 'codegemma'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
  openrouter: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.1-405b-instruct', 'mistralai/mistral-large'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner']
}

const selectedProvider = ref<Provider>('google')
const selectedModel = ref('gemini-3-flash-preview')
const useCustomModel = ref(false)
const customModelName = ref('')
const apiKey = ref('')
const apiBaseUrl = ref('')
const temperature = ref(0.7)
const DEFAULT_MAX_TOKENS = 2048
const LOCAL_DEFAULT_MAX_TOKENS = 120000
const maxTokens = ref(DEFAULT_MAX_TOKENS)
const hasKey = ref(false)
const existingId = ref<string | null>(null)
const hasOverride = ref(false)

const isSaving = ref(false)
const isTesting = ref(false)
const isClearing = ref(false)
const testLatency = ref<number | null>(null)

const providerItems = computed(() => PROVIDERS.map(p => ({ label: t(`providers.${p}`), value: p })))
const availableModels = computed(() => MODELS[selectedProvider.value] ?? [])
const isLocalProvider = computed(() => selectedProvider.value === 'ollama')
const showCustomModelInput = computed(() => isLocalProvider.value && useCustomModel.value)
const showApiKeyField = computed(() => selectedProvider.value !== 'ollama')
const showBaseUrlField = computed(() => selectedProvider.value === 'ollama')
const keyPlaceholder = computed(() => hasKey.value ? t('keySaved') : t('apiKeyPlaceholder'))
const cardTitle = computed(() => props.mode === 'global' ? t('titleGlobal') : t('titleOverride'))
const cardSubtitle = computed(() => props.mode === 'global' ? t('subtitleGlobal') : t('subtitleOverride'))

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

function applyLoaded(data: { provider: Provider, model: string, apiBaseUrl?: string | null, temperature?: number, maxTokens?: number, hasKey?: boolean, id?: string }) {
  selectedProvider.value = data.provider
  selectedModel.value = data.model
  apiBaseUrl.value = data.apiBaseUrl ?? ''
  temperature.value = data.temperature ?? 0.7
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
  selectedModel.value = MODELS[next]?.[0] ?? ''
  useCustomModel.value = false
  customModelName.value = ''
  if (next === 'ollama') {
    applyLocalDefaults()
  }
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
  } catch {
    toast.add({ title: t('testError'), color: 'error' })
  } finally {
    isTesting.value = false
  }
}

async function handleClear() {
  isClearing.value = true
  try {
    await $fetch(`/api/v1/llm/override?businessId=${props.businessId}`, { method: 'DELETE' })
    hasOverride.value = false
    apiKey.value = ''
    toast.add({ title: t('cleared'), color: 'success' })
    emit('saved')
  } catch {
    toast.add({ title: t('clearError'), color: 'error' })
  } finally {
    isClearing.value = false
  }
}

onMounted(() => {
  loadConfig()
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
        <USelect v-model="selectedProvider" :items="providerItems" value-key="value" @update:model-value="handleProviderChange" />
      </UFormField>

      <UFormField :label="t('model')" name="model">
        <USelect v-if="!showCustomModelInput" v-model="selectedModel" :items="availableModels" :placeholder="t('selectModel')" />
        <UInput v-else v-model="customModelName" :placeholder="t('customModelPlaceholder')" autocomplete="off" />
      </UFormField>

      <div v-if="isLocalProvider" v-motion-fade :duration="250">
        <UCheckbox :model-value="useCustomModel" :label="t('useCustomModel')" @update:model-value="handleCustomToggle" />
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
          <UInput v-model="apiBaseUrl" :placeholder="t('baseUrlPlaceholder')" />
        </UFormField>
      </div>

      <UFormField :label="t('temperature')" name="temperature">
        <URange v-model="temperature" :min="0" :max="2" :step="0.1" />
      </UFormField>
      <p class="text-xs text-muted-foreground">{{ t('temperatureHelp') }}</p>

      <UFormField :label="t('maxTokens')" name="maxTokens">
        <UInput v-model="maxTokens" type="number" :min="128" :max="128000" />
      </UFormField>

      <div v-if="testLatency !== null" v-motion-slide-bottom :duration="250">
        <UBadge color="success" variant="subtle">{{ t('testOk', { ms: testLatency }) }}</UBadge>
      </div>

      <div class="flex items-center gap-2">
        <UButton :loading="isSaving" @click="handleSave">{{ t('save') }}</UButton>
        <UButton color="neutral" variant="outline" :loading="isTesting" @click="handleTest">{{ t('testConnection') }}</UButton>
        <UButton v-if="mode === 'override' && hasOverride" color="neutral" variant="ghost" :loading="isClearing" @click="handleClear">{{ t('clearOverride') }}</UButton>
      </div>
    </div>
  </UCard>
</template>

<i18n src="./settings.json"></i18n>

<script setup lang="ts">

const { t } = useI18n()
const toast = useToast()

interface LlmConfig {
  id: string
  provider: string
  model: string
  isDefault: boolean
  temperature: number
  maxTokens: number
}

const providerOptions = computed(() => [
  { label: t('providers.ollama'), value: 'ollama', description: t('providers.ollamaDescription') },
  { label: t('providers.openai'), value: 'openai', description: t('providers.openaiDescription') },
  { label: t('providers.anthropic'), value: 'anthropic', description: t('providers.anthropicDescription') },
  { label: t('providers.openrouter'), value: 'openrouter', description: t('providers.openrouterDescription') },
])

const modelsByProvider: Record<string, string[]> = {
  ollama: ['qwen3.5', 'llama3.2', 'mistral', 'phi3', 'gemma2', 'codegemma'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
  openrouter: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.1-405b-instruct', 'mistralai/mistral-large'],
}

const { data: configs, refresh } = await useFetch<LlmConfig[]>('/api/ai-tools/llm')

const selectedProvider = ref('ollama')
const selectedModel = ref('qwen3.5')
const apiKey = ref('')
const apiBaseUrl = ref('')
const temperature = ref(0.7)
const maxTokens = ref(2048)
const isDefault = ref(true)
const isSaving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

const availableModels = computed(() => modelsByProvider[selectedProvider.value] ?? [])
const showApiKeyField = computed(() => ['openai', 'anthropic', 'openrouter'].includes(selectedProvider.value))
const showBaseUrlField = computed(() => selectedProvider.value === 'ollama')

function selectProvider(provider: string) {
  selectedProvider.value = provider
  selectedModel.value = modelsByProvider[provider]?.[0] ?? ''
}

async function saveConfig() {
  isSaving.value = true
  saveError.value = ''
  saveSuccess.value = false
  try {
    await $fetch('/api/ai-tools/llm', {
      method: 'POST',
      body: {
        provider: selectedProvider.value,
        model: selectedModel.value,
        apiKey: apiKey.value || null,
        apiBaseUrl: apiBaseUrl.value || null,
        isDefault: isDefault.value,
        temperature: temperature.value,
        maxTokens: maxTokens.value,
      },
    })
    saveSuccess.value = true
    await refresh()
    toast.add({ title: t('saved'), color: 'success' })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : t('saveError')
    saveError.value = message
    toast.add({ title: t('saveError'), description: message, color: 'error' })
  }
  finally {
    isSaving.value = false
  }
}

async function setDefault(id: string) {
  await $fetch(`/api/ai-tools/llm/${id}/set-default`, { method: 'POST' })
  await refresh()
  toast.add({ title: t('saved'), color: 'success' })
}

async function deleteConfig(id: string) {
  await $fetch(`/api/ai-tools/llm/${id}`, { method: 'DELETE' })
  await refresh()
  toast.add({ title: t('deleted'), color: 'info' })
}

function loadConfig(config: LlmConfig) {
  selectedProvider.value = config.provider
  selectedModel.value = config.model
  apiKey.value = ''
  temperature.value = config.temperature
  maxTokens.value = config.maxTokens
}
</script>

<template>
  <div class="min-h-screen bg-[#0a0a0a]">
    <div class="max-w-6xl mx-auto p-6">
      <header class="mb-12 mt-8">
        <h1 class="text-3xl font-semibold tracking-tight text-white mb-2">{{ t('title') }}</h1>
        <p class="text-gray-400">{{ t('subtitle') }}</p>
      </header>

      <div v-if="configs?.length" class="mb-6">
        <h2 class="text-lg font-semibold text-white mb-3">{{ t('savedConfigs') }}</h2>
        <div class="space-y-3">
          <div v-for="config in configs" :key="config.id" v-motion-fade
            class="flex items-center justify-between p-4 rounded-lg border border-gray-700/50"
            :class="config.isDefault ? 'bg-emerald-500/5 border-emerald-500/30' : 'hover:bg-gray-800/30'">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-200">{{ config.model }}</span>
                <UBadge v-if="config.isDefault" color="primary" variant="subtle" size="sm">{{ t('default') }}</UBadge>
                <UBadge color="neutral" variant="outline" size="sm">{{ config.provider }}</UBadge>
              </div>
              <p class="text-sm text-gray-500 mt-1">{{ t('temp') }}: {{ config.temperature }} · {{ t('tokens') }}: {{
                config.maxTokens }}</p>
            </div>
            <div class="flex items-center gap-2">
              <UButton v-if="!config.isDefault" icon="i-heroicons-star" color="neutral" variant="ghost" size="sm"
                :aria-label="t('default')" @click="setDefault(config.id)" />
              <UButton icon="i-heroicons-pencil" color="neutral" variant="ghost" size="sm" :aria-label="t('edit')"
                @click="loadConfig(config)" />
              <UButton icon="i-heroicons-trash" color="error" variant="ghost" size="sm" :aria-label="t('delete')"
                @click="deleteConfig(config.id)" />
            </div>
          </div>
        </div>
      </div>

      <div class="border border-gray-700/50 rounded-lg">
        <div class="p-4 border-b border-gray-700/50">
          <h2 class="text-lg font-semibold text-white">{{ t('addConfig') }}</h2>
        </div>
        <div class="p-6 space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-200 mb-2">{{ t('provider') }}</label>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button v-for="option in providerOptions" :key="option.value" type="button"
                class="p-3 rounded-lg border cursor-pointer transition-colors text-left"
                :class="selectedProvider === option.value ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-gray-700/50 hover:border-gray-600'"
                @click="selectProvider(option.value)">
                <div class="font-medium text-gray-200">{{ option.label }}</div>
                <p class="text-xs text-gray-500 mt-1">{{ option.description }}</p>
              </button>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-200 mb-2">{{ t('model') }}</label>
            <USelect v-model="selectedModel" :items="availableModels" :placeholder="t('selectModel')" />
          </div>

          <div v-if="showApiKeyField">
            <label class="block text-sm font-medium text-gray-200 mb-2">{{ t('apiKey') }}</label>
            <UInput v-model="apiKey" type="password" :placeholder="t('apiKeyPlaceholder')" />
            <p class="text-xs text-gray-500 mt-1">{{ t('apiKeyHelp') }}</p>
          </div>

          <div v-if="showBaseUrlField">
            <label class="block text-sm font-medium text-gray-200 mb-2">{{ t('baseUrl') }}</label>
            <UInput v-model="apiBaseUrl" placeholder="http://localhost:11434" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-200 mb-2">{{ t('temperature') }}: {{ temperature
              }}</label>
            <URange v-model="temperature" :min="0" :max="2" :step="0.1" />
            <p class="text-xs text-gray-500 mt-1">{{ t('temperatureHelp') }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-200 mb-2">{{ t('maxTokens') }}</label>
            <UInput v-model="maxTokens" type="number" :min="256" :max="8192" />
          </div>

          <div class="flex items-center gap-3">
            <USwitch v-model="isDefault" />
            <label class="text-sm text-gray-300">{{ t('setDefault') }}</label>
          </div>

          <div class="flex items-center gap-3">
            <UButton :loading="isSaving" @click="saveConfig">{{ t('save') }}</UButton>
            <UAlert v-if="saveSuccess" v-motion-fade :title="t('saved')" color="success" variant="soft"
              class="ml-auto" />
            <UAlert v-if="saveError" :title="saveError" color="error" variant="soft" class="ml-auto" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n src="./settings.json"></i18n>

<script setup lang="ts">
const { t } = useI18n()

const providerOptions = [
  { label: 'Ollama (Local)', value: 'ollama', description: 'Run models locally. Free, private, requires Ollama installed.' },
  { label: 'OpenAI', value: 'openai', description: 'GPT-4o, GPT-4 Turbo, etc. Requires API key.' },
  { label: 'Anthropic', value: 'anthropic', description: 'Claude 3.5 Sonnet, Claude 3 Haiku, etc. Requires API key.' },
  { label: 'OpenRouter', value: 'openrouter', description: 'Access 100+ models. Single API key. Pay per use.' },
]

const ollamaModels = ['qwen3.5', 'llama3.2', 'mistral', 'phi3', 'gemma2', 'codegemma']
const openaiModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
const anthropicModels = ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229']
const openrouterModels = ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.1-405b-instruct', 'mistralai/mistral-large']

const { data: configs, refresh } = await useFetch('/api/ai-tools/llm')

const selectedProvider = ref('ollama')
const selectedModel = ref('qwen3.5')
const apiKey = ref('')
const apiBaseUrl = ref('')
const temperature = ref(0.7)
const maxTokens = ref(2048)
const isDefault = ref(true)

const availableModels = computed(() => {
  switch (selectedProvider.value) {
    case 'ollama': return ollamaModels
    case 'openai': return openaiModels
    case 'anthropic': return anthropicModels
    case 'openrouter': return openrouterModels
    default: return []
  }
})

const showApiKeyField = computed(() => {
  return ['openai', 'anthropic', 'openrouter'].includes(selectedProvider.value)
})

const showBaseUrlField = computed(() => {
  return selectedProvider.value === 'ollama'
})

const isSaving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

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

    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (error: any) {
    saveError.value = error.message || 'Failed to save configuration'
  } finally {
    isSaving.value = false
  }
}

async function setDefault(id: string) {
  await $fetch(`/api/ai-tools/llm/${id}/set-default`, { method: 'POST' })
  await refresh()
}

async function deleteConfig(id: string) {
  await $fetch(`/api/ai-tools/llm/${id}`, { method: 'DELETE' })
  await refresh()
}

function loadConfig(config: any) {
  selectedProvider.value = config.provider
  selectedModel.value = config.model
  apiKey.value = config.apiKey || ''
  apiBaseUrl.value = config.apiBaseUrl || ''
  temperature.value = config.temperature
  maxTokens.value = config.maxTokens
}
</script>

<template>
  <div class="max-w-4xl mx-auto p-6">
    <div class="mb-8">
      <h1 class="text-2xl font-bold">{{ t('title') }}</h1>
      <p class="text-neutral-500 mt-1">{{ t('subtitle') }}</p>
    </div>

    <!-- Current Configs -->
    <UCard v-if="configs?.length" class="mb-6">
      <template #header>
        <h2 class="text-lg font-semibold">{{ t('savedConfigs') }}</h2>
      </template>

      <div class="space-y-3">
        <div v-for="config in configs" :key="config.id" class="flex items-center justify-between p-3 rounded-lg border"
          :class="config.isDefault ? 'border-primary-500 bg-primary-50 dark:bg-primary-950' : 'border-neutral-200 dark:border-neutral-700'">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ config.model }}</span>
              <UBadge v-if="config.isDefault" color="primary" variant="subtle" size="sm">
                {{ t('default') }}
              </UBadge>
              <UBadge color="neutral" variant="outline" size="sm">
                {{ config.provider }}
              </UBadge>
            </div>
            <p class="text-sm text-neutral-500 mt-1">
              {{ t('temp') }}: {{ config.temperature }} · {{ t('tokens') }}: {{ config.maxTokens }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UButton v-if="!config.isDefault" icon="i-heroicons-star" color="neutral" variant="ghost" size="sm"
              @click="setDefault(config.id)" />
            <UButton icon="i-heroicons-pencil" color="neutral" variant="ghost" size="sm" @click="loadConfig(config)" />
            <UButton icon="i-heroicons-trash" color="error" variant="ghost" size="sm"
              @click="deleteConfig(config.id)" />
          </div>
        </div>
      </div>
    </UCard>

    <!-- Config Form -->
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">{{ t('addConfig') }}</h2>
      </template>

      <div class="space-y-6">
        <!-- Provider Selection -->
        <div>
          <label class="block text-sm font-medium mb-2">{{ t('provider') }}</label>
          <div class="grid grid-cols-2 gap-3">
            <div v-for="option in providerOptions" :key="option.value"
              class="p-3 rounded-lg border cursor-pointer transition-colors" :class="selectedProvider === option.value
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950'
                : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'"
              @click="selectedProvider = option.value; selectedModel = availableModels[0] || ''">
              <div class="font-medium">{{ option.label }}</div>
              <p class="text-xs text-neutral-500 mt-1">{{ option.description }}</p>
            </div>
          </div>
        </div>

        <!-- Model Selection -->
        <div>
          <label class="block text-sm font-medium mb-2">{{ t('model') }}</label>
          <USelectMenu v-model="selectedModel" :items="availableModels" :placeholder="t('selectModel')" />
        </div>

        <!-- API Key (for cloud providers) -->
        <div v-if="showApiKeyField">
          <label class="block text-sm font-medium mb-2">{{ t('apiKey') }}</label>
          <UInput v-model="apiKey" type="password" :placeholder="t('apiKeyPlaceholder')" />
          <p class="text-xs text-neutral-500 mt-1">{{ t('apiKeyHelp') }}</p>
        </div>

        <!-- Base URL (for Ollama) -->
        <div v-if="showBaseUrlField">
          <label class="block text-sm font-medium mb-2">{{ t('baseUrl') }}</label>
          <UInput v-model="apiBaseUrl" placeholder="http://localhost:11434" />
        </div>

        <!-- Temperature -->
        <div>
          <label class="block text-sm font-medium mb-2">
            {{ t('temperature') }}: {{ temperature }}
          </label>
          <URange v-model="temperature" :min="0" :max="2" :step="0.1" />
          <p class="text-xs text-neutral-500 mt-1">{{ t('temperatureHelp') }}</p>
        </div>

        <!-- Max Tokens -->
        <div>
          <label class="block text-sm font-medium mb-2">{{ t('maxTokens') }}</label>
          <UInput v-model="maxTokens" type="number" :min="256" :max="8192" />
        </div>

        <!-- Set as Default -->
        <div class="flex items-center gap-3">
          <USwitch v-model="isDefault" />
          <label class="text-sm">{{ t('setDefault') }}</label>
        </div>

        <!-- Save Button -->
        <div class="flex items-center gap-3">
          <UButton :loading="isSaving" @click="saveConfig">
            {{ t('save') }}
          </UButton>

          <Transition name="fade">
            <UAlert v-if="saveSuccess" :title="t('saved')" color="success" variant="soft" class="ml-auto" />
          </Transition>

          <UAlert v-if="saveError" :title="saveError" color="error" variant="soft" class="ml-auto" />
        </div>
      </div>
    </UCard>
  </div>
</template>

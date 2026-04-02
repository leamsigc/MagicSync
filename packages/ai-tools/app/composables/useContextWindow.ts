import { ref, computed } from 'vue'

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ContextWindowConfig {
  model: string
  contextLimit: number
}

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'llama3': 8192,
  'llama3.1': 128000,
  'llama3.2': 128000,
  'mistral': 8192,
  'mixtral': 32000,
  'phi3': 4096,
  'gpt-3.5-turbo': 16385,
  'gpt-4': 8192,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'claude-3-sonnet': 200000,
  'claude-3-opus': 200000,
  'default': 8192
}

export function useContextWindow() {
  const usage = ref<TokenUsage>({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0
  })
  
  const config = ref<ContextWindowConfig>({
    model: 'llama3',
    contextLimit: 8192
  })

  const usagePercentage = computed(() => {
    if (!config.value.contextLimit) return 0
    return (usage.value.totalTokens / config.value.contextLimit) * 100
  })

  const statusColor = computed(() => {
    const pct = usagePercentage.value
    if (pct < 50) return 'green'
    if (pct < 80) return 'yellow'
    return 'red'
  })

  const isWarning = computed(() => usagePercentage.value > 80)
  const isCritical = computed(() => usagePercentage.value > 95)

  function updateUsage(prompt: number, completion: number) {
    usage.value = {
      promptTokens: prompt,
      completionTokens: completion,
      totalTokens: prompt + completion
    }
  }

  function setModel(model: string) {
    config.value.model = model
    config.value.contextLimit = MODEL_CONTEXT_WINDOWS[model] || MODEL_CONTEXT_WINDOWS.default
  }

  function reset() {
    usage.value = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    }
  }

  return {
    usage,
    config,
    usagePercentage,
    statusColor,
    isWarning,
    isCritical,
    updateUsage,
    setModel,
    reset
  }
}
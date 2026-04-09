import { ref, computed, onMounted, onUnmounted } from 'vue'

interface ContextUsage {
  used: number
  max: number
  remaining: number
  percentage: number
  status: 'green' | 'yellow' | 'red'
}

const MAX_CONTEXT_WINDOW = 128000
const WARNING_THRESHOLD = 80
const CRITICAL_THRESHOLD = 90

export function useContextWindow() {
  const messages = ref<any[]>([])
  const currentModel = ref('gpt-4o')
  const maxTokens = ref(MAX_CONTEXT_WINDOW)
  
  const contextUsage = computed<ContextUsage>(() => {
    let totalChars = 0
    
    for (const msg of messages.value) {
      const content = msg.content
      if (typeof content === 'string') {
        totalChars += content.length
      } else if (Array.isArray(content)) {
        for (const part of content) {
          if (part.type === 'text') {
            totalChars += part.text?.length || 0
          }
        }
      }
    }
    
    const estimatedTokens = Math.ceil(totalChars / 4)
    const percentage = (estimatedTokens / maxTokens.value) * 100
    
    let status: 'green' | 'yellow' | 'red' = 'green'
    if (percentage >= CRITICAL_THRESHOLD) {
      status = 'red'
    } else if (percentage >= WARNING_THRESHOLD) {
      status = 'yellow'
    }
    
    return {
      used: estimatedTokens,
      max: maxTokens.value,
      remaining: maxTokens.value - estimatedTokens,
      percentage: Math.round(percentage),
      status
    }
  })
  
  const isWarning = computed(() => contextUsage.value.status !== 'green')
  const isCritical = computed(() => contextUsage.value.status === 'red')
  
  function setMessages(msgs: any[]) {
    messages.value = msgs
  }
  
  function setModel(model: string, contextWindow?: number) {
    currentModel.value = model
    if (contextWindow) {
      maxTokens.value = contextWindow
    }
  }
  
  return {
    contextUsage,
    isWarning,
    isCritical,
    setMessages,
    setModel,
    maxTokens,
    currentModel
  }
}

import { ref, computed, onMounted } from 'vue'

export interface ComponentState {
  type: 'tool-call' | 'sub-agent' | 'code-execution' | 'progress' | 'expandable'
  id: string
  expanded?: boolean
  scrollPosition?: number
  data?: Record<string, any>
}

export interface MessageState {
  messageId: string
  components: ComponentState[]
  timestamp: number
}

const MESSAGE_STATES_KEY = 'chat-message-states'

export function useChatHistoryState() {
  const messageStates = ref<Map<string, MessageState>>(new Map())

  function loadStates() {
    try {
      const stored = localStorage.getItem(MESSAGE_STATES_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        messageStates.value = new Map(Object.entries(parsed))
      }
    } catch (e) {
      console.warn('Failed to load message states:', e)
    }
  }

  function saveStates() {
    try {
      const obj = Object.fromEntries(messageStates.value)
      localStorage.setItem(MESSAGE_STATES_KEY, JSON.stringify(obj))
    } catch (e) {
      console.warn('Failed to save message states:', e)
    }
  }

  function saveMessageState(messageId: string, components: ComponentState[]) {
    messageStates.value.set(messageId, {
      messageId,
      components,
      timestamp: Date.now()
    })
    saveStates()
  }

  function getMessageState(messageId: string): MessageState | undefined {
    return messageStates.value.get(messageId)
  }

  function getComponentState(messageId: string, componentId: string): ComponentState | undefined {
    const state = messageStates.value.get(messageId)
    return state?.components.find(c => c.id === componentId)
  }

  function clearStates() {
    messageStates.value.clear()
    localStorage.removeItem(MESSAGE_STATES_KEY)
  }

  function clearOldStates(olderThanMs: number = 7 * 24 * 60 * 60 * 1000) {
    const now = Date.now()
    for (const [id, state] of messageStates.value.entries()) {
      if (now - state.timestamp > olderThanMs) {
        messageStates.value.delete(id)
      }
    }
    saveStates()
  }

  onMounted(() => {
    loadStates()
  })

  return {
    messageStates: computed(() => messageStates.value),
    saveMessageState,
    getMessageState,
    getComponentState,
    clearStates,
    clearOldStates,
    loadStates
  }
}

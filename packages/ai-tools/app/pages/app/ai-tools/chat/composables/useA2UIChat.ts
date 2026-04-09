import { ref, computed, watch, onMounted } from 'vue'
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'
import { useChatHistoryState } from './useChatHistoryState'

interface Thread {
  id: string
  title: string
  lastMessageAt: string | null
}

const THREAD_ID_STORAGE_KEY = 'ai-chat-thread-id'

export function useA2UIChat() {
  const threads = ref<Thread[]>([])
  const isLoadingThreads = ref(false)
  const threadId = ref<string | null>(null)
  const { saveMessageState, getMessageState } = useChatHistoryState()

  let loadThreads: () => Promise<void>
  let loadThreadMessages: (id: string) => Promise<void>

  const bodyRef = computed(() => ({
    thread_id: threadId.value || null,
  }))

  const transport = new DefaultChatTransport<UIMessage>({
    api: '/api/ai-tools/chat',
    body: () => bodyRef.value,
  })

  const chat = new Chat<UIMessage>({
    transport,
    onError(error) {
      console.error('Chat error:', error)
    },
    onFinish(event) {
      isLoadingThreads.value = false
      if (!threadId.value) {
        loadThreads().then(() => {
          if (threads.value.length === 1 && threads.value[0]) {
            threadId.value = threads.value[0].id
            localStorage.setItem(THREAD_ID_STORAGE_KEY, threadId.value)
          }
        })
      }
    },
  })

  loadThreads = async function() {
    isLoadingThreads.value = true
    try {
      const data = await $fetch<Thread[]>('/api/ai-tools/chat/threads')
      threads.value = data || []
    } catch (e) {
      console.error('Failed to load threads:', e)
    } finally {
      isLoadingThreads.value = false
    }
  }

  loadThreadMessages = async function(id: string) {
    try {
      const data = await $fetch<Array<{
        id: string
        role: string
        content: string
        createdAt: string
        metadata?: string
      }>>(`/api/ai-tools/chat/threads/${id}`)

      threadId.value = id
      const uiMessages: UIMessage[] = (data || []).map(m => {
        let metadata: any = undefined
        let uiState: any = undefined
        
        if (m.metadata) {
          try {
            const parsed = JSON.parse(m.metadata)
            metadata = parsed
            if (parsed.componentStates) {
              uiState = { componentStates: parsed.componentStates }
            }
          } catch {}
        }
        
        const messageState = getMessageState(m.id)
        
        return {
          id: m.id,
          role: m.role as 'user' | 'assistant' | 'system',
          parts: [{ type: 'text', text: m.content }],
          metadata,
          uiState: uiState || (messageState ? { componentStates: messageState.components } : undefined)
        }
      })
      chat.messages = uiMessages
    } catch (e) {
      console.error('Failed to load thread messages:', e)
    }
  }

  async function createNewThread() {
    chat.messages = []
    threadId.value = null
    localStorage.removeItem(THREAD_ID_STORAGE_KEY)
  }

  async function deleteThread(id: string) {
    try {
      await $fetch(`/api/ai-tools/chat/threads/${id}`, { method: 'DELETE' })
      threads.value = threads.value.filter(t => t.id !== id)
      if (threadId.value === id) {
        await createNewThread()
      }
    } catch (e) {
      console.error('Failed to delete thread:', e)
    }
  }

  function handleSuggestionClick(suggestion: string) {
    chat.sendMessage({ text: suggestion })
  }

  onMounted(async () => {
    const savedThreadId = localStorage.getItem(THREAD_ID_STORAGE_KEY)
    console.log('[useA2UIChat] onMounted, savedThreadId:', savedThreadId)
    if (savedThreadId) {
      threadId.value = savedThreadId
      console.log('[useA2UIChat] Restored threadId:', threadId.value)
      await loadThreadMessages(savedThreadId)
      console.log('[useA2UIChat] Loaded messages, chat.messages:', chat.messages.length)
    }
  })

  watch(threadId, (newThreadId) => {
    if (newThreadId) {
      localStorage.setItem(THREAD_ID_STORAGE_KEY, newThreadId)
    } else {
      localStorage.removeItem(THREAD_ID_STORAGE_KEY)
    }
  })

  return {
    chat,
    threads: computed(() => threads.value),
    isLoadingThreads: computed(() => isLoadingThreads.value),
    threadId: computed(() => threadId.value),
    loadThreads,
    loadThreadMessages,
    createNewThread,
    deleteThread,
    handleSuggestionClick,
  }
}
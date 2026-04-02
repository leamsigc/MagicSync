import { ref, computed } from 'vue'
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport } from 'ai'
import type { UIMessage } from 'ai'

interface Thread {
  id: string
  title: string
  lastMessageAt: string | null
}

export function useA2UIChat() {
  const threads = ref<Thread[]>([])
  const isLoadingThreads = ref(false)
  const threadId = ref<string | null>(null)

  const transport = new DefaultChatTransport<UIMessage>({
    api: '/api/ai-tools/chat',
    headers: () => ({
      'X-Thread-Id': threadId.value || '',
    }),
  })

  const chat = new Chat<UIMessage>({
    transport,
    onError(error) {
      console.error('Chat error:', error)
    },
    onData(data) {
      isLoadingThreads.value = true
    },
    onFinish() {
      isLoadingThreads.value = false
    },
  })

  async function loadThreads() {
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

  async function loadThreadMessages(id: string) {
    try {
      const data = await $fetch<Array<{
        id: string
        role: string
        content: string
        createdAt: string
      }>>(`/api/ai-tools/chat/threads/${id}`)

      threadId.value = id
      const uiMessages: UIMessage[] = (data || []).map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant' | 'system',
        parts: [{ type: 'text', text: m.content }],
      }))
      chat.messages = uiMessages
    } catch (e) {
      console.error('Failed to load thread messages:', e)
    }
  }

  async function createNewThread() {
    chat.messages = []
    threadId.value = null
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

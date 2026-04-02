<i18n src="./chat.json"></i18n>

<script setup lang="ts">
import { useA2UIChat } from './composables/useA2UIChat'
import ChatSidebar from './components/ChatSidebar.vue'
import { isReasoningStreaming } from '@nuxt/ui/utils/ai'
import { isReasoningUIPart, isTextUIPart } from 'ai'


// @ts-ignore
definePageMeta({ layout: 'ai-tools' })

const { t } = useI18n()
const input = ref('')

const {
  chat,
  threads,
  isLoadingThreads,
  threadId: activeThreadId,
  loadThreads,
  loadThreadMessages,
  createNewThread,
  deleteThread,
  handleSuggestionClick,
} = useA2UIChat()

onMounted(() => {
  loadThreads()
})

function onSubmit() {
  if (!input.value.trim()) return
  chat.sendMessage({ text: input.value })
  input.value = ''
}

function handleNewThread() {
  createNewThread()
}

function handleSelectThread(id: string) {
  loadThreadMessages(id)
}

function handleDeleteThread(id: string) {
  deleteThread(id)
}
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <ChatSidebar :threads="threads.map(t => ({
      id: t.id,
      title: t.title,
      lastMessage: t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleDateString() : '',
    }))" :active-thread-id="activeThreadId ?? undefined" @select="handleSelectThread" @delete="handleDeleteThread"
      @new-thread="handleNewThread" />

    <div class="flex-1 flex flex-col">
      <div class="flex items-center justify-between px-6 py-4 border-b border-muted">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <UIcon name="i-lucide-sparkles" class="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 class="text-lg font-semibold">{{ t('welcome') }}</h1>
            <p class="text-xs text-muted">
              {{ activeThreadId ? 'Thread active' : 'New conversation' }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UButton icon="i-lucide-rotate-cw" color="neutral" variant="ghost" size="sm" @click="chat.messages = []" />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto px-6 py-4">

        <UChatMessages :messages="chat.messages" :status="chat.status" should-auto-scroll class="flex-1">
          <template #content="{ message }">
            <template v-for="(part, index) in message.parts" :key="`${message.id}-${part.type}-${index}`">
              <UChatReasoning v-if="isReasoningUIPart(part)" :text="part.text" :streaming="chat.status === 'streaming'">
                <MDC :value="part.text" :cache-key="`reasoning-${message.id}-${index}`"
                  class="*:first:mt-0 *:last:mb-0" />
              </UChatReasoning>

              <template v-else-if="isTextUIPart(part)">
                <MDC v-if="message.role === 'assistant'" :value="part.text" :cache-key="`${message.id}-${index}`"
                  class="*:first:mt-0 *:last:mb-0" />
                <p v-else-if="message.role === 'user'" class="whitespace-pre-wrap">
                  {{ part.text }}
                </p>
                <template
                  v-if="chat.status === 'streaming' && message.role === 'assistant' && part.state === 'streaming'">
                  <UIcon name="i-lucide-ellipsis" class="w-8 h-8 animate-bounce text-muted" />
                </template>
              </template>

            </template>
          </template>
        </UChatMessages>

        <div v-if="!chat.messages.length" class="flex flex-col items-center justify-center h-full">
          <div class="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <UIcon name="i-lucide-sparkles" class="w-8 h-8 text-primary" />
          </div>
          <h2 class="text-xl font-semibold mb-2">{{ t('welcome') }}</h2>
          <p class="text-muted mb-6 text-center max-w-md">
            {{ t('welcomeDescription') }}
          </p>
          <div class="flex flex-wrap gap-2 justify-center">
            <UButton v-for="suggestion in [t('suggestion1'), t('suggestion2'), t('suggestion3')]" :key="suggestion"
              :label="suggestion" color="neutral" variant="outline" size="sm"
              @click="handleSuggestionClick(suggestion)" />
          </div>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-muted">
        <div class="max-w-3xl mx-auto">
          <UChatPrompt v-model="input" :placeholder="t('placeholder')" :error="chat.error" @submit="onSubmit">
            <UChatPromptSubmit :status="chat.status" @stop="chat.stop()" @reload="chat.regenerate()" />
          </UChatPrompt>
        </div>
      </div>
    </div>
  </div>
</template>

<i18n src="./json"></i18n>

<script setup lang="ts">
import { useA2UIChat } from './composables/useA2UIChat';

const { t } = useI18n()
const input = ref('')

const {
  messages,
  threads,
  sendMessage,
  clearMessages,
  isLoading,
  isLoadingThreads,
  error,
  regenerateLast,
  loadThreads,
  loadThreadMessages,
  createNewThread,
  deleteThread,
  threadId: activeThreadId,
} = useA2UIChat()

// Load threads on mount
onMounted(() => {
  loadThreads()
})

function onSubmit() {
  if (!input.value.trim()) return
  sendMessage(input.value)
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

function handleSuggestionClick(suggestion: string) {
  sendMessage(suggestion)
}
</script>

<template>
  <div class="flex h-[calc(100vh-4rem)] overflow-hidden">
    <!-- Chat Sidebar -->
    <ChatSidebar
      :threads="threads.map(t => ({
        id: t.id,
        title: t.title,
        lastMessage: t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleDateString() : '',
      }))"
      :active-thread-id="activeThreadId ?? undefined"
      @select="handleSelectThread"
      @delete="handleDeleteThread"
      @new-thread="handleNewThread"
    />

    <!-- Main Chat Area -->
    <div class="flex-1 flex flex-col bg-white dark:bg-neutral-950">
      <!-- Chat Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
        <div class="flex items-center gap-3">
          <UAvatar icon="i-heroicons-sparkles" color="primary" />
          <div>
            <h1 class="text-lg font-semibold">MagicSync AI Assistant</h1>
            <p class="text-xs text-neutral-500">
              {{ activeThreadId ? 'Thread active' : 'New conversation' }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UButton icon="i-heroicons-arrow-path" color="neutral" variant="ghost" size="sm" @click="clearMessages()" />
        </div>
      </div>

      <!-- Messages Area -->
      <div class="flex-1 overflow-y-auto px-6 py-4">
        <!-- Loading threads -->
        <div v-if="isLoadingThreads" class="flex items-center justify-center h-full">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-neutral-400" />
        </div>

        <!-- Empty State -->
        <div v-else-if="!messages.length" class="flex flex-col items-center justify-center h-full">
          <UIcon name="i-heroicons-sparkles" class="w-16 h-16 text-primary-500 mb-4" />
          <h2 class="text-xl font-semibold mb-2">{{ t('welcome') }}</h2>
          <p class="text-neutral-500 mb-6 text-center max-w-md">
            {{ t('welcomeDescription') }}
          </p>
          <div class="flex flex-wrap gap-2 justify-center">
            <UButton
              v-for="suggestion in [t('suggestion1'), t('suggestion2'), t('suggestion3')]"
              :key="suggestion"
              :label="suggestion"
              color="neutral"
              variant="outline"
              size="sm"
              @click="handleSuggestionClick(suggestion)"
            />
          </div>
        </div>

        <!-- Messages -->
        <div v-else class="space-y-4">
          <template v-for="message in messages" :key="message.id">
            <!-- User Message -->
            <div v-if="message.role === 'user'" class="flex justify-end">
              <div class="max-w-[70%]">
                <UCard class="bg-primary-500 text-white rounded-2xl rounded-br-sm">
                  <p class="whitespace-pre-wrap">{{ message.content }}</p>
                </UCard>
              </div>
            </div>

            <!-- Assistant Message -->
            <div v-else class="flex gap-3">
              <UAvatar icon="i-heroicons-sparkles" size="sm" color="primary" />
              <div class="flex-1 max-w-[80%]">
                <div class="prose dark:prose-invert max-w-none">
                  <p class="whitespace-pre-wrap">{{ message.content }}</p>
                </div>
                <!-- A2UI Components -->
                <div v-if="message.a2uiComponents?.length" class="mt-3">
                  <A2UIChatRenderer :components="message.a2uiComponents" />
                </div>
              </div>
            </div>
          </template>

          <!-- Loading State -->
          <div v-if="isLoading" class="flex gap-3">
            <UAvatar icon="i-heroicons-sparkles" size="sm" color="primary" />
            <div class="flex items-center gap-2">
              <UChatShimmer />
            </div>
          </div>
        </div>

        <!-- Error State -->
        <div v-if="error" class="flex justify-center py-4">
          <UAlert :title="t('error')" :description="error.message" color="error" variant="soft" />
        </div>
      </div>

      <!-- Chat Input -->
      <div class="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700">
        <UChatPrompt
          v-model="input"
          :placeholder="t('placeholder')"
          :error="error ? error : undefined"
          @submit="onSubmit"
        >
          <UChatPromptSubmit
            :status="isLoading ? 'streaming' : 'ready'"
            @stop="() => isLoading = false"
            @reload="regenerateLast()"
          />
        </UChatPrompt>
      </div>
    </div>
  </div>
</template>

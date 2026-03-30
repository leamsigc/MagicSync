<i18n src="./chat.json"></i18n>

<script setup lang="ts">
import type { UIMessage } from 'ai'

const { t } = useI18n()
const input = ref('')

const threads = ref<Array<{ id: string; title: string; lastMessage: string }>>([])
const activeThreadId = ref<string | undefined>()

const chat = useA2UIChat()
const { components: a2uiComponents, connect: connectA2UI, isConnected } = useA2UI()

const showA2UI = computed(() => a2uiComponents.value.length > 0)

function onSubmit() {
  chat.sendMessage(input.value)
  input.value = ''
}

function handleNewThread() {
  chat.clearMessages()
  activeThreadId.value = undefined
}

function handleSelectThread(id: string) {
  activeThreadId.value = id
  // Load thread messages from backend
}

function handleDeleteThread(id: string) {
  threads.value = threads.value.filter(t => t.id !== id)
  if (activeThreadId.value === id) {
    handleNewThread()
  }
}

function handleA2UIAction(action: any) {
  const { components: a2uiComp, sendAction } = useA2UI()
  sendAction({
    action: action.action,
    surfaceId: 'chat-surface',
    componentId: action.componentId,
    payload: action.payload,
  })
}
</script>

<template>
  <div class="flex h-[calc(100vh-4rem)] overflow-hidden">
    <!-- Chat Sidebar -->
    <ChatSidebar
      :threads="threads"
      :active-thread-id="activeThreadId"
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
              {{ isConnected ? 'Connected' : 'Ready' }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UBadge
            v-if="showA2UI"
            label="A2UI"
            color="primary"
            variant="soft"
          />
          <UButton
            icon="i-heroicons-arrow-path"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="chat.clearMessages()"
          />
        </div>
      </div>

      <!-- Messages Area -->
      <div class="flex-1 overflow-y-auto px-6 py-4">
        <!-- Empty State -->
        <div v-if="!chat.messages.value.length" class="flex flex-col items-center justify-center h-full">
          <UIcon name="i-heroicons-sparkles" class="w-16 h-16 text-primary-500 mb-4" />
          <h2 class="text-xl font-semibold mb-2">{{ t('welcome') }}</h2>
          <p class="text-neutral-500 mb-6 text-center max-w-md">
            {{ t('welcomeDescription') }}
          </p>
          <div class="flex flex-wrap gap-2 justify-center">
            <UButton
              v-for="suggestion in [
                t('suggestion1'),
                t('suggestion2'),
                t('suggestion3'),
              ]"
              :key="suggestion"
              :label="suggestion"
              color="neutral"
              variant="outline"
              size="sm"
              @click="chat.sendMessage(suggestion)"
            />
          </div>
        </div>

        <!-- Messages -->
        <div v-else class="space-y-4">
          <template v-for="message in chat.messages.value" :key="message.id">
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
                  <A2UIChatRenderer
                    :components="message.a2uiComponents"
                    @action="handleA2UIAction"
                  />
                </div>
              </div>
            </div>
          </template>

          <!-- Loading State -->
          <div v-if="chat.isLoading.value" class="flex gap-3">
            <UAvatar icon="i-heroicons-sparkles" size="sm" color="primary" />
            <div class="flex items-center gap-2">
              <UChatShimmer />
            </div>
          </div>
        </div>

        <!-- Error State -->
        <div v-if="chat.error.value" class="flex justify-center py-4">
          <UAlert
            :title="t('error')"
            :description="chat.error.value.message"
            color="error"
            variant="soft"
          />
        </div>
      </div>

      <!-- Chat Input -->
      <div class="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700">
        <UChatPrompt
          v-model="input"
          :placeholder="t('placeholder')"
          :error="chat.error.value"
          @submit="onSubmit"
        >
          <UChatPromptSubmit
            :status="chat.isLoading.value ? 'streaming' : 'ready'"
            @stop="chat.isLoading.value = false"
            @reload="chat.regenerateLast()"
          />
        </UChatPrompt>
      </div>
    </div>
  </div>
</template>

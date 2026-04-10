<i18n src="./chat.json"></i18n>

<script setup lang="ts">
import { useA2UIChat } from './composables/useA2UIChat'
import ChatSidebar from './components/ChatSidebar.vue'
import ToolCallCard from './components/ToolCallCard.vue'


definePageMeta({ layout: 'ai-tools-layout' })

const { t } = useI18n()
const input = ref('')
const showToolsPanel = ref(false)
const enableTools = ref(true)

const availableTools = [
  { name: 'retrieve', description: 'Search your knowledge base', category: 'RAG' },
  { name: 'hybrid_search', description: 'Hybrid search across documents', category: 'RAG' },
  { name: 'web_search', description: 'Search the web for current info', category: 'Search' },
  { name: 'kb_ls', description: 'List documents in a folder', category: 'Knowledge Base' },
  { name: 'kb_tree', description: 'Show folder tree structure', category: 'Knowledge Base' },
  { name: 'kb_grep', description: 'Search pattern in documents', category: 'Knowledge Base' },
  { name: 'kb_glob', description: 'Find files by name pattern', category: 'Knowledge Base' },
  { name: 'kb_read', description: 'Read document content', category: 'Knowledge Base' },
  { name: 'generate_twitter_post', description: 'Generate Twitter post content', category: 'Social' },
  { name: 'load_skill', description: 'Load skill instructions', category: 'Skills' },
  { name: 'save_skill', description: 'Save a new skill', category: 'Skills' },
  { name: 'list_skills', description: 'List available skills', category: 'Skills' },
  { name: 'execute_code', description: 'Run Python code (sandbox)', category: 'Tools' },
]

const {
  messages,
  isStreaming,
  threads,
  isLoadingThreads,
  threadId: activeThreadId,
  sendMessage,
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
  sendMessage(input.value, enableTools.value)
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

function insertTool(toolName: string) {
  input.value += `[${toolName}] `
}

function getToolCallForPart(part: any, index: number, toolCalls: any[] = []): any {
  // First try to find by matching tool name
  const toolName = part.tool || ''
  const matchingToolCall = toolCalls?.find((tc: any) => tc.name === toolName)
  if (matchingToolCall) return matchingToolCall
  // Fallback to index-based access
  return toolCalls?.[index]
}

function getToolCallState(part: any, index: number, toolCalls: any[] = []): 'input-available' | 'output-available' | 'error' {
  const tc = getToolCallForPart(part, index, toolCalls)
  if (tc?.error) return 'error'
  if (tc?.result) return 'output-available'
  return 'input-available'
}

function getToolName(part: any): string {
  return part.tool || 'unknown'
}

function isReasoningPart(part: any): boolean {
  return part.type === 'thinking'
}

function isToolPart(part: any): boolean {
  return part.type === 'tool'
}

function isTextPart(part: any): boolean {
  return part.type === 'text'
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
          <UTooltip :text="enableTools ? 'Disable AI Tools' : 'Enable AI Tools'">
            <div class="flex items-center gap-1">
              <UButton :icon="enableTools ? 'i-lucide-wrench' : 'i-lucide-wrench'"
                :color="enableTools ? 'primary' : 'neutral'" variant="ghost" size="sm"
                @click="enableTools = !enableTools" />
              <span v-if="!enableTools" class="text-xs text-muted">Off</span>
            </div>
          </UTooltip>
          <UTooltip :text="'Show Available Tools'">
            <UButton icon="i-lucide-list" color="neutral" variant="ghost" size="sm"
              @click="showToolsPanel = !showToolsPanel" />
          </UTooltip>
          <UButton icon="i-lucide-rotate-cw" color="neutral" variant="ghost" size="sm" @click="createNewThread" />
        </div>
      </div>

      <div v-if="showToolsPanel" class="border-b border-muted bg-muted/20 p-4">
        <div class="max-w-3xl mx-auto">
          <h3 class="text-sm font-semibold mb-2">Available Tools</h3>
          <p class="text-xs text-muted mb-3">Click to insert tool reference into your message</p>
          <div class="flex flex-wrap gap-2">
            <UButton v-for="tool in availableTools" :key="tool.name" size="xs" variant="outline"
              @click="insertTool(tool.name)">
              {{ tool.name }}
            </UButton>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto px-6 py-4">
        <div class="flex flex-col gap-4">
          <div v-for="message in messages" :key="message.id" class="flex flex-col gap-2">
            <div v-if="message.role === 'user'" class="flex justify-end">
              <div class="bg-primary text-primary-foreground px-4 py-2 rounded-lg max-w-[80%]">
                {{ message.content }}
              </div>
            </div>

            <div v-else-if="message.role === 'assistant'" class="flex flex-col gap-2">
              <div v-if="message.reasoningContent" class="bg-muted/50 p-3 rounded text-sm">
                <p class="text-xs text-muted mb-1">Reasoning</p>
                <MDC :value="message.reasoningContent" class="*first:mt-0 *last:mb-0" />
              </div>

              <template v-for="(part, index) in message.parts" :key="`${message.id}-${part.type}-${index}`">
                <template v-if="isToolPart(part)">
                  <ToolCallCard :tool-call-id="getToolCallForPart(part, index, message.toolCalls)?.id || ''"
                    :tool-name="getToolName(part)"
                    :input="getToolCallForPart(part, index, message.toolCalls)?.args || {}"
                    :output="getToolCallForPart(part, index, message.toolCalls)?.result || ''"
                    :error="getToolCallForPart(part, index, message.toolCalls)?.error"
                    :state="getToolCallState(part, index, message.toolCalls)" />
                </template>
                <template v-else-if="isTextPart(part)">
                  <MDC v-if="part.text" :value="part.text" :cache-key="`${message.id}-${index}`"
                    class="prose prose-sm max-w-none" />
                </template>
              </template>

              <div v-if="isStreaming && message.id === messages[messages.length - 1]?.id"
                class="flex items-center gap-2 text-muted">
                <UIcon name="i-lucide-ellipsis" class="w-6 h-6 animate-bounce" />
                <span class="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!messages.length" class="flex flex-col items-center justify-center h-full">
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
          <form @submit.prevent="onSubmit" class="flex gap-2">
            <UInput v-model="input" :placeholder="t('placeholder')" class="flex-1" :disabled="isStreaming"
              @keydown.enter.prevent="onSubmit" />
            <UButton type="submit" :label="isStreaming ? 'Sending...' : 'Send'"
              :disabled="isStreaming || !input.trim()" />
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

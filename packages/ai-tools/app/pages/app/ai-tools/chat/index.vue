<i18n src="./chat.json"></i18n>

<script setup lang="ts">
import { useA2UIChat } from './composables/useA2UIChat'
import { useChatArtifacts } from './composables/useChatArtifacts'
import ChatSidebar from './components/ChatSidebar.vue'
import ToolCallCard from './components/ToolCallCard.vue'
import ArtifactCard from './components/ArtifactCard.vue'

interface ChatPart {
  type: string
  text?: string
  tool?: string
  [key: string]: unknown
}

interface ToolCallInfo {
  id: string
  name: string
  args: Record<string, unknown>
  result?: string
  error?: string
}

definePageMeta({ layout: 'ai-tools-layout' })

const { t } = useI18n()
const toast = useToast()
const input = ref('')
const showToolsPanel = ref(false)
const enableTools = ref(true)
const useBusinessContext = ref(false)
const activeBusinessId = useState<string | null>('business:id', () => null)
const contextReady = ref<boolean | null>(null)
const contextChecking = ref(false)
const savingArtifactId = ref<string | null>(null)

const {
  artifacts: threadArtifacts,
  busyId: artifactBusyId,
  fetchArtifacts,
  submitPostArtifact,
  refreshArtifact,
} = useChatArtifacts()

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
} = useA2UIChat()

async function refreshContextReadiness() {
  const id = activeBusinessId.value
  if (!id) {
    contextReady.value = null
    if (useBusinessContext.value) useBusinessContext.value = false
    return
  }
  contextChecking.value = true
  try {
    const res = await $fetch<{ data?: { brandedReady?: boolean } }>(`/api/v1/business/${id}/playbook/readiness`)
    contextReady.value = res.data?.brandedReady ?? false
  }
  catch {
    contextReady.value = false
  }
  finally {
    contextChecking.value = false
  }
}

function requireBusinessForContext(): boolean {
  if (!useBusinessContext.value || activeBusinessId.value) return true
  toast.add({ title: t('businessContext.needsBusiness'), icon: 'i-heroicons-x-circle', color: 'error' })
  return false
}

async function handleSaveMessageArtifact(messageId: string, text: string) {
  if (!activeBusinessId.value || !text.trim()) {
    return
  }
  savingArtifactId.value = messageId
  try {
    await submitPostArtifact(activeBusinessId.value, activeThreadId.value, text.trim())
  }
  finally {
    savingArtifactId.value = null
  }
}

async function handleArtifactChanged(id: string) {
  if (!activeBusinessId.value) {
    return
  }
  await refreshArtifact(activeBusinessId.value, id)
}

onMounted(() => {
  loadThreads()
  void refreshContextReadiness()
})

watch(activeBusinessId, () => {
  void refreshContextReadiness()
})

watch([activeThreadId, activeBusinessId], ([threadId, businessId]) => {
  void fetchArtifacts(businessId, threadId)
})

function buildBusinessContextOpts() {
  return {
    useBusinessContext: useBusinessContext.value,
    businessId: activeBusinessId.value ?? undefined,
  }
}

function onSubmit() {
  if (!input.value.trim()) return
  if (!requireBusinessForContext()) return
  sendMessage(input.value, enableTools.value, buildBusinessContextOpts())
  input.value = ''
}

function handleSuggestionSelect(suggestion: string) {
  if (!requireBusinessForContext()) return
  sendMessage(suggestion, enableTools.value, buildBusinessContextOpts())
}

function handleToggleTools() {
  enableTools.value = !enableTools.value
}

function handleToggleToolsPanel() {
  showToolsPanel.value = !showToolsPanel.value
}

function handleToggleBusinessContext() {
  if (!useBusinessContext.value && !activeBusinessId.value) {
    toast.add({ title: t('businessContext.needsBusiness'), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  useBusinessContext.value = !useBusinessContext.value
  if (useBusinessContext.value) void refreshContextReadiness()
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

function getToolCallForPart(part: ChatPart, index: number, toolCalls: ToolCallInfo[] = []): ToolCallInfo | undefined {
  const toolName = part.tool || ''
  const matchingToolCall = toolCalls?.find((tc: ToolCallInfo) => tc.name === toolName)
  if (matchingToolCall) return matchingToolCall
  return toolCalls?.[index]
}

function getToolCallState(part: ChatPart, index: number, toolCalls: ToolCallInfo[] = []): 'input-available' | 'output-available' | 'error' {
  const tc = getToolCallForPart(part, index, toolCalls)
  if (tc?.error) return 'error'
  if (tc?.result) return 'output-available'
  return 'input-available'
}

function getToolName(part: ChatPart): string {
  return part.tool || 'unknown'
}

function isReasoningPart(part: ChatPart): boolean {
  return part.type === 'thinking'
}

function isToolPart(part: ChatPart): boolean {
  return part.type === 'tool'
}

function isTextPart(part: ChatPart): boolean {
  return part.type === 'text'
}
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <ChatSidebar
:threads="threads.map(t => ({
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
              {{ activeThreadId ? t('threadActive') : t('newConversation') }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UTooltip :text="enableTools ? t('toolsDisable') : t('toolsEnable')">
            <div class="flex items-center gap-1">
              <UButton
:icon="enableTools ? 'i-lucide-wrench' : 'i-lucide-wrench'"
                :color="enableTools ? 'primary' : 'neutral'" variant="ghost" size="sm"
                @click="handleToggleTools" />
              <span v-if="!enableTools" v-motion-fade :duration="200" class="text-xs text-muted">{{ t('toolsOff') }}</span>
            </div>
          </UTooltip>
          <UTooltip :text="activeBusinessId ? (useBusinessContext ? t('businessContext.disable') : t('businessContext.enable')) : t('businessContext.noBusiness')">
            <div class="flex items-center gap-1">
              <UButton
icon="i-lucide-building-2"
                data-testid="business-context-toggle"
                :color="useBusinessContext ? 'primary' : 'neutral'" variant="ghost" size="sm"
                :disabled="!activeBusinessId"
                @click="handleToggleBusinessContext" />
              <span v-if="!useBusinessContext" v-motion-fade :duration="200" class="text-xs text-muted">{{ t('businessContext.off') }}</span>
              <UBadge
                v-else-if="contextReady === true"
                v-motion-fade
                :duration="200"
                color="success"
                variant="subtle"
                size="xs"
              >
                {{ t('businessContext.ready') }}
              </UBadge>
              <NuxtLink
                v-else-if="contextReady === false && activeBusinessId"
                v-motion-fade
                :duration="200"
                :to="`/app/business/${activeBusinessId}/playbook`"
                data-testid="business-context-cta"
                class="text-xs text-warning underline"
              >
                {{ t('businessContext.notReady') }}
              </NuxtLink>
            </div>
          </UTooltip>
          <UTooltip :text="t('showTools')">
            <UButton
icon="i-lucide-list" color="neutral" variant="ghost" size="sm"
              @click="handleToggleToolsPanel" />
          </UTooltip>
          <UButton icon="i-lucide-rotate-cw" color="neutral" variant="ghost" size="sm" @click="handleNewThread" />
        </div>
      </div>

      <div v-if="showToolsPanel" v-motion-slide-bottom :duration="250" class="border-b border-muted bg-muted/20 p-4">
        <div class="max-w-3xl mx-auto">
          <h3 class="text-sm font-semibold mb-2">{{ t('availableTools') }}</h3>
          <p class="text-xs text-muted mb-3">{{ t('toolsHint') }}</p>
          <div class="flex flex-wrap gap-2">
            <UButton
v-for="tool in availableTools" :key="tool.name" size="xs" variant="outline"
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
                <p class="text-xs text-muted mb-1">{{ t('reasoning') }}</p>
                <MDC :value="message.reasoningContent" class="*first:mt-0 *last:mb-0" />
              </div>

              <template v-for="(part, index) in message.parts" :key="`${message.id}-${part.type}-${index}`">
                <template v-if="isToolPart(part)">
                  <ToolCallCard
:tool-call-id="getToolCallForPart(part, index, message.toolCalls)?.id || ''"
                    :tool-name="getToolName(part)"
                    :input="getToolCallForPart(part, index, message.toolCalls)?.args || {}"
                    :output="getToolCallForPart(part, index, message.toolCalls)?.result || ''"
                    :error="getToolCallForPart(part, index, message.toolCalls)?.error"
                    :state="getToolCallState(part, index, message.toolCalls)" />
                </template>
                <template v-else-if="isTextPart(part)">
                  <MDC
v-if="part.text" :value="part.text" :cache-key="`${message.id}-${index}`"
                    class="prose prose-sm max-w-none" />
                  <div v-if="part.text && message.role === 'assistant' && activeBusinessId" class="mt-1">
                    <UButton
                      size="xs" variant="ghost" color="neutral" icon="i-heroicons-bookmark"
                      :loading="savingArtifactId === message.id || artifactBusyId === 'new'"
                      @click="handleSaveMessageArtifact(message.id, part.text ?? '')"
                    >
                      {{ t('artifacts.saveAs') }}
                    </UButton>
                  </div>
                </template>
              </template>

              <div
v-if="isStreaming && message.id === messages[messages.length - 1]?.id"
                class="flex items-center gap-2 text-muted">
                <UIcon name="i-lucide-ellipsis" class="w-6 h-6 animate-bounce" />
                <span class="text-sm">{{ t('thinking') }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="threadArtifacts.length > 0 && activeBusinessId" v-motion-fade :duration="250" class="mx-auto w-full max-w-3xl space-y-3">
          <p class="text-xs font-semibold text-muted">{{ t('artifacts.section') }}</p>
          <ArtifactCard
            v-for="artifact in threadArtifacts"
            :key="artifact.id"
            :artifact="artifact"
            :business-id="activeBusinessId"
            @changed="handleArtifactChanged"
          />
        </div>

        <div v-if="!messages.length" v-motion-fade :duration="200" class="flex flex-col items-center justify-center h-full">
          <div class="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <UIcon name="i-lucide-sparkles" class="w-8 h-8 text-primary" />
          </div>
          <h2 class="text-xl font-semibold mb-2">{{ t('welcome') }}</h2>
          <p class="text-muted mb-6 text-center max-w-md">
            {{ t('welcomeDescription') }}
          </p>
          <div class="flex flex-wrap gap-2 justify-center">
            <UButton
v-for="suggestion in [t('suggestion1'), t('suggestion2'), t('suggestion3')]" :key="suggestion"
              :label="suggestion" color="neutral" variant="outline" size="sm"
              @click="handleSuggestionSelect(suggestion)" />
          </div>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-muted">
        <div class="max-w-3xl mx-auto">
          <form class="flex gap-2" @submit.prevent="onSubmit">
            <UInput
v-model="input" :placeholder="t('placeholder')" class="flex-1" :disabled="isStreaming"
              @keydown.enter.prevent="onSubmit" />
            <UButton
type="submit" :label="isStreaming ? t('sending') : t('send')"
              :disabled="isStreaming || !input.trim()" />
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

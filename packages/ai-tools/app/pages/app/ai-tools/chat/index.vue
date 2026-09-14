<i18n src="./chat.json"></i18n>

<script setup lang="ts">
import {
  getToolOrDynamicToolName,
  isDynamicToolUIPart,
  isReasoningUIPart,
  isTextUIPart,
  type DynamicToolUIPart,
  type UIMessage,
  type UIMessagePart,
} from 'ai'
import { isPartStreaming, isToolStreaming } from '@nuxt/ui/utils/ai'
import { useA2UIChat, type ChatMessage } from './composables/useA2UIChat'
import { useChatArtifacts, type ChatArtifact } from './composables/useChatArtifacts'
import ChatSidebar from './components/ChatSidebar.vue'
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

definePageMeta({ layout: false })

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const input = ref('')
const showToolsPanel = ref(false)
const enableTools = ref(true)
const useBusinessContext = ref(false)
const privateMode = ref(false)
const activeBusinessId = useState<string | null>('business:id', () => null)
const contextReady = ref<boolean | null>(null)
const contextChecking = ref(false)
const savingArtifactId = ref<string | null>(null)
const activeAgent = ref('content-writer')
const activeSkill = ref('')
const activeBusinessName = ref('')

interface CardContextItem {
  id: string
  title: string
  brief: string
  state: string
  platforms: string[] | null
  artifactId: string | null
}

const cardContext = ref<CardContextItem | null>(null)
const cardArtifact = ref<ChatArtifact | null>(null)
const cardLoading = ref(false)
const cardError = ref<string | null>(null)

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

const agentOptions = computed(() => [
  { label: t('agents.contentWriter'), value: 'content-writer' },
  { label: t('agents.socialStrategist'), value: 'social-strategist' },
  { label: t('agents.brandAnalyst'), value: 'brand-analyst' },
  { label: t('agents.researchAgent'), value: 'research-agent' },
  { label: t('agents.creativeDirector'), value: 'creative-director' },
])

const skillOptions = computed(() => [
  { label: t('skillOptions.none'), value: '' },
  { label: t('skillOptions.seoOptimizer'), value: 'seo-optimizer' },
  { label: t('skillOptions.hashtagGenerator'), value: 'hashtag-generator' },
  { label: t('skillOptions.contentCalendar'), value: 'content-calendar' },
  { label: t('skillOptions.competitorAnalysis'), value: 'competitor-analysis' },
])

const activeAgentLabel = computed(() => agentOptions.value.find(a => a.value === activeAgent.value)?.label ?? t('header.agent'))
const activeSkillLabel = computed(() => skillOptions.value.find(s => s.value === activeSkill.value)?.label ?? t('header.skills'))

const businessMenuItems = computed(() => [
  { label: t('header.business'), icon: 'i-lucide-building-2', disabled: true },
  ...(businessOptions.value.length > 0
    ? businessOptions.value.map(b => ({ label: b.label, icon: b.value === activeBusinessId.value ? 'i-lucide-check' : 'i-lucide-building-2', onSelect: () => handleSelectBusiness(b.value) }))
    : [{ label: t('header.noBusinesses'), icon: 'i-lucide-plus', onSelect: handleGoToBusinesses }]),
  { type: 'separator' as const },
  { label: t('allBusinesses'), icon: 'i-lucide-globe', onSelect: () => handleSelectBusiness(null) },
])

const agentMenuItems = computed(() => agentOptions.value.map(a => ({
  label: a.label,
  icon: a.value === activeAgent.value ? 'i-lucide-check' : 'i-lucide-bot',
  onSelect: () => handleSelectAgent(a.value),
})))

const skillMenuItems = computed(() => skillOptions.value.map(s => ({
  label: s.label,
  icon: s.value === activeSkill.value ? 'i-lucide-check' : 'i-lucide-wand-2',
  onSelect: () => handleSelectSkill(s.value),
})))

const businessOptions = ref<Array<{ label: string; value: string }>>([])

async function fetchBusinesses() {
  try {
    const res = await $fetch<{ data?: Array<{ id: string; name: string }> }>('/api/v1/business')
    businessOptions.value = (res.data ?? []).map(b => ({ label: b.name, value: b.id }))
  }
  catch (err: unknown) {
    toast.add({ title: t('businessContext.loadFailed'), description: err instanceof Error ? err.message : undefined, icon: 'i-heroicons-x-circle', color: 'error' })
  }
}

async function handleSelectBusiness(id: string | null) {
  if (!id) {
    activeBusinessId.value = null
    activeBusinessName.value = ''
    useBusinessContext.value = false
    return
  }
  activeBusinessId.value = id
  useBusinessContext.value = true
  try {
    const res = await $fetch<{ data?: { name?: string } }>(`/api/v1/business/${id}`)
    activeBusinessName.value = res.data?.name ?? ''
  }
  catch (err: unknown) {
    toast.add({ title: t('businessContext.loadFailed'), description: err instanceof Error ? err.message : undefined, icon: 'i-heroicons-x-circle', color: 'error' })
  }
}

function handleSelectAgent(value: string) {
  activeAgent.value = value
}

function handleSelectSkill(value: string) {
  activeSkill.value = value
}

function handleGoToBusinesses() {
  router.push('/app/business')
}

const {
  messages,
  isStreaming,
  threads,
  isLoadingThreads,
  threadId: activeThreadId,
  artifactSignal,
  sendMessage,
  abortStream,
  loadThreads,
  loadThreadMessages,
  createNewThread,
  deleteThread,
} = useA2UIChat()

const chatStatus = computed(() => isStreaming.value ? 'streaming' : 'ready')

const chatMessages = computed<UIMessage[]>(() => {
  const streaming = isStreaming.value
  return messages.value.map((message, index) => ({
    id: message.id,
    role: message.role,
    parts: toChatParts(message, streaming && index === messages.value.length - 1),
  }))
})

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
  if (activeBusinessId.value) return true
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

function firstQuery(value: unknown): string | null {
  const single = Array.isArray(value) ? value[0] : value
  return typeof single === 'string' && single ? single : null
}

function cardErrorMessage(error: unknown): string {
  const data = (error as { data?: { statusMessage?: string, message?: string } } | null)?.data
  return data?.statusMessage || data?.message || (error instanceof Error ? error.message : String(error))
}

async function loadCardContext(businessId: string, cardId: string) {
  cardLoading.value = true
  cardError.value = null
  try {
    const detail = await $fetch<{ item: CardContextItem }>(`/api/v1/content-items/${cardId}`, {
      query: { businessId },
    })
    cardContext.value = detail.item
    if (detail.item.artifactId) {
      const res = await $fetch<{ success: boolean, data?: ChatArtifact }>(`/api/v1/artifacts/${detail.item.artifactId}`, {
        query: { businessId },
      })
      if (res.data) cardArtifact.value = res.data
    }
  }
  catch (error: unknown) {
    cardError.value = cardErrorMessage(error)
    toast.add({ title: t('cardContext.loadFailed', { error: cardError.value }), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    cardLoading.value = false
  }
}

async function initFromRoute() {
  await fetchBusinesses()
  const businessId = firstQuery(route.query.businessId)
  if (businessId) {
    await handleSelectBusiness(businessId)
  }
  else {
    maybePreselectSingleBusiness()
  }
  await refreshContextReadiness()
  const cardId = firstQuery(route.query.cardId)
  if (businessId && cardId) await loadCardContext(businessId, cardId)
}

function handleBackToBoard() {
  const bid = activeBusinessId.value
  router.push(bid ? `/app/business/${bid}/content` : '/app/business')
}

function handleDismissCard() {
  cardContext.value = null
  cardArtifact.value = null
  cardError.value = null
}

function handleAskAboutCard() {
  if (!cardContext.value) return
  input.value = t('cardContext.promptPrefix', { title: cardContext.value.title })
}

async function handleCardArtifactChanged(id: string) {
  const bid = activeBusinessId.value
  if (!bid) return
  try {
    const res = await $fetch<{ success: boolean, data?: ChatArtifact }>(`/api/v1/artifacts/${id}`, {
      query: { businessId: bid },
    })
    if (res.data) cardArtifact.value = res.data
  }
  catch (error: unknown) {
    toast.add({ title: t('artifacts.loadFailed'), description: cardErrorMessage(error), icon: 'i-heroicons-x-circle', color: 'error' })
  }
}

onMounted(() => {
  loadThreads()
  void initFromRoute()
  void fetchBusinesses()
})

watch(activeBusinessId, () => {
  void refreshContextReadiness()
})

watch([activeThreadId, activeBusinessId], ([threadId, businessId]) => {
  void fetchArtifacts(businessId, threadId)
})

watch(artifactSignal, () => {
  void fetchArtifacts(activeBusinessId.value ?? undefined, activeThreadId.value)
  void refreshCardAfterAgent()
})

function buildBusinessContextOpts() {
  return {
    useBusinessContext: useBusinessContext.value,
    businessId: activeBusinessId.value ?? undefined,
    privateMode: privateMode.value,
    cardId: cardContext.value?.id ?? undefined,
    agent: activeAgent.value,
    skill: activeSkill.value,
  }
}

function maybePreselectSingleBusiness() {
  if (activeBusinessId.value) return
  if (businessOptions.value.length !== 1) return
  const only = businessOptions.value[0]
  if (!only) return
  activeBusinessId.value = only.value
  activeBusinessName.value = only.label
  useBusinessContext.value = true
}

async function refreshCardAfterAgent() {
  if (!cardContext.value || !activeBusinessId.value) return
  if (cardArtifact.value) await handleCardArtifactChanged(cardArtifact.value.id)
  else await loadCardContext(activeBusinessId.value, cardContext.value.id)
}

function handleTogglePrivateMode() {
  privateMode.value = !privateMode.value
  toast.add({
    title: privateMode.value ? t('privateMode.enable') : t('privateMode.disable'),
    icon: privateMode.value ? 'i-lucide-shield-check' : 'i-lucide-shield-off',
    color: privateMode.value ? 'success' : 'neutral',
  })
}

function onSubmit() {
  if (isStreaming.value) return
  if (!input.value.trim()) return
  if (!requireBusinessForContext()) return
  sendMessage(input.value, buildBusinessContextOpts())
  input.value = ''
}

function handleSuggestionSelect(suggestion: string) {
  if (!requireBusinessForContext()) return
  sendMessage(suggestion, buildBusinessContextOpts())
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

function toToolPart(call: ToolCallInfo): DynamicToolUIPart {
  const base = { type: 'dynamic-tool' as const, toolName: call.name, toolCallId: call.id, input: call.args }
  if (call.error) return { ...base, state: 'output-error' as const, errorText: call.error }
  if (call.result) return { ...base, state: 'output-available' as const, output: call.result }
  return { ...base, state: 'input-available' as const }
}

function toChatParts(message: ChatMessage, streaming: boolean): UIMessagePart[] {
  const streamState = streaming ? 'streaming' : 'done'
  const uiParts: UIMessagePart[] = []
  if (message.reasoningContent) {
    uiParts.push({ type: 'reasoning', text: message.reasoningContent, state: streamState })
  }
  for (const [index, part] of (message.parts ?? []).entries()) {
    if (part.type === 'tool') {
      const call = getToolCallForPart(part, index, message.toolCalls)
      uiParts.push(call ? toToolPart(call) : {
        type: 'dynamic-tool', toolName: part.tool || 'unknown', toolCallId: `${message.id}-${index}`, state: 'input-available', input: {},
      })
    }
    else {
      uiParts.push({ type: 'text', text: part.text ?? '', state: streamState })
    }
  }
  return uiParts
}

function formatToolInput(input: unknown): string {
  if (typeof input === 'object') return JSON.stringify(input, null, 2)
  return String(input)
}

function toolOutputText(part: DynamicToolUIPart): string {
  const output = 'output' in part ? part.output : undefined
  if (output === undefined) return ''
  return formatToolInput(output)
}

function toolErrorText(part: DynamicToolUIPart): string {
  const text = 'errorText' in part ? part.errorText : undefined
  return typeof text === 'string' ? text : ''
}
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-[#111111]">
    <ChatSidebar
      :threads="threads.map(t => ({
        id: t.id,
        title: t.title,
        lastMessage: t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleDateString() : '',
      }))" :active-thread-id="activeThreadId ?? undefined" @select="handleSelectThread" @delete="handleDeleteThread"
      @new-thread="handleNewThread" />

    <div class="flex-1 flex flex-col">
      <header class="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-[#1a1a1a]/80 backdrop-blur-xl">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
            <UIcon name="i-lucide-sparkles" class="w-4 h-4 text-white" />
          </div>
          <h1 class="text-sm font-semibold text-white/90">{{ t('welcome') }}</h1>
          <UBadge v-if="activeThreadId" color="primary" variant="subtle" size="xs">{{ t('threadActive') }}</UBadge>
        </div>
        <div class="flex items-center gap-2">
          <UDropdownMenu :items="businessMenuItems" :ui="{ content: 'w-56' }">
            <UButton icon="i-lucide-building-2" variant="ghost" size="sm" :label="activeBusinessName || t('header.business')" :class="activeBusinessId ? 'text-primary' : 'text-white/40'" />
          </UDropdownMenu>
          <UDropdownMenu :items="agentMenuItems" :ui="{ content: 'w-48' }">
            <UButton icon="i-lucide-bot" variant="ghost" size="sm" :label="activeAgentLabel" color="white" />
          </UDropdownMenu>
          <UDropdownMenu :items="skillMenuItems" :ui="{ content: 'w-48' }">
            <UButton icon="i-lucide-wand-2" variant="ghost" size="sm" :label="activeSkillLabel" color="white" />
          </UDropdownMenu>
          <UTooltip :text="privateMode ? t('privateMode.disable') : t('privateMode.enable')">
            <UButton icon="i-lucide-shield" :color="privateMode ? 'primary' : 'neutral'" variant="ghost" size="sm" @click="handleTogglePrivateMode" />
          </UTooltip>
          <UButton icon="i-lucide-rotate-cw" color="neutral" variant="ghost" size="sm" @click="handleNewThread" />
        </div>
      </header>

      <div v-if="cardLoading" class="border-b border-white/5" data-testid="card-context-loading">
        <div class="mx-auto flex w-full max-w-3xl items-center gap-2 px-6 py-3 text-xs text-white/40">
          <UIcon name="i-heroicons-arrow-path" class="size-4 animate-spin" />
          {{ t('cardContext.loading') }}
        </div>
      </div>

      <div
        v-else-if="cardContext"
        v-motion-fade
        :duration="250"
        class="border-b border-white/5 bg-white/[0.03] p-4"
        data-testid="card-context"
      >
        <div class="mx-auto w-full max-w-3xl space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-heroicons-arrow-left"
              @click="handleBackToBoard"
              class="text-white/50"
            >
              {{ t('cardContext.back') }}
            </UButton>
            <h2 class="min-w-0 flex-1 truncate text-sm font-semibold text-white/90">{{ cardContext.title }}</h2>
            <UBadge color="primary" variant="subtle" size="xs">{{ cardContext.state }}</UBadge>
            <UBadge
              v-for="platform in cardContext.platforms ?? []"
              :key="platform"
              color="neutral"
              variant="outline"
              size="xs"
              class="text-white/50"
            >
              {{ platform }}
            </UBadge>
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-heroicons-x-mark"
              :aria-label="t('cardContext.dismiss')"
              @click="handleDismissCard"
              class="text-white/40"
            />
          </div>
          <p v-if="cardContext.brief" class="line-clamp-3 text-xs text-white/40">{{ cardContext.brief }}</p>
          <p v-if="cardError" class="text-xs text-red-400">{{ cardError }}</p>
          <ArtifactCard
            v-if="cardArtifact && activeBusinessId"
            :artifact="cardArtifact"
            :business-id="activeBusinessId"
            :item-id="cardContext?.id ?? null"
            @changed="handleCardArtifactChanged"
          />
          <p v-else-if="!cardError" class="text-xs text-white/30">{{ t('cardContext.noArtifact') }}</p>
          <div>
            <UButton
              size="xs"
              variant="outline"
              color="neutral"
              icon="i-lucide-sparkles"
              @click="handleAskAboutCard"
              class="border-white/10 text-white/50 hover:text-white"
            >
              {{ t('cardContext.askMe') }}
            </UButton>
          </div>
        </div>
      </div>

      <div v-if="showToolsPanel" v-motion-slide-bottom :duration="250" class="border-b border-white/5 bg-white/[0.03] p-4">
        <div class="max-w-3xl mx-auto">
          <h3 class="text-sm font-semibold mb-2 text-white/70">{{ t('availableTools') }}</h3>
          <p class="text-xs text-white/30 mb-3">{{ t('toolsHint') }}</p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="tool in availableTools" :key="tool.name" size="xs" variant="outline"
              class="border-white/10 text-white/50 hover:text-white hover:border-white/20"
              @click="insertTool(tool.name)">
              {{ tool.name }}
            </UButton>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto px-6 py-4">
        <UChatMessages :messages="chatMessages" :status="chatStatus" class="mx-auto w-full max-w-3xl">
          <template #content="{ message }">
            <template v-for="(part, index) in message.parts" :key="`${message.id}-${part.type}-${index}`">
              <UChatReasoning
                v-if="isReasoningUIPart(part)"
                :text="t('reasoning')"
                :streaming="isPartStreaming(part)"
                class="text-white/70"
              >
                <MDC :value="part.text" class="*:first:mt-0 *:last:mb-0" />
              </UChatReasoning>

              <UChatTool
                v-else-if="isDynamicToolUIPart(part)"
                :text="getToolOrDynamicToolName(part)"
                :streaming="isToolStreaming(part)"
              >
                <div class="space-y-2">
                  <div>
                    <p class="text-xs text-white/40 font-semibold mb-1">{{ t('toolCall.input') }}</p>
                    <pre class="text-xs bg-white/5 dark:bg-white/5 rounded p-2 overflow-x-auto text-white/60">{{ formatToolInput(part.input) }}</pre>
                  </div>
                  <div v-if="toolOutputText(part)">
                    <p class="text-xs text-white/40 font-semibold mb-1">{{ t('toolCall.output') }}</p>
                    <pre class="text-xs bg-green-500/10 rounded p-2 overflow-x-auto border border-green-500/20 text-green-300">{{ toolOutputText(part) }}</pre>
                  </div>
                  <div v-if="toolErrorText(part)">
                    <p class="text-xs text-white/40 font-semibold mb-1">{{ t('toolCall.error') }}</p>
                    <pre class="text-xs bg-red-500/10 rounded p-2 overflow-x-auto border border-red-500/20 text-red-400">{{ toolErrorText(part) }}</pre>
                  </div>
                </div>
              </UChatTool>

              <template v-else-if="isTextUIPart(part)">
                <MDC
                  v-if="part.text && message.role === 'assistant'"
                  :value="part.text"
                  :cache-key="`${message.id}-${index}`"
                  class="prose prose-sm max-w-none text-white/80"
                />
                <p v-else-if="part.text" class="whitespace-pre-wrap text-white/80">
                  {{ part.text }}
                </p>
                <div v-if="part.text && message.role === 'assistant' && activeBusinessId" class="mt-1">
                  <UButton
                    size="xs" variant="ghost" color="neutral" icon="i-heroicons-bookmark"
                    :loading="savingArtifactId === message.id || artifactBusyId === 'new'"
                    @click="handleSaveMessageArtifact(message.id, part.text ?? '')"
                    class="text-white/40 hover:text-white"
                  >
                    {{ t('artifacts.saveAs') }}
                  </UButton>
                </div>
              </template>
            </template>
          </template>
        </UChatMessages>

        <div v-if="threadArtifacts.length > 0 && activeBusinessId" v-motion-fade :duration="250" class="mx-auto w-full max-w-3xl space-y-3">
          <p class="text-xs font-semibold text-white/30">{{ t('artifacts.section') }}</p>
          <ArtifactCard
            v-for="artifact in threadArtifacts"
            :key="artifact.id"
            :artifact="artifact"
            :business-id="activeBusinessId"
            @changed="handleArtifactChanged"
          />
        </div>

        <div v-if="!messages.length" v-motion-fade :duration="200" class="flex flex-col items-center justify-center h-full">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center mb-4">
            <UIcon name="i-lucide-sparkles" class="w-8 h-8 text-primary" />
          </div>
          <h2 class="text-xl font-semibold mb-2 text-white/90">{{ t('welcome') }}</h2>
          <p class="text-white/40 mb-6 text-center max-w-md">
            {{ t('welcomeDescription') }}
          </p>
          <div class="flex flex-wrap gap-2 justify-center">
            <UButton
              v-for="suggestion in [t('suggestion1'), t('suggestion2'), t('suggestion3')]" :key="suggestion"
              :label="suggestion" color="neutral" variant="outline" size="sm"
              class="border-white/10 text-white/50 hover:text-white hover:border-white/20"
              @click="handleSuggestionSelect(suggestion)" />
          </div>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-white/5 bg-[#1a1a1a]">
        <div class="max-w-3xl mx-auto">
          <UChatPrompt
            v-model="input"
            :placeholder="t('placeholder')"
            :disabled="isStreaming"
            @submit="onSubmit"
          >
            <UChatPromptSubmit :status="chatStatus" @stop="abortStream" />
          </UChatPrompt>
        </div>
      </div>
    </div>
  </div>
</template>

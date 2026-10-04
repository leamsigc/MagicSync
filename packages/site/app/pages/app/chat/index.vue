<i18n src="./chat.json"></i18n>

<script setup lang="ts">

import { useAgentChat } from '#layers/BaseAITools/app/composables/ai-tools/chat/useAgentChat'
import { useBusinessManager } from '#layers/BaseShared/app/composables/useBusinessManager'
import GoalRunner from '#layers/BaseAITools/app/components/ai-tools/chat/GoalRunner.vue'
import RunCard from '#layers/BaseAITools/app/components/ai-tools/chat/RunCard.vue'
import ChatSidebar from '#layers/BaseAITools/app/components/ai-tools/chat/ChatSidebar.vue'
import OperatorEmpty from '#layers/BaseAITools/app/components/ai-tools/chat/OperatorEmpty.vue'
import { useOperatorApprovals } from '#layers/BaseAITools/app/composables/ai-tools/chat/useOperatorConsole'
import OperatorApprovalsRail from '#layers/BaseAITools/app/components/ai-tools/chat/OperatorApprovalsRail.vue'
import OperatorActivityFeed from '#layers/BaseAITools/app/components/ai-tools/chat/OperatorActivityFeed.vue'
import OperatorSafeModeBadge from '#layers/BaseAITools/app/components/ai-tools/chat/OperatorSafeModeBadge.vue'
import MorningReportCard from '#layers/BaseAITools/app/components/ai-tools/chat/MorningReportCard.vue'

const { t, te } = useI18n()
const toast = useToast()
const router = useRouter()

const input = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const revisionTarget = ref<{ artifactId: string, slideId: string, version: number } | null>(null)

/** The one resolution of "which business am I working on" — see useBusinessManager. */
const { activeBusinessId } = useBusinessManager()

const {
  messages,
  isStreaming,
  sendMessage,
  cancelActiveRun,
  isCancelling,
  sessionId,
  setSession,
  loadThreads,
  createNewThread,
  threads,
  isLoadingThreads,
  threadId,
  loadThreadMessages,
  deleteThread,
} = useAgentChat()

const hasConversation = computed(() => messages.value.length > 0)
const needsBusiness = computed(() => !activeBusinessId.value)
const canSend = computed(() => !isStreaming.value && !needsBusiness.value)

const showSidebar = ref(false)
const sidebarCollapsed = ref(false)

const route = useRoute()
const cardId = ref<string | null>(null)
const cardTitle = ref('')

function handleCarouselRevision(intent: { artifactId: string, slideId: string, version: number }) {
  if (isStreaming.value) return
  revisionTarget.value = intent
  toast.add({ title: t('carousel.revisionReady'), color: 'info' })
}

function handleCancelRevision() {
  revisionTarget.value = null
  toast.add({ title: t('carousel.revisionCancelled'), color: 'info' })
}

function handleCancelRun(): void {
  void cancelActiveRun()
}

function messageContent(): string {
  if (!revisionTarget.value) return input.value
  if (!revisionTarget.value.slideId) {
    return t('carousel.revisionMessageOpen', {
      artifactId: revisionTarget.value.artifactId,
      version: revisionTarget.value.version,
      feedback: input.value.trim(),
    })
  }
  return t('carousel.revisionMessage', { ...revisionTarget.value, feedback: input.value.trim() })
}

function selectedSkills(values: string[]): string[] | undefined {
  return values.length > 0 ? values : undefined
}

function onSubmit() {
  if (isStreaming.value) return
  if (!input.value.trim()) return
  if (!activeBusinessId.value) {
    toast.add({ title: t('needBusinessTitle'), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  void sendMessage(messageContent(), {
    businessId: activeBusinessId.value,
    cardId: cardId.value ?? undefined,
    agentName: selection.value.agentName ?? undefined,
    allowedTools: selection.value.tools ?? undefined,
    skillSlugs: selectedSkills(selection.value.skillSlugs),
    registeredSkillIds: selectedSkills(selection.value.registeredSkillIds),
  })
  revisionTarget.value = null
  input.value = ''
  showSidebar.value = false
}

async function handleCopy(content: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(content)
    toast.add({ title: t('copied'), color: 'success', icon: 'i-heroicons-check' })
  }
  catch (error: unknown) {
    toast.add({ title: t('copyFailed'), description: error instanceof Error ? error.message : undefined, color: 'error', icon: 'i-heroicons-x-circle' })
  }
}

function handleRegenerate(index: number): void {
  const previousUser = [...messages.value.slice(0, index)].reverse().find(message => message.role === 'user')
  if (!previousUser) return
  input.value = previousUser.content
  onSubmit()
}

function handleFeedback(kind: 'positive' | 'negative'): void {
  toast.add({ title: kind === 'positive' ? t('helpful') : t('notHelpful'), color: 'neutral' })
}

/** A suggestion button inside the scheduled morning report card. */
function handleMorningReportPrompt(prompt: string) {
  input.value = prompt
  onSubmit()
}

/** The header action asks the operator for its morning review, then streams it here. */
function handleMorningReview(): void {
  if (!canSend.value) return
  input.value = t('operator.prompts.morningReview')
  onSubmit()
}

function handleNewChat() {
  revisionTarget.value = null
  createNewThread()
  showSidebar.value = false
}

async function handleSelectThread(id: string) {
  await loadThreadMessages(id)
  showSidebar.value = false
}

async function handleDeleteThread(id: string) {
  await deleteThread(id)
  toast.add({ title: t('history.delete'), color: 'success' })
}

function handleCollapseSidebar() {
  sidebarCollapsed.value = true
  showSidebar.value = false
}

function handleToggleSidebar() {
  if (sidebarCollapsed.value) {
    sidebarCollapsed.value = false
    showSidebar.value = true
  } else {
    showSidebar.value = !showSidebar.value
  }
}

function firstQuery(value: unknown): string | null {
  const single = Array.isArray(value) ? value[0] : value
  return typeof single === 'string' && single ? single : null
}

async function loadCardTitle(businessId: string, id: string) {
  try {
    const detail = await $fetch<{ item?: { title?: string } }>(`/api/v1/content-items/${id}`, {
      query: { businessId },
    })
    if (detail.item?.title) cardTitle.value = detail.item.title
  }
  catch {
    cardTitle.value = ''
  }
}

function handleDismissCard() {
  cardId.value = null
  cardTitle.value = ''
}

async function initFromRoute() {
  const businessId = firstQuery(route.query.businessId)
  if (businessId) activeBusinessId.value = businessId
  const id = firstQuery(route.query.cardId)
  if (businessId && id) {
    cardId.value = id
    await loadCardTitle(businessId, id)
  }
  const thread = firstQuery(route.query.threadId)
  if (thread) {
    try {
      localStorage.setItem('ai-chat-thread-id', thread)
    } catch { /* ignore */ }
    await loadThreadMessages(thread)
  }
}

watch(() => route.query.threadId, (next, prev) => {
  if (next === prev) return
  const thread = firstQuery(next)
  if (thread && thread !== threadId.value) {
    void loadThreadMessages(thread)
  }
})

function handleGoToBusinesses() {
  router.push('/app/business')
}

interface CapabilityAgent {
  name: string
  description: string
  tools: string[]
}

interface CapabilityTool {
  name: string
  group: string
  description: string
}

interface CapabilitySkill {
  slug?: string
  id?: string
  name: string
  description: string
  scope: string
}

interface Capabilities {
  agents: CapabilityAgent[]
  tools: CapabilityTool[]
  skills: { bundled: CapabilitySkill[], registered: CapabilitySkill[] }
}

interface CapabilitySelection {
  agentName: string | null
  tools: string[] | null
  skillSlugs: string[]
  registeredSkillIds: string[]
}

function defaultSelection(): CapabilitySelection {
  return { agentName: null, tools: null, skillSlugs: [], registeredSkillIds: [] }
}

const caps = ref<Capabilities | null>(null)
const showOptions = ref(false)
const showGoals = ref(false)
const selection = ref<CapabilitySelection>(defaultSelection())

const ADVANCED_STORAGE_KEY = 'magicsync-chat-advanced'

/** Explicit developer mode (T13): agent/skill/tool pickers stay hidden unless on. */
const advancedMode = ref(false)

function loadAdvancedMode() {
  try {
    advancedMode.value = localStorage.getItem(ADVANCED_STORAGE_KEY) === '1'
  }
  catch {
    advancedMode.value = false
  }
}

function handleAdvancedToggle(value: boolean) {
  advancedMode.value = value
  try {
    localStorage.setItem(ADVANCED_STORAGE_KEY, value ? '1' : '0')
  }
  catch {
    // storage unavailable: the toggle still applies to this session
  }
}

interface AgentSessionRow {
  id: string
  businessId: string
  threadId: string | null
  updatedAt: string
}

const sessions = ref<AgentSessionRow[]>([])
const sessionsLoading = ref(false)

function capsStorageKey(businessId: string): string {
  return `chat-caps:v1:${businessId}`
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

function applyStoredSelection(record: Record<string, unknown>) {
  if (typeof record.agentName === 'string' || record.agentName === null) {
    selection.value.agentName = record.agentName
  }
  if (Array.isArray(record.tools)) {
    selection.value.tools = asStringArray(record.tools)
  }
  else if (record.tools === null) {
    selection.value.tools = null
  }
  selection.value.skillSlugs = asStringArray(record.skillSlugs)
  selection.value.registeredSkillIds = asStringArray(record.registeredSkillIds)
}

function loadSelection(businessId: string) {
  selection.value = defaultSelection()
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(capsStorageKey(businessId)) ?? 'null')
    if (typeof parsed !== 'object' || parsed === null) return
    applyStoredSelection(parsed as Record<string, unknown>)
  }
  catch {
    selection.value = defaultSelection()
  }
}

function persistSelection() {
  const businessId = activeBusinessId.value
  if (!businessId) return
  try {
    localStorage.setItem(capsStorageKey(businessId), JSON.stringify(selection.value))
  }
  catch {
    // storage full or unavailable: selection still applies to this session
  }
}

async function fetchCapabilities() {
  const businessId = activeBusinessId.value
  caps.value = null
  if (!businessId) return
  try {
    caps.value = await $fetch<Capabilities>('/api/v1/agent/capabilities', {
      query: { businessId },
    })
    loadSelection(businessId)
  }
  catch (error: unknown) {
    toastFailure(t('capabilitiesFailed'), error)
  }
}

async function fetchSessions() {
  const businessId = activeBusinessId.value
  sessions.value = []
  if (!businessId) return
  sessionsLoading.value = true
  try {
    const response = await $fetch<{ sessions: AgentSessionRow[] }>('/api/v1/agent/sessions', {
      query: { businessId },
    })
    sessions.value = response.sessions
  }
  catch (error: unknown) {
    toastFailure(t('sessionsFailed'), error)
  }
  finally {
    sessionsLoading.value = false
  }
}

const sessionItems = computed(() => [
  { label: t('sessionAuto'), value: 'auto' },
  ...sessions.value.map(session => ({ label: t('sessionItem', { id: session.id.slice(0, 8) }), value: session.id })),
])

function handleSessionChange(value: string) {
  setSession(value === 'auto' ? null : value)
}

/** Tools visible in the picker: the active agent's scope (full catalog for Auto). */
function scopeTools(): CapabilityTool[] {
  const catalog = caps.value?.tools ?? []
  const agent = caps.value?.agents.find(entry => entry.name === selection.value.agentName)
  if (!agent) return catalog
  const allowed = new Set(agent.tools)
  return catalog.filter(tool => allowed.has(tool.name))
}

function toolGroupLabel(group: string): string {
  return t(`toolGroups.${group}`)
}

function agentDisplayName(name: string): string {
  return te(`agents.${name}`) ? t(`agents.${name}`) : name
}

function agentLabel(): string {
  const name = selection.value.agentName
  return name ? agentDisplayName(name) : t('agentAuto')
}

function toolsSummary(): string {
  const tools = scopeTools()
  const active = selection.value.tools
  if (!active) return t('toolsAll')
  return t('toolsSelected', { count: active.length, total: tools.length })
}

function skillsSummary(): string {
  const count = selection.value.skillSlugs.length + selection.value.registeredSkillIds.length
  if (count === 0) return t('skillsOff')
  return t('skillsSelected', { count })
}

const selectionSummary = computed(() => `${agentLabel()} · ${toolsSummary()} · ${skillsSummary()}`)

const agentItems = computed(() => [
  { label: t('agentAuto'), value: 'auto' },
  ...(caps.value?.agents ?? []).map(agent => ({ label: agentDisplayName(agent.name), value: agent.name })),
])

const groupedScopeTools = computed(() => {
  const groups = new Map<string, CapabilityTool[]>()
  for (const tool of scopeTools()) {
    const list = groups.get(tool.group) ?? []
    list.push(tool)
    groups.set(tool.group, list)
  }
  return [...groups.entries()]
})

function handleToggleOptions() {
  showOptions.value = !showOptions.value
  showGoals.value = false
}

function handleOpenConsole() {
  consoleOpen.value = true
}

/** The cog is a toggle: pressing it again puts the conversation back. */
function handleToggleSettings() {
  showOptions.value = !showOptions.value
  if (showOptions.value) showGoals.value = false
}

function handleInputKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey) return
  event.preventDefault()
  onSubmit()
}

function handleToggleGoals() {
  showGoals.value = !showGoals.value
}

function handleResetOptions() {
  selection.value = defaultSelection()
  persistSelection()
}

function handleEnableAllTools() {
  selection.value.tools = null
  persistSelection()
  toast.add({ title: t('toolsEnabled'), icon: 'i-heroicons-check-circle', color: 'success' })
}

function handleDisableAllTools() {
  selection.value.tools = []
  persistSelection()
  toast.add({ title: t('toolsDisabled'), icon: 'i-heroicons-minus-circle', color: 'neutral' })
}

function handleAgentChange(value: string) {
  selection.value.agentName = value === 'auto' ? null : value
  selection.value.tools = null
  persistSelection()
}

function isToolOn(name: string): boolean {
  const active = selection.value.tools
  return active ? active.includes(name) : true
}

function handleToolToggled(name: string, on: boolean) {
  const current = selection.value.tools ?? scopeTools().map(tool => tool.name)
  selection.value.tools = on
    ? [...new Set([...current, name])]
    : current.filter(tool => tool !== name)
  persistSelection()
}

function isSkillOn(kind: 'bundled' | 'registered', id: string): boolean {
  const list = kind === 'bundled' ? selection.value.skillSlugs : selection.value.registeredSkillIds
  return list.includes(id)
}

function handleSkillToggled(kind: 'bundled' | 'registered', id: string, on: boolean) {
  const key = kind === 'bundled' ? 'skillSlugs' : 'registeredSkillIds'
  const current = selection.value[key]
  selection.value[key] = on
    ? [...new Set([...current, id])]
    : current.filter(entry => entry !== id)
  persistSelection()
}

watch(activeBusinessId, () => {
  revisionTarget.value = null
  showGoals.value = false
  void fetchCapabilities()
  void fetchSessions()
})

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv']
const MAX_FILE_BYTES = 8_000_000

type FileCategory = 'image' | 'video' | 'document'

function fileCategory(file: File): FileCategory {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (file.type.startsWith('image/') || IMAGE_EXTS.includes(ext)) return 'image'
  if (file.type.startsWith('video/') || VIDEO_EXTS.includes(ext)) return 'video'
  return 'document'
}

function handleAttachClick() {
  fileInput.value?.click()
}

function handleFilesChosen(event: Event) {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files ?? [])
  target.value = ''
  for (const file of files) {
    const category = fileCategory(file)
    if (category === 'document') void ingestDocument(file)
    else void uploadAssetFile(file)
  }
}

function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error(t('ingestFailed')))
    reader.readAsDataURL(file)
  })
}

function toastFailure(message: string, error?: unknown) {
  toast.add({
    title: message,
    description: error instanceof Error ? error.message : undefined,
    icon: 'i-heroicons-x-circle',
    color: 'error',
  })
}

async function ingestDocument(file: File) {
  if (file.size > MAX_FILE_BYTES) {
    toastFailure(t('fileTooLarge'))
    return
  }
  try {
    const base64 = await readFileBase64(file)
    const response = await $fetch<ReadableStream<Uint8Array> | null>('/api/v1/agent/documents/ingest', {
      method: 'POST',
      body: {
        businessId: activeBusinessId.value,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64,
      },
    })
    if (response) await consumeIngest(response)
  }
  catch (error: unknown) {
    toastFailure(t('ingestFailed'), error)
  }
}

type IngestEvent = { type: string, documentId?: string, message?: string }

function isIngestEvent(value: unknown): value is IngestEvent {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string'
}

function handleIngestEvent(chunk: IngestEvent) {
  if (chunk.type === 'ingest.completed') {
    toast.add({ title: t('ingestSuccess'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  else if (chunk.type === 'error') {
    toastFailure(t('ingestFailed'), new Error(chunk.message))
  }
}

function extractLines(buffer: string): { lines: string[], rest: string } {
  const lines: string[] = []
  let rest = buffer
  let newlineIndex = rest.indexOf('\n')
  while (newlineIndex !== -1) {
    lines.push(rest.slice(0, newlineIndex))
    rest = rest.slice(newlineIndex + 1)
    newlineIndex = rest.indexOf('\n')
  }
  return { lines, rest }
}

function handleIngestLines(lines: string[]) {
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue
    try {
      const parsed: unknown = JSON.parse(line.slice(6))
      if (isIngestEvent(parsed)) handleIngestEvent(parsed)
    }
    catch {
      // skip malformed SSE lines
    }
  }
}

async function consumeIngest(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const { lines, rest } = extractLines(buffer)
    buffer = rest
    handleIngestLines(lines)
  }
}

async function uploadAssetFile(file: File) {
  if (!activeBusinessId.value) {
    toastFailure(t('needBusinessTitle'))
    return
  }
  try {
    const form = new FormData()
    form.append('files', file)
    form.append('businessId', activeBusinessId.value)
    await $fetch('/api/v1/assets', { method: 'POST', body: form })
    toast.add({ title: t('uploadSuccess'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (error: unknown) {
    toastFailure(t('uploadFailed'), error)
  }
}

const consoleOpen = ref(false)
/** Shared with the rail, so the header badge costs no extra request. */
const { items: pendingApprovalItems, load: loadApprovals } = useOperatorApprovals(() => activeBusinessId.value ?? undefined)
const pendingApprovals = computed(() => pendingApprovalItems.value.length)

onMounted(() => {
  loadAdvancedMode()
  void loadApprovals()
  void loadThreads()
  void initFromRoute()
  void fetchCapabilities()
  void fetchSessions()
})
</script>

<template>
  <div class="flex h-[calc(100vh-var(--header-height,4rem))] bg-default">
    <!-- Sidebar - ChatGPT style -->
    <ChatSidebar v-if="!sidebarCollapsed" :threads="threads" :active-thread-id="threadId" :loading="isLoadingThreads"
      :class="showSidebar ? 'flex' : 'hidden md:flex'" class="shrink-0" @select="handleSelectThread"
      @new="handleNewChat" @delete="handleDeleteThread" @collapse="handleCollapseSidebar" />
    <!-- Mobile overlay -->
    <div v-if="showSidebar" class="fixed inset-0 z-40 bg-black/20 md:hidden" @click="handleCollapseSidebar" />

    <!-- Main Column -->
    <div class="flex flex-1 flex-col min-w-0 bg-default">
      <header class="flex items-center justify-between gap-3 border-b border-default px-4 py-2 shrink-0">
        <div class="flex min-w-0 items-center gap-3">
          <UButton icon="i-heroicons-bars-3" variant="ghost" color="neutral" :aria-label="t('history.search')"
            @click="handleToggleSidebar" />
          <span class="truncate text-sm font-semibold text-highlighted">{{ t('operator.badge') }}</span>
          <OperatorSafeModeBadge :business-id="activeBusinessId" />
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <UButton icon="i-heroicons-plus" variant="ghost" color="neutral" :label="t('newChat')" class="hidden sm:flex"
            @click="handleNewChat" />
          <UButton icon="i-heroicons-plus" variant="ghost" color="neutral" class="sm:hidden" :aria-label="t('newChat')"
            @click="handleNewChat" />
          <UButton
            icon="i-heroicons-inbox-stack"
            variant="ghost"
            color="neutral"
            class="relative"
            :aria-label="t('console.open')"
            data-testid="open-operator-console"
            @click="handleOpenConsole"
          >
            <UBadge
              v-if="pendingApprovals > 0"
              size="xs"
              variant="solid"
              color="error"
              class="absolute -right-1 -top-1"
              :label="String(pendingApprovals)"
            />
          </UButton>
          <UButton icon="i-heroicons-sun" color="primary" :label="t('operator.morningReview')"
            class="hidden sm:flex" :loading="isStreaming" :disabled="!canSend" data-testid="operator-morning-review"
            @click="handleMorningReview" />
          <UButton icon="i-heroicons-sun" color="primary" class="sm:hidden"
            :aria-label="t('operator.morningReview')" :loading="isStreaming" :disabled="!canSend"
            @click="handleMorningReview" />
        </div>
      </header>

      <div class="flex-1 overflow-y-auto">
        <div v-if="!hasConversation"
          class="mx-auto flex h-full w-full max-w-[1100px] flex-col items-stretch justify-center gap-6 px-4 py-6">
          <div v-if="needsBusiness" v-motion-fade :duration="250" class="flex flex-col items-center gap-4 text-center">
            <UIcon name="i-lucide-building-2" class="size-12 text-primary" />
            <h1 class="text-2xl font-bold text-highlighted">{{ t('needBusinessTitle') }}</h1>
            <p class="text-base text-muted">{{ t('needBusinessDesc') }}</p>
            <UButton size="xl" :label="t('goToBusiness')" icon="i-lucide-building-2" @click="handleGoToBusinesses" />
          </div>

          <OperatorEmpty v-else />
        </div>

        <div v-else class="mx-auto w-full max-w-[980px] space-y-4 px-4 py-6">
          <div v-for="(message, index) in messages" :key="message.id" v-motion-fade :duration="200"
            class="flex flex-col gap-1" :class="message.role === 'user' ? 'items-end' : 'items-start'">
            <MorningReportCard v-if="message.role === 'system' && message.metadata?.kind === 'morning-report'"
              :content="message.content" @prompt="handleMorningReportPrompt" />
            <template v-else>
              <UCard v-if="message.content || message.role === 'user'" :ui="{ body: 'p-4' }"
                class="max-w-[85%] rounded-2xl text-base leading-relaxed" :class="message.role === 'user'
                  ? 'border-primary bg-primary text-inverted'
                  : 'border-default bg-elevated text-highlighted'">
                <Markdown v-if="message.role === 'assistant' && message.content" :value="message.content"
                  :streaming="isStreaming && index === messages.length - 1" class="chat-markdown" />
                <p v-else class="whitespace-pre-wrap">{{ message.content }}</p>
              </UCard>
              <div v-if="message.role === 'assistant' && message.content && !isStreaming"
                class="flex items-center gap-1 px-1">
                <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-clipboard" :aria-label="t('copy')"
                  @click="handleCopy(message.content)" />
                <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-arrow-path"
                  :aria-label="t('regenerate')" @click="handleRegenerate(index)" />
                <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-hand-thumb-up"
                  :aria-label="t('helpful')" @click="handleFeedback('positive')" />
                <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-hand-thumb-down"
                  :aria-label="t('notHelpful')" @click="handleFeedback('negative')" />
              </div>
            </template>
            <div v-if="message.role === 'assistant' && (message.toolCalls?.length ?? 0) > 0"
              class="mt-1 w-full max-w-[85%]">
              <RunCard :calls="message.toolCalls ?? []" :run="message.run" :business-id="activeBusinessId"
                :is-streaming="isStreaming && index === messages.length - 1" :cancel-loading="isCancelling"
                @revise="handleCarouselRevision" @cancel="handleCancelRun" />
            </div>
            <div v-else-if="message.role === 'assistant' && isStreaming && index === messages.length - 1"
              class="text-sm text-muted animate-pulse">
              {{ t('working') }}
            </div>
          </div>
        </div>
      </div>

      <footer class="border-t border-default px-4 py-3 shrink-0">
        <div class="mx-auto w-full max-w-[980px]">
          <div v-if="cardId" class="mb-2">
            <UBadge color="primary" variant="subtle" size="lg" class="gap-1">
              {{ t('cardChip', { title: cardTitle || cardId }) }}
              <UButton icon="i-heroicons-x-mark" variant="ghost" size="xs" :aria-label="t('cardDismiss')"
                @click="handleDismissCard" />
            </UBadge>
          </div>
          <input ref="fileInput" type="file" multiple class="hidden" @change="handleFilesChosen">
            <div v-if="revisionTarget" v-motion-slide-bottom :duration="200" class="mb-2">
              <UBadge color="warning" variant="subtle" size="lg" class="gap-1">
                {{ t('carousel.revisionTarget', revisionTarget) }}
                <UButton icon="i-heroicons-x-mark" variant="ghost" size="xs" :aria-label="t('carousel.cancelRevision')"
                  @click="handleCancelRevision" />
              </UBadge>
            </div>
            <UCard :ui="{ body: 'px-3 py-2' }" class="rounded-2xl border border-default bg-elevated shadow-sm">
              <UTextarea v-model="input"
                :placeholder="revisionTarget ? t('carousel.revisionPlaceholder') : t('inputPlaceholder')"
                :disabled="isStreaming" autoresize :rows="1" variant="none" class="w-full" data-tour="ai-chat-step-2"
                @keydown="handleInputKeydown" />
              <div class="mt-1.5 flex items-center justify-between gap-2">
                <div class="flex items-center gap-1">
                  <UTooltip :text="t('attachHint')">
                    <UButton icon="i-heroicons-paper-clip" color="neutral" variant="ghost" :aria-label="t('attach')"
                      :disabled="isStreaming" data-tour="ai-chat-step-1" @click="handleAttachClick" />
                  </UTooltip>
                  <button type="button"
                    class="inline-flex size-8 items-center justify-center rounded-md text-default transition-colors hover:bg-elevated hover:text-highlighted disabled:pointer-events-none disabled:opacity-50"
                    :disabled="isStreaming" :aria-label="t('options')" data-testid="chat-options-toggle"
                    @click="handleToggleSettings">
                    <UIcon name="i-heroicons-cog-6-tooth" class="size-4" />
                  </button>
                </div>
                <p v-if="advancedMode" class="min-w-0 truncate px-1 text-xs text-muted">{{ selectionSummary }}</p>
                <div class="flex shrink-0 items-center gap-1">
                  <UButton v-if="isStreaming" icon="i-heroicons-stop" color="neutral" variant="soft" :label="t('stop')"
                    :loading="isCancelling" @click="handleCancelRun" />
                  <UButton v-else icon="i-heroicons-arrow-up" color="primary" :label="t('send')"
                    :disabled="!input.trim() || needsBusiness" :loading="isStreaming" @click="onSubmit" />
                </div>
              </div>
            </UCard>
        </div>
      </footer>
    </div>

    <USlideover
      v-model:open="consoleOpen"
      :title="t('console.title')"
      :description="t('console.description')"
      :ui="{ content: 'sm:max-w-sm' }"
    >
      <template #body>
        <OperatorApprovalsRail :business-id="activeBusinessId" :is-streaming="isStreaming" />
        <OperatorActivityFeed :business-id="activeBusinessId" :is-streaming="isStreaming" />
      </template>
    </USlideover>
    <UModal
      v-model:open="showOptions"
      :title="t('optionsTitle')"
      :description="advancedMode ? selectionSummary : t('optionsHint')"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #footer>
        <div class="flex w-full justify-end">
          <UButton variant="ghost" color="neutral" :label="t('reset')" @click="handleResetOptions" />
        </div>
      </template>
      <template #body>
        <div class="space-y-4">
                  <section class="max-h-[70vh] overflow-y-auto">
                    <div>
                      <div class="mb-4 flex flex-wrap gap-2 border-b border-default pb-4">
                        <UButton size="sm" variant="ghost" color="neutral" icon="i-heroicons-sparkles"
                          :disabled="needsBusiness" @click="handleToggleGoals">
                          {{ t('goals') }}
                        </UButton>
                      </div>
                    </div>

                    <div v-if="showGoals" v-motion-fade :duration="200"
                      class="mb-3 rounded-xl border border-default bg-elevated p-4">
                      <GoalRunner :business-id="activeBusinessId" />
                    </div>
                    <div v-if="showOptions" v-motion-fade :duration="200" class="space-y-4">
                      <div class="flex items-center justify-between gap-3 rounded-xl border border-default bg-default p-3">
                        <div class="min-w-0">
                          <p class="text-sm font-semibold text-highlighted">{{ t('advancedMode') }}</p>
                          <p class="mt-0.5 text-xs text-muted">{{ t('advancedModeHint') }}</p>
                        </div>
                        <USwitch :model-value="advancedMode" @update:model-value="handleAdvancedToggle" />
                      </div>
                      <div v-if="advancedMode" v-motion-fade :duration="200" class="space-y-1">
                        <p class="text-sm font-semibold text-highlighted">{{ t('agent') }}</p>
                        <USelectMenu :model-value="selection.agentName ?? 'auto'" :items="agentItems" value-key="value"
                          class="w-full sm:max-w-xs" @update:model-value="handleAgentChange" />
                      </div>
                      <div class="space-y-1">
                        <p class="text-sm font-semibold text-highlighted">{{ t('session') }}</p>
                        <USelectMenu :model-value="sessionId ?? 'auto'" :items="sessionItems" value-key="value"
                          :loading="sessionsLoading" class="w-full sm:max-w-xs" @update:model-value="handleSessionChange" />
                        <p class="text-xs text-muted">{{ t('sessionHint') }}</p>
                      </div>
                      <div v-if="advancedMode" v-motion-fade :duration="200" class="space-y-2">
                        <div class="flex items-center justify-between gap-2">
                          <div>
                            <p class="text-sm font-semibold text-highlighted">{{ t('tools') }}</p>
                            <p class="text-xs text-muted">{{ toolsSummary() }}</p>
                          </div>
                          <div class="flex items-center gap-1">
                            <UButton size="xs" variant="outline" color="neutral" :label="t('enableAllTools')"
                              @click="handleEnableAllTools" />
                            <UButton size="xs" variant="ghost" color="neutral" :label="t('disableAllTools')"
                              @click="handleDisableAllTools" />
                          </div>
                        </div>
                        <div v-for="[group, tools] in groupedScopeTools" :key="group" class="space-y-1">
                          <p class="text-xs font-semibold uppercase tracking-wide text-muted">{{ toolGroupLabel(group) }}
                          </p>
                          <div class="grid grid-cols-1 gap-1 sm:grid-cols-2">
                            <UCheckbox v-for="tool in tools" :key="tool.name" :model-value="isToolOn(tool.name)"
                              :label="tool.name" :description="tool.description"
                              @update:model-value="handleToolToggled(tool.name, $event)" />
                          </div>
                        </div>
                      </div>
                      <div v-if="advancedMode" :duration="200" class="space-y-2">
                        <p class="text-sm font-semibold text-highlighted">{{ t('skills') }}</p>
                        <p class="text-xs font-semibold uppercase tracking-wide text-muted">{{ t('skillScopes.global') }}
                        </p>
                        <div class="grid grid-cols-1 gap-1 sm:grid-cols-2">
                          <UTooltip v-for="skill in caps?.skills.bundled ?? []" :key="skill.slug" :text="skill.description">
                            <UCheckbox :model-value="isSkillOn('bundled', skill.slug ?? '')" :label="skill.name"
                              @update:model-value="handleSkillToggled('bundled', skill.slug ?? '', $event)" />
                          </UTooltip>
                        </div>
                        <template v-if="(caps?.skills.registered.length ?? 0) > 0">
                          <p class="text-xs font-semibold uppercase tracking-wide text-muted">{{ t('skillScopes.custom') }}
                          </p>
                          <div class="grid grid-cols-1 gap-1 sm:grid-cols-2">
                            <div v-for="skill in caps?.skills.registered ?? []" :key="skill.id"
                              class="flex items-center gap-2">
                              <UTooltip :text="skill.description">
                                <UCheckbox :model-value="isSkillOn('registered', skill.id ?? '')" :label="skill.name"
                                  @update:model-value="handleSkillToggled('registered', skill.id ?? '', $event)" />
                              </UTooltip>
                              <UBadge color="neutral" variant="subtle" size="xs">{{ t(`skillScopes.${skill.scope}`) }}
                              </UBadge>
                            </div>
                          </div>
                        </template>
                        <p v-else class="text-xs text-muted">{{ t('noCustomSkills') }}</p>
                      </div>
                    </div>
                  </section>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.chat-markdown {
  overflow-wrap: anywhere;
}

.chat-markdown :deep(h1),
.chat-markdown :deep(h2),
.chat-markdown :deep(h3),
.chat-markdown :deep(h4) {
  font-weight: 700;
  line-height: 1.3;
  margin: 0.75em 0 0.375em;
}

.chat-markdown :deep(h1) {
  font-size: 1.25rem;
}

.chat-markdown :deep(h2) {
  font-size: 1.125rem;
}

.chat-markdown :deep(h3) {
  font-size: 1rem;
}

.chat-markdown :deep(h4) {
  font-size: 0.9375rem;
}

.chat-markdown :deep(p) {
  margin: 0.5em 0;
}

.chat-markdown :deep(p:first-child) {
  margin-top: 0;
}

.chat-markdown :deep(p:last-child) {
  margin-bottom: 0;
}

.chat-markdown :deep(ul),
.chat-markdown :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.25rem;
}

.chat-markdown :deep(ul) {
  list-style-type: disc;
}

.chat-markdown :deep(ol) {
  list-style-type: decimal;
}

.chat-markdown :deep(li) {
  margin: 0.25em 0;
}

.chat-markdown :deep(li > ul),
.chat-markdown :deep(li > ol) {
  margin: 0.25em 0;
}

.chat-markdown :deep(strong) {
  font-weight: 700;
}

.chat-markdown :deep(a) {
  color: var(--ui-primary);
  text-decoration: underline;
}

.chat-markdown :deep(code) {
  font-size: 0.875em;
  background: color-mix(in srgb, currentColor 8%, transparent);
  border-radius: 0.25rem;
  padding: 0.1em 0.3em;
}

.chat-markdown :deep(pre) {
  margin: 0.5em 0;
  padding: 0.75rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  background: color-mix(in srgb, currentColor 6%, transparent);
}

.chat-markdown :deep(pre code) {
  background: transparent;
  padding: 0;
}

.chat-markdown :deep(blockquote) {
  margin: 0.5em 0;
  padding-left: 0.75rem;
  border-left: 3px solid color-mix(in srgb, currentColor 25%, transparent);
  opacity: 0.9;
}

.chat-markdown :deep(hr) {
  margin: 0.75em 0;
  border: none;
  border-top: 1px solid color-mix(in srgb, currentColor 15%, transparent);
}

.chat-markdown :deep(table) {
  width: 100%;
  margin: 0.5em 0;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.chat-markdown :deep(th),
.chat-markdown :deep(td) {
  padding: 0.375rem 0.5rem;
  border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
  text-align: left;
}

.chat-markdown :deep(th) {
  font-weight: 700;
}
</style>
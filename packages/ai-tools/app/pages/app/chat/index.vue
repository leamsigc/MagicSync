<i18n src="./chat.json"></i18n>

<script setup lang="ts">
import { useAgentChat } from './composables/useAgentChat'
import { renderChatMarkdown } from './composables/useMarkdown'
import GoalRunner from './components/GoalRunner.vue'

const { t, te } = useI18n()
const toast = useToast()
const router = useRouter()

const input = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const businessOptions = ref<Array<{ label: string, value: string }>>([])
const activeBusinessId = useState<string | null>('business:id', () => null)

const {
  messages,
  isStreaming,
  sendMessage,
  abortStream,
  sessionId,
  setSession,
  loadThreads,
  createNewThread,
} = useAgentChat()

const chatStatus = computed(() => isStreaming.value ? 'streaming' : 'ready')
const hasConversation = computed(() => messages.value.length > 0)
const needsBusiness = computed(() => !activeBusinessId.value)

const suggestions = computed(() => [
  t('suggestions.customers'),
  t('suggestions.post'),
  t('suggestions.ideas'),
  t('suggestions.check'),
  t('suggestions.plan'),
])

interface ToolCallInfo {
  id: string
  name: string
  result?: string
  error?: string
}

function toolDisplayName(name: string): string {
  const spaced = name.replaceAll('_', ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function renderedMessage(message: { content: string }): string {
  return renderChatMarkdown(message.content)
}

function toolStatusIcon(call: ToolCallInfo): string {
  if (call.error) return 'i-heroicons-x-circle-16-solid'
  return call.result ? 'i-heroicons-check-circle-16-solid' : 'i-heroicons-arrow-path-16-solid'
}

function toolStatusClass(call: ToolCallInfo): string {
  if (call.error) return 'text-error'
  return call.result ? 'text-success' : 'text-muted animate-spin'
}

const expandedToolOutputs = ref<string[]>([])

function toolOutputKey(messageId: string, callId: string): string {
  return `${messageId}:${callId}`
}

function isToolOutputExpanded(messageId: string, callId: string): boolean {
  return expandedToolOutputs.value.includes(toolOutputKey(messageId, callId))
}

function handleToggleToolOutput(messageId: string, callId: string) {
  const key = toolOutputKey(messageId, callId)
  if (isToolOutputExpanded(messageId, callId)) {
    expandedToolOutputs.value = expandedToolOutputs.value.filter(entry => entry !== key)
    return
  }
  expandedToolOutputs.value = [...expandedToolOutputs.value, key]
}

const route = useRoute()
const cardId = ref<string | null>(null)
const cardTitle = ref('')

function onSubmit() {
  if (isStreaming.value) return
  if (!input.value.trim()) return
  if (!activeBusinessId.value) {
    toast.add({ title: t('needBusinessTitle'), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  sendMessage(input.value, {
    businessId: activeBusinessId.value,
    cardId: cardId.value ?? undefined,
    agentName: selection.value.agentName ?? undefined,
    allowedTools: selection.value.tools ?? undefined,
    skillSlugs: selection.value.skillSlugs.length > 0 ? selection.value.skillSlugs : undefined,
    registeredSkillIds: selection.value.registeredSkillIds.length > 0 ? selection.value.registeredSkillIds : undefined,
  })
  input.value = ''
}

function handleSuggestion(suggestion: string) {
  input.value = suggestion
  onSubmit()
}

function handleNewChat() {
  createNewThread()
}

async function fetchBusinesses() {
  try {
    const res = await $fetch<{ data?: Array<{ id: string, name: string }> }>('/api/v1/business')
    businessOptions.value = (res.data ?? []).map(b => ({ label: b.name, value: b.id }))
    preselectBusiness()
  }
  catch (error: unknown) {
    toast.add({
      title: t('error'),
      description: error instanceof Error ? error.message : undefined,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
}

function preselectBusiness() {
  if (activeBusinessId.value) return
  if (businessOptions.value.length !== 1) return
  const only = businessOptions.value[0]
  if (!only) return
  activeBusinessId.value = only.value
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
}

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

interface AgentSessionRow {
  id: string
  businessId: string
  threadId: string | null
  privateMode: boolean
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
}

function handleToggleGoals() {
  showGoals.value = !showGoals.value
}

function handleResetOptions() {
  selection.value = defaultSelection()
  persistSelection()
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
  showOptions.value = false
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

onMounted(() => {
  void fetchBusinesses()
  void loadThreads()
  void initFromRoute()
  // The shared business state may already be set (e.g. by the dashboard
  // header), in which case the watcher below never fires.
  void fetchCapabilities()
  void fetchSessions()
})
</script>

<template>
  <div class="flex h-[calc(100vh-var(--header-height,4rem))] flex-col bg-default">
    <header class="flex items-center justify-between border-b border-default px-4 py-2">
      <USelectMenu
        v-if="businessOptions.length > 1"
        v-model="activeBusinessId"
        :items="businessOptions"
        :placeholder="t('chooseBusiness')"
        value-key="value"
        class="w-56"
      />
      <div v-else class="text-sm font-semibold text-highlighted">{{ t('welcome') }}</div>
      <UButton icon="i-heroicons-plus" variant="ghost" color="neutral" :label="t('newChat')" @click="handleNewChat" />
    </header>

    <div class="flex-1 overflow-y-auto">
      <div v-if="!hasConversation" class="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center gap-6 px-4">
        <div v-if="needsBusiness" v-motion-fade :duration="250" class="flex flex-col items-center gap-4 text-center">
          <UIcon name="i-lucide-building-2" class="size-12 text-primary" />
          <h1 class="text-2xl font-bold text-highlighted">{{ t('needBusinessTitle') }}</h1>
          <p class="text-base text-muted">{{ t('needBusinessDesc') }}</p>
          <UButton size="xl" :label="t('goToBusiness')" icon="i-lucide-building-2" @click="handleGoToBusinesses" />
        </div>

        <div v-else class="flex w-full flex-col items-center gap-6 text-center">
          <h1 class="text-3xl font-bold text-highlighted">{{ t('welcome') }}</h1>
          <p class="text-base text-muted">{{ t('welcomeHint') }}</p>
          <div class="flex flex-wrap justify-center gap-2" data-tour="ai-chat-step-0">
            <UButton
              v-for="suggestion in suggestions"
              :key="suggestion"
              :label="suggestion"
              size="lg"
              color="neutral"
              variant="outline"
              class="rounded-full text-base"
              :disabled="isStreaming"
              @click="handleSuggestion(suggestion)"
            />
          </div>
        </div>
      </div>

      <div v-else class="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
        <div
          v-for="(message, index) in messages"
          :key="message.id"
          v-motion-fade
          :duration="200"
          class="flex flex-col gap-1"
          :class="message.role === 'user' ? 'items-end' : 'items-start'"
        >
          <div
            class="max-w-[85%] rounded-2xl px-4 py-3 text-base leading-relaxed"
            :class="message.role === 'user'
              ? 'bg-primary text-inverted'
              : 'bg-elevated text-highlighted'"
          >
            <div
              v-if="message.role === 'assistant' && message.content"
              class="chat-markdown"
              v-html="renderedMessage(message)"
            />
            <p v-else class="whitespace-pre-wrap">{{ message.content }}</p>
          </div>
          <div v-if="message.role === 'assistant' && (message.toolCalls?.length ?? 0) > 0" class="mt-1 w-full max-w-[85%] space-y-1">
            <div
              v-for="call in message.toolCalls"
              :key="call.id"
              class="overflow-hidden rounded-lg border border-default bg-elevated"
            >
              <button
                class="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-muted"
                :aria-expanded="isToolOutputExpanded(message.id, call.id)"
                @click="handleToggleToolOutput(message.id, call.id)"
              >
                <UIcon :name="toolStatusIcon(call)" :class="toolStatusClass(call)" class="size-4 shrink-0" />
                <span class="font-medium">{{ toolDisplayName(call.name) }}</span>
                <UIcon name="i-heroicons-chevron-down-16-solid" class="ml-auto size-4 shrink-0" />
              </button>
              <pre
                v-if="isToolOutputExpanded(message.id, call.id) && (call.error ?? call.result)"
                class="max-h-40 overflow-auto border-t border-default p-2 text-xs whitespace-pre-wrap text-muted"
              >{{ call.error ?? call.result }}</pre>
            </div>
          </div>
          <div v-else-if="message.role === 'assistant' && isStreaming && index === messages.length - 1" class="text-sm text-muted animate-pulse">
            {{ t('working') }}
          </div>
        </div>
      </div>
    </div>

    <footer class="border-t border-default px-4 py-3">
      <div class="mx-auto w-full max-w-2xl">
        <div class="mb-2 flex items-center gap-2">
          <UButton
            icon="i-lucide-sliders-horizontal"
            color="neutral"
            variant="ghost"
            :label="t('options')"
            :disabled="isStreaming"
            :aria-expanded="showOptions"
            @click="handleToggleOptions"
          />
          <UButton
            icon="i-heroicons-sparkles"
            color="neutral"
            variant="ghost"
            :label="t('goals')"
            :disabled="isStreaming || needsBusiness"
            :aria-expanded="showGoals"
            @click="handleToggleGoals"
          />
          <p class="text-xs text-muted">{{ selectionSummary }}</p>
        </div>
        <div v-if="showGoals" v-motion-fade :duration="200" class="mb-3 rounded-xl border border-default bg-elevated p-4">
          <GoalRunner :business-id="activeBusinessId" />
        </div>
        <div v-if="showOptions" v-motion-fade :duration="200" class="mb-3 space-y-4 rounded-xl border border-default bg-elevated p-4">
          <div class="flex items-start justify-between gap-2">
            <p class="text-sm font-semibold text-highlighted">{{ t('optionsTitle') }}</p>
            <UButton
              variant="ghost"
              color="neutral"
              size="xs"
              :label="t('reset')"
              @click="handleResetOptions"
            />
          </div>
          <div class="space-y-1">
            <p class="text-sm font-semibold text-highlighted">{{ t('agent') }}</p>
            <USelectMenu
              :model-value="selection.agentName ?? 'auto'"
              :items="agentItems"
              value-key="value"
              class="w-full sm:max-w-xs"
              @update:model-value="handleAgentChange"
            />
          </div>
          <div class="space-y-1">
            <p class="text-sm font-semibold text-highlighted">{{ t('session') }}</p>
            <USelectMenu
              :model-value="sessionId ?? 'auto'"
              :items="sessionItems"
              value-key="value"
              :loading="sessionsLoading"
              class="w-full sm:max-w-xs"
              @update:model-value="handleSessionChange"
            />
            <p class="text-xs text-muted">{{ t('sessionHint') }}</p>
          </div>
          <div class="space-y-2">
            <p class="text-sm font-semibold text-highlighted">{{ t('tools') }}</p>
            <div v-for="[group, tools] in groupedScopeTools" :key="group" class="space-y-1">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted">{{ toolGroupLabel(group) }}</p>
              <div class="grid grid-cols-1 gap-1 sm:grid-cols-2">
                <UCheckbox
                  v-for="tool in tools"
                  :key="tool.name"
                  :model-value="isToolOn(tool.name)"
                  :label="tool.name"
                  :description="tool.description"
                  @update:model-value="handleToolToggled(tool.name, $event)"
                />
              </div>
            </div>
          </div>
          <div class="space-y-2">
            <p class="text-sm font-semibold text-highlighted">{{ t('skills') }}</p>
            <p class="text-xs font-semibold uppercase tracking-wide text-muted">{{ t('skillScopes.global') }}</p>
            <div class="grid grid-cols-1 gap-1 sm:grid-cols-2">
              <UTooltip
                v-for="skill in caps?.skills.bundled ?? []"
                :key="skill.slug"
                :text="skill.description"
              >
                <UCheckbox
                  :model-value="isSkillOn('bundled', skill.slug ?? '')"
                  :label="skill.name"
                  @update:model-value="handleSkillToggled('bundled', skill.slug ?? '', $event)"
                />
              </UTooltip>
            </div>
            <template v-if="(caps?.skills.registered.length ?? 0) > 0">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted">{{ t('skillScopes.custom') }}</p>
              <div class="grid grid-cols-1 gap-1 sm:grid-cols-2">
                <div
                  v-for="skill in caps?.skills.registered ?? []"
                  :key="skill.id"
                  class="flex items-center gap-2"
                >
                  <UTooltip :text="skill.description">
                    <UCheckbox
                      :model-value="isSkillOn('registered', skill.id ?? '')"
                      :label="skill.name"
                      @update:model-value="handleSkillToggled('registered', skill.id ?? '', $event)"
                    />
                  </UTooltip>
                  <UBadge color="neutral" variant="subtle" size="xs">{{ t(`skillScopes.${skill.scope}`) }}</UBadge>
                </div>
              </div>
            </template>
            <p v-else class="text-xs text-muted">{{ t('noCustomSkills') }}</p>
          </div>
        </div>
        <div class="mb-2 flex items-center gap-2">
          <UTooltip :text="t('attachHint')">
            <UButton
              icon="i-heroicons-paper-clip"
              color="neutral"
              variant="ghost"
              :label="t('attach')"
              :disabled="isStreaming"
              data-tour="ai-chat-step-1"
              @click="handleAttachClick"
            />
          </UTooltip>
          <p class="text-xs text-muted">{{ t('attachHint') }}</p>
        </div>
        <div v-if="cardId" class="mb-2">
          <UBadge color="primary" variant="subtle" size="lg" class="gap-1">
            {{ t('cardChip', { title: cardTitle || cardId }) }}
            <UButton
              icon="i-heroicons-x-mark"
              variant="ghost"
              size="xs"
              :aria-label="t('cardDismiss')"
              @click="handleDismissCard"
            />
          </UBadge>
        </div>
        <input
          ref="fileInput"
          type="file"
          multiple
          class="hidden"
          @change="handleFilesChosen"
        >
        <UChatPrompt
          v-model="input"
          :placeholder="t('inputPlaceholder')"
          :disabled="isStreaming"
          autoresize
          :rows="2"
          data-tour="ai-chat-step-2"
          @submit="onSubmit"
        >
          <UChatPromptSubmit :status="chatStatus" @stop="abortStream" />
        </UChatPrompt>
      </div>
    </footer>
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
.chat-markdown :deep(h1) { font-size: 1.25rem; }
.chat-markdown :deep(h2) { font-size: 1.125rem; }
.chat-markdown :deep(h3) { font-size: 1rem; }
.chat-markdown :deep(h4) { font-size: 0.9375rem; }
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
.chat-markdown :deep(ul) { list-style-type: disc; }
.chat-markdown :deep(ol) { list-style-type: decimal; }
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

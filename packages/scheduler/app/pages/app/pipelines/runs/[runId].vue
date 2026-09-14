<i18n src="./runDetail.json"></i18n>

<script lang="ts" setup>
/**
 * Pipeline run detail: step timeline, step results viewer, human-review
 * panel (approve / request changes) and quick-action stubs.
 */
import { usePipelineManager } from '../composables/UsePipelineManager'
import type { Pipeline, PipelineRun, PostWithAllData } from '#layers/BaseDB/db/schema'
import type { PaginatedResponse } from '#layers/BaseDB/server/services/types'
import dayjs from 'dayjs'

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const runId = route.params.runId as string
const { getRun, getPipeline, advanceRun, runQuickAction, executeStep, resetRun, pauseRun, resumeRun, updateInput, deleteRun } = usePipelineManager()

useHead({
  title: t('seo_title'),
  meta: [
    { name: 'description', content: t('seo_description') }
  ]
})

const run = ref<PipelineRun | null>(null)
const pipeline = ref<Pipeline | null>(null)
const isLoadingRun = ref(true)
const approveLoading = ref(false)
const changesLoading = ref(false)
const feedback = ref('')
const quickDays = ref(7)
const quickLoading = ref<string | null>(null)
const repurposeOpen = ref(false)
const repurposePosts = ref<PostWithAllData[]>([])
const repurposeLoading = ref(false)
const repurposeConfirmLoading = ref(false)
const selectedSourcePostId = ref<string | null>(null)
const repurposeFormatsState = ref({ posts: false, carousels: false, reels: false })
const executeBusy = ref(false)
const rerunBusy = ref<number | null>(null)
const refreshBusy = ref(false)
const saveInputBusy = ref(false)
const pauseBusy = ref(false)
const resumeBusy = ref(false)
const deleteOpen = ref(false)
const deleting = ref(false)
const elapsedSeconds = ref(0)
const briefEdit = ref('')
const useContextEdit = ref(false)
const expandedAttempts = ref<string[]>([])

const PREVIEW_LIMIT = 280
const POLL_INTERVAL_MS = 4000
const MAX_POLL_FAILURES = 3
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollFailures = 0
let elapsedTimer: ReturnType<typeof setInterval> | null = null

interface TimelineStep {
  id: string
  name: string
  state: 'done' | 'current' | 'pending'
}

interface StepEntry {
  step?: number
  name?: string
  type?: string
  agentName?: string
  output?: unknown
  at?: string
  durationMs?: number
  event?: string
}

interface AttemptNote {
  kind: 'paused' | 'resumed'
  at: string | null
}

interface OutputErrorItem {
  phase: string
  message: string
}

interface TodoItem {
  content: string
  done: boolean
}

interface StepAttempt {
  key: string
  position: number
  name: string
  agent: string
  at: string | null
  durationLabel: string
  output: unknown
  outputText: string | null
  truncated: boolean
  errors: OutputErrorItem[]
  todos: TodoItem[]
  files: string[]
  rounds: number | null
}

interface StepCard {
  index: number
  name: string
  state: 'done' | 'current' | 'pending'
  attempts: StepAttempt[]
  startedAt: string | null
  finishedAt: string | null
}

function parseSteps(raw: string | null): Array<{ id?: string, name?: string }> {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  }
  catch {
    return []
  }
}

function parseResults(raw: string | null): unknown[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  }
  catch {
    return []
  }
}

const defaultStepNames = computed(() => [
  t('defaults.research'),
  t('defaults.writer'),
  t('defaults.humanizer'),
  t('defaults.design'),
  t('defaults.review')
])

const timelineSteps = computed<TimelineStep[]>(() => {
  const stored = parseSteps(pipeline.value?.steps ?? null)
  const names = stored.length > 0
    ? stored.map(entry => entry.name ?? '')
    : defaultStepNames.value
  const current = run.value?.currentStep ?? 0
  const finished = run.value?.status === 'completed'
  return names.map((name, index) => {
    if (finished || index < current) return { id: `step-${index}`, name, state: 'done' as const }
    if (index === current) return { id: `step-${index}`, name, state: 'current' as const }
    return { id: `step-${index}`, name, state: 'pending' as const }
  })
})

const stepResults = computed(() => parseResults(run.value?.stepResults ?? null))

const isWaitingReview = computed(() => run.value?.status === 'waiting_input')

const canExecute = computed(() => run.value?.status === 'running' || run.value?.status === 'waiting_input')

function isStepEntry(entry: unknown): entry is StepEntry {
  return !!entry && typeof entry === 'object' && typeof (entry as StepEntry).step === 'number'
}

function isNoteEntry(entry: unknown): entry is StepEntry {
  return !!entry && typeof entry === 'object' && typeof (entry as StepEntry).event === 'string'
}

function isTodoRecord(item: unknown): item is { content: string, status?: unknown } {
  return !!item && typeof item === 'object' && typeof (item as { content?: unknown }).content === 'string'
}

function stringifyOutput(output: unknown): string {
  try {
    const text = JSON.stringify(output, null, 2)
    return typeof text === 'string' ? text : String(output)
  }
  catch {
    return String(output)
  }
}

function outputPayload(output: unknown): Record<string, unknown> | null {
  if (!output || typeof output !== 'object') return null
  const record = output as Record<string, unknown>
  const inner = record.result
  if (inner && typeof inner === 'object') return inner as Record<string, unknown>
  return record
}

function toErrorItem(item: unknown): OutputErrorItem {
  const record = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
  const phase = typeof record.phase === 'string' ? record.phase : ''
  const message = typeof record.message === 'string' ? record.message : stringifyOutput(item)
  return { phase, message }
}

function errorItemsFor(output: unknown): OutputErrorItem[] {
  const payload = outputPayload(output)
  const list = payload?.errors
  if (!Array.isArray(list)) return []
  return list.map(toErrorItem)
}

function toTodoItem(item: { content: string, status?: unknown }): TodoItem {
  return { content: item.content, done: item.status === 'completed' || item.status === 'done' }
}

function todoItemsFor(output: unknown): TodoItem[] {
  const payload = outputPayload(output)
  const list = payload?.todos
  if (!Array.isArray(list)) return []
  return list.filter(isTodoRecord).map(toTodoItem)
}

function toFileName(item: unknown): string {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>
    const name = record.name ?? record.path ?? record.filename
    if (typeof name === 'string') return name
  }
  return ''
}

function fileItemsFor(output: unknown): string[] {
  const payload = outputPayload(output)
  const list = payload?.files
  if (!Array.isArray(list)) return []
  return list.map(toFileName).filter((name): name is string => name !== '')
}

function roundsFor(output: unknown): number | null {
  const payload = outputPayload(output)
  const state = payload?.final_state
  if (!state || typeof state !== 'object') return null
  const rounds = (state as Record<string, unknown>).rounds
  return Array.isArray(rounds) ? rounds.length : null
}

function diffMs(from: unknown, to: unknown): number | null {
  if (typeof from !== 'string' || typeof to !== 'string') return null
  const ms = new Date(to).getTime() - new Date(from).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  return ms
}

function formatDurationLabel(ms: number | null): string {
  if (typeof ms !== 'number') return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function durationForAttempt(all: unknown[], position: number): number | null {
  const entry = all[position] as StepEntry | undefined
  if (typeof entry?.durationMs === 'number') return entry.durationMs
  const next = all.slice(position + 1).find(item => typeof (item as StepEntry)?.at === 'string')
  return diffMs(entry?.at, (next as StepEntry | undefined)?.at)
}

function buildAttempt(all: unknown[], position: number, entry: StepEntry): StepAttempt {
  const outputText = entry.output === null || entry.output === undefined ? null : stringifyOutput(entry.output)
  return {
    key: `${entry.step ?? 0}:${position}`,
    position,
    name: entry.name ?? '',
    agent: entry.agentName ?? entry.type ?? '',
    at: entry.at ?? null,
    durationLabel: formatDurationLabel(durationForAttempt(all, position)),
    output: entry.output,
    outputText,
    truncated: outputText !== null && outputText.length > PREVIEW_LIMIT,
    errors: errorItemsFor(entry.output),
    todos: todoItemsFor(entry.output),
    files: fileItemsFor(entry.output),
    rounds: roundsFor(entry.output)
  }
}

const stepCards = computed<StepCard[]>(() => {
  const all = stepResults.value
  return timelineSteps.value.map((step, index) => {
    const matches: Array<{ position: number, entry: StepEntry }> = []
    all.forEach((raw, position) => {
      if (isStepEntry(raw) && raw.step === index) matches.push({ position, entry: raw })
    })
    const attempts = matches.map(match => buildAttempt(all, match.position, match.entry))
    const first = matches[0]?.entry ?? null
    const last = matches[matches.length - 1]?.entry ?? null
    return {
      index,
      name: last?.name || first?.name || step.name,
      state: step.state,
      attempts,
      startedAt: first?.at ?? null,
      finishedAt: matches.length > 1 ? (last?.at ?? null) : null
    }
  })
})

const activityNotes = computed<AttemptNote[]>(() => {
  const notes: AttemptNote[] = []
  for (const entry of stepResults.value) {
    if (!isNoteEntry(entry)) continue
    if (entry.event !== 'paused' && entry.event !== 'resumed') continue
    notes.push({ kind: entry.event, at: typeof entry.at === 'string' ? entry.at : null })
  }
  return notes
})

const lastRawEntry = computed(() => {
  const all = stepResults.value
  return (all[all.length - 1] as StepEntry | undefined) ?? null
})

const isPaused = computed(() => run.value?.status === 'waiting_input' && (lastRawEntry.value?.event ?? null) === 'paused')

const canPause = computed(() => run.value?.status === 'running')

const executingIndex = computed(() => run.value?.currentStep ?? 0)

function noteLabel(kind: AttemptNote['kind']) {
  return kind === 'paused' ? t('steps.paused') : t('steps.resumed')
}

function canRerun(card: StepCard) {
  return card.state === 'done' || card.state === 'current' || run.value?.status === 'failed'
}

function readServerMessage(err: unknown) {
  const fetchError = err as { data?: { message?: string, statusMessage?: string }, message?: string }
  return fetchError.data?.message || fetchError.data?.statusMessage || fetchError.message || t('toast.executeFailed')
}

function isExpanded(key: string) {
  return expandedAttempts.value.includes(key)
}

function previewFor(output: string, expanded: boolean) {
  if (expanded || output.length <= PREVIEW_LIMIT) {
    return output
  }
  return `${output.slice(0, PREVIEW_LIMIT)}…`
}

function handleToggleExpand(key: string) {
  if (expandedAttempts.value.includes(key)) {
    expandedAttempts.value = expandedAttempts.value.filter(item => item !== key)
  }
  else {
    expandedAttempts.value = [...expandedAttempts.value, key]
  }
}

function parseRunInput(raw: unknown): { brief: string, useBusinessContext: boolean } {
  const fallback = { brief: '', useBusinessContext: false }
  if (typeof raw !== 'string') {
    return fallback
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return fallback
    }
    const record = parsed as Record<string, unknown>
    return {
      brief: typeof record.brief === 'string' ? record.brief : '',
      useBusinessContext: record.useBusinessContext === true
    }
  }
  catch {
    return fallback
  }
}

function initSteerInput() {
  const parsed = parseRunInput(run.value?.input ?? null)
  briefEdit.value = parsed.brief
  useContextEdit.value = parsed.useBusinessContext
}

const quickActionItems = computed(() => [
  { kind: 'posts', label: t('quick.posts'), icon: 'i-lucide-file-text' },
  { kind: 'carousels', label: t('quick.carousels'), icon: 'i-lucide-layers' },
  { kind: 'reels', label: t('quick.reels'), icon: 'i-lucide-clapperboard' },
  { kind: 'repurpose', label: t('quick.repurpose'), icon: 'i-lucide-recycle' }
])

function formatDate(value: unknown) {
  if (!value) return ''
  return dayjs(value as string).format('MMM DD, HH:mm')
}

function goBack() {
  router.push('/app/pipelines')
}

function handleAskDeleteRun() {
  deleteOpen.value = true
}

function handleCancelDeleteRun() {
  deleteOpen.value = false
}

async function handleConfirmDeleteRun() {
  deleting.value = true
  try {
    await deleteRun(runId)
    deleteOpen.value = false
    router.push('/app/pipelines')
  }
  finally {
    deleting.value = false
  }
}

async function loadRun() {
  isLoadingRun.value = true
  try {
    run.value = await getRun(runId)
    if (run.value) {
      pipeline.value = await getPipeline(run.value.pipelineId)
    }
    initSteerInput()
  }
  finally {
    isLoadingRun.value = false
  }
}

async function handleRefresh() {
  refreshBusy.value = true
  try {
    const fresh = await getRun(runId)
    if (fresh) {
      run.value = fresh
      pipeline.value = await getPipeline(fresh.pipelineId)
      initSteerInput()
    }
    toast.add({ title: t('toast.refreshed'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  finally {
    refreshBusy.value = false
  }
}

function startElapsedTimer() {
  stopElapsedTimer()
  elapsedTimer = setInterval(() => {
    elapsedSeconds.value += 1
  }, 1000)
}

function stopElapsedTimer() {
  if (elapsedTimer) {
    clearInterval(elapsedTimer)
    elapsedTimer = null
  }
}

async function handleExecuteNext() {
  if (!canExecute.value) {
    return
  }
  const stepName = timelineSteps.value[run.value?.currentStep ?? 0]?.name ?? ''
  toast.add({ title: t('steps.started', { name: stepName }), icon: 'i-heroicons-magnifying-glass', color: 'info' })
  executeBusy.value = true
  elapsedSeconds.value = 0
  startElapsedTimer()
  const startedAt = Date.now()
  try {
    const updated = await executeStep(runId)
    if (updated) {
      run.value = updated
    }
    const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
    toast.add({ title: t('steps.finishedIn', { name: stepName, seconds }), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.executeFailed'), description: readServerMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    executeBusy.value = false
    stopElapsedTimer()
  }
}

async function handleRerun(index: number) {
  rerunBusy.value = index
  try {
    const updated = await resetRun(runId, index)
    if (updated) {
      run.value = updated
    }
  }
  finally {
    rerunBusy.value = null
  }
}

async function handlePause() {
  pauseBusy.value = true
  try {
    const updated = await pauseRun(runId)
    if (updated) {
      run.value = updated
    }
  }
  finally {
    pauseBusy.value = false
  }
}

async function handleResume() {
  resumeBusy.value = true
  try {
    const updated = await resumeRun(runId)
    if (updated) {
      run.value = updated
    }
  }
  finally {
    resumeBusy.value = false
  }
}

async function handleSaveInput() {
  saveInputBusy.value = true
  try {
    const updated = await updateInput(runId, { brief: briefEdit.value, useBusinessContext: useContextEdit.value })
    if (updated) {
      run.value = updated
      initSteerInput()
    }
  }
  finally {
    saveInputBusy.value = false
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function handleUnmount() {
  stopPolling()
  stopElapsedTimer()
}

async function handlePollTick() {
  if (run.value?.status !== 'running') {
    stopPolling()
    return
  }
  try {
    const fresh = await getRun(runId)
    if (fresh) {
      run.value = fresh
      pollFailures = 0
    }
    if (fresh?.status !== 'running') {
      stopPolling()
    }
  }
  catch {
    pollFailures += 1
    if (pollFailures >= MAX_POLL_FAILURES) {
      stopPolling()
    }
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    void handlePollTick()
  }, POLL_INTERVAL_MS)
}

watch(() => run.value?.status, (status) => {
  if (status === 'running') {
    startPolling()
  }
  else {
    stopPolling()
  }
})

async function handleApprove() {
  approveLoading.value = true
  try {
    run.value = await advanceRun(runId, true)
  }
  finally {
    approveLoading.value = false
  }
}

async function handleRequestChanges() {
  if (!feedback.value.trim()) {
    toast.add({ title: t('review.feedbackRequired'), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  changesLoading.value = true
  try {
    run.value = await advanceRun(runId, false, feedback.value.trim())
    feedback.value = ''
  }
  finally {
    changesLoading.value = false
  }
}

async function handleQuickAction(kind: string, label: string) {
  if (kind === 'repurpose') {
    await handleOpenRepurpose()
    return
  }
  if (!run.value) return
  quickLoading.value = kind
  try {
    const days = Math.min(30, Math.max(1, quickDays.value || 1))
    const created = await runQuickAction(run.value.businessId, kind, days)
    toast.add({ title: t('quick.queuedTitle'), description: t('quick.queuedDescription', { count: created.length, action: label }), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  finally {
    quickLoading.value = null
  }
}

function formatPostSnippet(content: unknown) {
  if (typeof content !== 'string' || !content) return ''
  return content.length > 120 ? `${content.slice(0, 120)}…` : content
}

function formatPostPlatforms(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join(', ')
  if (typeof value !== 'string' || !value) return ''
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String).join(', ') : value
  }
  catch {
    return value
  }
}

function selectedRepurposeFormats() {
  const formats: Array<'posts' | 'carousels' | 'reels'> = []
  if (repurposeFormatsState.value.posts) formats.push('posts')
  if (repurposeFormatsState.value.carousels) formats.push('carousels')
  if (repurposeFormatsState.value.reels) formats.push('reels')
  return formats
}

function resetRepurposeSelection() {
  selectedSourcePostId.value = null
  repurposeFormatsState.value = { posts: false, carousels: false, reels: false }
}

function handleSelectSourcePost(id: string) {
  selectedSourcePostId.value = id
}

function handleCloseRepurpose() {
  repurposeOpen.value = false
}

async function loadRepurposePosts() {
  if (!run.value) return
  repurposeLoading.value = true
  try {
    const response = await $fetch<PaginatedResponse<PostWithAllData>>('/api/v1/posts', {
      query: { businessId: run.value.businessId, status: 'published', limit: 10 }
    })
    repurposePosts.value = response.data ?? []
  }
  catch {
    toast.add({ title: t('quick.repurposeFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    repurposeLoading.value = false
  }
}

async function handleOpenRepurpose() {
  resetRepurposeSelection()
  repurposeOpen.value = true
  await loadRepurposePosts()
}

async function handleConfirmRepurpose() {
  if (!selectedSourcePostId.value) {
    toast.add({ title: t('quick.repurposeModal.selectRequired'), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  const formats = selectedRepurposeFormats()
  if (formats.length === 0) {
    toast.add({ title: t('quick.repurposeModal.formatsRequired'), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  if (!run.value) return
  repurposeConfirmLoading.value = true
  try {
    await $fetch('/api/v1/pipelines/quick-actions', {
      method: 'POST',
      body: { action: 'repurpose', businessId: run.value.businessId, sourcePostId: selectedSourcePostId.value, formats }
    })
    toast.add({ title: t('quick.repurposed'), icon: 'i-heroicons-check-circle', color: 'success' })
    handleCloseRepurpose()
  }
  catch {
    toast.add({ title: t('quick.repurposeFailed'), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    repurposeConfirmLoading.value = false
  }
}

onMounted(async () => {
  await loadRun()
  if (run.value?.status === 'running') {
    startPolling()
  }
})

onUnmounted(handleUnmount)
</script>

<template>
  <div class="min-h-screen ">
    <header class="sticky top-0 z-40 border-b border-white/5  backdrop-blur-xl">
      <div class="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <UButton variant="ghost" color="neutral" icon="i-heroicons-arrow-left" @click="goBack"
            class="text-white/50 hover:text-white" />
          <div>
            <h1 class="text-lg font-semibold text-white/90">{{ t('title') }}</h1>
            <p class="text-xs text-white/40">{{ t('description') }}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <UButton color="error" variant="ghost" icon="i-heroicons-trash" :title="t('delete.button')"
            @click="handleAskDeleteRun" class="text-white/30" />
        </div>
      </div>
    </header>

    <main class=" p-4 lg:mx-auto lg:p-6 space-y-6">
      <div v-if="isLoadingRun" class="flex justify-center items-center py-20">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin size-6 text-white/30" />
      </div>

      <template v-else-if="run">
        <UCard v-motion-fade-visible :duration="200" class="border border-white/5 bg-[#111111]">
          <div class="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div class="flex items-center gap-2">
              <span class="text-white/40">{{ t('meta.status') }}</span>
              <UBadge
                :color="run.status === 'completed' ? 'success' : run.status === 'failed' ? 'error' : run.status === 'waiting_input' ? 'warning' : 'info'"
                variant="subtle" class="capitalize">
                {{ t(`statuses.${run.status}`) }}
              </UBadge>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-white/40">{{ t('meta.pipeline') }}</span>
              <span class="font-mono text-xs text-white/50">{{ pipeline?.name ?? run.pipelineId.slice(0, 8) }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-white/40">{{ t('meta.started') }}</span>
              <span class="text-white/50">{{ formatDate(run.createdAt) }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-white/40">{{ t('meta.updated') }}</span>
              <span class="text-white/50">{{ formatDate(run.updatedAt) }}</span>
            </div>
          </div>
        </UCard>

        <UCard v-motion-fade-visible :duration="200" class="border border-white/5 bg-[#111111]">
          <div class="flex flex-wrap items-center gap-3">
            <UButton color="primary" variant="solid" icon="i-heroicons-play" :loading="executeBusy"
              :disabled="!canExecute" @click="handleExecuteNext">
              {{ t('steer.runNext') }}
            </UButton>
            <UButton color="neutral" variant="outline" icon="i-heroicons-arrow-path" :loading="refreshBusy"
              @click="handleRefresh" class="border-white/10 text-white/50">
              {{ t('refresh') }}
            </UButton>
            <UButton v-if="canPause" color="warning" variant="outline" icon="i-heroicons-pause" :loading="pauseBusy"
              @click="handlePause" class="border-white/10 text-white/50">
              {{ t('steps.pause') }}
            </UButton>
            <UButton v-if="isPaused" color="success" variant="solid" icon="i-heroicons-play" :loading="resumeBusy"
              @click="handleResume">
              {{ t('steps.resume') }}
            </UButton>
            <p v-if="!canExecute" v-motion-fade :duration="200" class="w-full text-xs text-white/30">
              {{ t('steer.finishedHint') }}
            </p>
          </div>
        </UCard>

        <UCard v-if="activityNotes.length > 0" v-motion-fade :duration="200" class="border border-white/5 bg-[#111111]">
          <div class="space-y-2">
            <div v-for="(note, noteIndex) in activityNotes" :key="noteIndex"
              class="flex items-center gap-2 text-xs text-white/30">
              <UIcon :name="note.kind === 'paused' ? 'i-heroicons-pause-circle' : 'i-heroicons-play-circle'"
                class="size-4" />
              <span class="font-medium">{{ noteLabel(note.kind) }}</span>
              <span v-if="note.at">{{ formatDate(note.at) }}</span>
            </div>
          </div>
        </UCard>

        <UCard v-motion-fade-visible :duration="200" class="border border-white/5 bg-[#111111]">
          <template #header>
            <h2 class="font-semibold text-white/70">{{ t('timeline.title') }}</h2>
          </template>
          <ol class="space-y-0">
            <li v-for="(step, index) in timelineSteps" :key="step.id" class="flex gap-4">
              <div class="flex flex-col items-center">
                <span class="size-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
                  :class="{
                    'bg-success text-white shadow-lg shadow-success/20': step.state === 'done',
                    'bg-primary text-white shadow-lg shadow-primary/20 ring-2 ring-primary/30': step.state === 'current',
                    'bg-white/5 text-white/30': step.state === 'pending'
                  }">
                  <UIcon v-if="step.state === 'done'" name="i-heroicons-check" class="size-4" />
                  <span v-else>{{ index + 1 }}</span>
                </span>
                <span v-if="index < timelineSteps.length - 1" class="w-px flex-1 bg-white/5 my-1" />
              </div>
              <div class="pb-6">
                <p class="font-medium text-sm text-white/80">{{ step.name }}</p>
                <p class="text-xs text-white/30">
                  {{ step.state === 'done' ? t('timeline.done') : step.state === 'current' ? t('timeline.current') :
                    t('timeline.pending') }}
                </p>
              </div>
            </li>
          </ol>
        </UCard>

        <UCard v-motion-fade-visible :duration="200" class="border border-white/5 bg-[#111111]">
          <template #header>
            <div>
              <h2 class="font-semibold text-white/70">{{ t('steps.title') }}</h2>
              <p class="text-sm text-white/30">{{ t('steps.description') }}</p>
            </div>
          </template>
          <p v-if="run.status === 'failed'" v-motion-fade :duration="200" class="mb-3 text-xs text-white/30">
            {{ t('steps.retryHint') }}
          </p>
          <div class="space-y-3">
            <div v-for="card in stepCards" :key="card.index" class="rounded-xl border border-white/10 bg-[#111111] p-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm font-medium text-white/80">{{ card.index + 1 }}. {{ card.name }}</p>
                <UBadge :color="card.state === 'done' ? 'success' : card.state === 'current' ? 'primary' : 'neutral'"
                  variant="subtle" class="capitalize">
                  {{ t(`timeline.${card.state}`) }}
                </UBadge>
              </div>
              <p v-if="card.startedAt" class="mt-1 text-xs text-white/30">{{ t('meta.started') }}: {{
                formatDate(card.startedAt)
                }}</p>
              <p v-if="card.finishedAt" class="mt-1 text-xs text-white/30">{{ t('meta.updated') }}: {{
                formatDate(card.finishedAt) }}</p>
              <p v-if="executeBusy && card.index === executingIndex" v-motion-fade :duration="200"
                class="mt-1 flex items-center gap-1.5 text-xs text-primary">
                <UIcon name="i-heroicons-arrow-path" class="size-3.5 animate-spin" />
                {{ t('steps.elapsed', { seconds: elapsedSeconds }) }}
              </p>
              <p v-if="card.attempts.length === 0" class="mt-2 text-xs text-white/20">{{ t('steps.noOutput') }}</p>
              <div v-for="(attempt, attemptIndex) in card.attempts" :key="attempt.key"
                class="mt-3 rounded-lg bg-white/5 p-3">
                <div class="flex flex-wrap items-center gap-2 text-xs">
                  <span class="font-medium text-white/50">{{ t('steps.attempt', { index: attemptIndex + 1 }) }}</span>
                  <span v-if="attempt.at" class="text-white/20">{{ formatDate(attempt.at) }}</span>
                  <span v-if="attempt.durationLabel" class="text-white/20">{{ attempt.durationLabel }}</span>
                  <UBadge v-if="attempt.agent" color="neutral" variant="outline" size="xs" class="text-white/40">{{
                    attempt.agent }}</UBadge>
                </div>
                <div v-if="attempt.errors.length > 0" class="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2">
                  <p class="text-xs font-semibold text-red-400">{{ t('steps.errorsTitle') }}</p>
                  <ul class="mt-1 space-y-1">
                    <li v-for="(item, errorIndex) in attempt.errors" :key="errorIndex" class="text-xs text-red-400">
                      <span v-if="item.phase" class="font-medium">{{ item.phase }}: </span>{{ item.message }}
                    </li>
                  </ul>
                </div>
                <div v-if="attempt.todos.length > 0" class="mt-2">
                  <p class="text-xs font-semibold text-white/40">{{ t('steps.todosTitle') }}</p>
                  <ul class="mt-1 space-y-1">
                    <li v-for="(todo, todoIndex) in attempt.todos" :key="todoIndex"
                      class="flex items-start gap-2 text-xs">
                      <UIcon :name="todo.done ? 'i-heroicons-check-circle' : 'i-heroicons-minus-circle'"
                        class="mt-0.5 size-4" :class="todo.done ? 'text-success' : 'text-white/20'" />
                      <span :class="todo.done ? 'line-through text-white/20' : 'text-white/30'">{{ todo.content
                        }}</span>
                    </li>
                  </ul>
                </div>
                <div v-if="attempt.files.length > 0" class="mt-2 flex flex-wrap items-center gap-1.5">
                  <span class="text-xs font-semibold text-white/30">{{ t('steps.filesTitle') }}</span>
                  <UBadge v-for="(file, fileIndex) in attempt.files" :key="fileIndex" color="neutral" variant="outline"
                    size="xs" class="text-white/30" icon="i-heroicons-document">{{ file }}</UBadge>
                </div>
                <p v-if="attempt.rounds !== null" class="mt-2 text-xs text-white/20">{{ t('steps.rounds', {
                  count:
                    attempt.rounds
                }) }}</p>
                <pre v-if="attempt.outputText"
                  class="mt-2 whitespace-pre-wrap break-all rounded-lg bg-white/5 p-2 font-mono text-xs text-white/40">{{
                    previewFor(attempt.outputText, isExpanded(attempt.key)) }}</pre>
                <p v-else class="mt-2 text-xs text-white/20">{{ t('steps.outputEmpty') }}</p>
                <div v-if="attempt.truncated" class="mt-2 flex flex-wrap gap-2">
                  <UButton color="neutral" variant="ghost" size="xs" @click="handleToggleExpand(attempt.key)"
                    class="text-white/30">
                    {{ isExpanded(attempt.key) ? t('steps.collapse') : t('steps.expand') }}
                  </UButton>
                </div>
              </div>
              <div v-if="canRerun(card)" class="mt-2 flex flex-wrap gap-2">
                <UButton color="warning" variant="outline" size="xs" icon="i-heroicons-arrow-uturn-left"
                  :loading="rerunBusy === card.index" @click="handleRerun(card.index)"
                  class="border-white/10 text-white/30">
                  {{ t('steps.rerun') }}
                </UButton>
              </div>
            </div>
          </div>
        </UCard>

        <UCard v-motion-fade-visible :duration="200" class="border border-white/5 bg-[#111111]">
          <template #header>
            <h2 class="font-semibold text-white/70">{{ t('results.title') }}</h2>
          </template>
          <div v-if="stepResults.length === 0" class="text-sm text-white/30 py-4 text-center">
            {{ t('results.empty') }}
          </div>
          <div v-else class="space-y-3">
            <details v-for="(entry, index) in stepResults" :key="index" class="bg-white/5 rounded-xl p-3">
              <summary class="text-sm font-medium text-white/50 cursor-pointer">{{ t('results.entry', {
                index: index + 1
              }) }}
              </summary>
              <pre class="mt-2 text-xs font-mono whitespace-pre-wrap break-all text-white/30">{{ JSON.stringify(entry, null, 2)
              }}</pre>
            </details>
          </div>
        </UCard>

        <UCard v-motion-fade-visible :duration="200" class="border border-white/5 bg-[#111111]">
          <template #header>
            <div>
              <h2 class="font-semibold text-white/70">{{ t('steer.briefTitle') }}</h2>
              <p class="text-sm text-white/30">{{ t('steer.briefDescription') }}</p>
            </div>
          </template>
          <div class="space-y-4">
            <UFormField :label="t('steer.briefLabel')" name="brief">
              <UTextarea v-model="briefEdit" :placeholder="t('steer.briefPlaceholder')" :rows="3" class="w-full" />
            </UFormField>
            <UCheckbox v-model="useContextEdit" :label="t('steer.useContext')" />
            <UButton color="primary" variant="solid" icon="i-heroicons-check" :loading="saveInputBusy"
              @click="handleSaveInput">
              {{ t('steer.saveBrief') }}
            </UButton>
          </div>
        </UCard>

        <UCard v-if="isWaitingReview" v-motion-slide-bottom :duration="250" class="border border-white/5 bg-[#111111]">
          <template #header>
            <div>
              <h2 class="font-semibold text-white/70">{{ t('review.title') }}</h2>
              <p class="text-sm text-white/30">{{ t('review.description') }}</p>
            </div>
          </template>
          <div class="space-y-4">
            <UFormField :label="t('review.feedback')" name="feedback">
              <UTextarea v-model="feedback" :placeholder="t('review.feedbackPlaceholder')" :rows="3" class="w-full" />
            </UFormField>
            <div class="flex flex-wrap gap-2">
              <UButton color="primary" variant="solid" icon="i-heroicons-check" :loading="approveLoading"
                @click="handleApprove">
                {{ t('review.approve') }}
              </UButton>
              <UButton color="warning" variant="outline" icon="i-heroicons-arrow-uturn-left" :loading="changesLoading"
                @click="handleRequestChanges" class="border-white/10 text-white/50">
                {{ t('review.requestChanges') }}
              </UButton>
            </div>
          </div>
        </UCard>

        <UCard v-motion-fade-visible :duration="200" class="border border-white/5 bg-[#111111]">
          <template #header>
            <div>
              <h2 class="font-semibold text-white/70">{{ t('quick.title') }}</h2>
              <p class="text-sm text-white/30">{{ t('quick.description') }}</p>
            </div>
          </template>
          <div class="flex flex-wrap items-end gap-3">
            <UFormField :label="t('quick.days')" name="quickDays" class="w-28">
              <UInput v-model.number="quickDays" type="number" :min="1" :max="30" />
            </UFormField>
            <div class="flex flex-wrap gap-2">
              <UButton v-for="item in quickActionItems" :key="item.kind" color="neutral" variant="outline"
                :icon="item.icon" :loading="quickLoading === item.kind"
                @click="handleQuickAction(item.kind, item.label)" class="border-white/10 text-white/50">
                {{ item.label }}
              </UButton>
            </div>
          </div>
        </UCard>

        <UModal v-model:open="deleteOpen" :title="t('delete.title')" :description="t('delete.description')">
          <template #footer>
            <div class="flex w-full justify-end gap-2">
              <UButton variant="ghost" color="neutral" @click="handleCancelDeleteRun">
                {{ t('delete.cancel') }}
              </UButton>
              <UButton color="error" :loading="deleting" @click="handleConfirmDeleteRun">
                {{ t('delete.confirm') }}
              </UButton>
            </div>
          </template>
        </UModal>

        <UModal v-model:open="repurposeOpen" :title="t('quick.repurposeModal.title')"
          :description="t('quick.repurposeModal.description')" :ui="{ content: 'md:min-w-[720px]' }">
          <template #body>
            <div v-if="repurposeLoading" class="flex justify-center py-12">
              <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-white/30" />
            </div>
            <div v-else-if="repurposePosts.length === 0" v-motion-fade :duration="200"
              class="text-sm text-white/30 text-center py-8">
              {{ t('quick.repurposeModal.empty') }}
            </div>
            <div v-else v-motion-fade :duration="200" class="space-y-4">
              <div class="space-y-2">
                <p class="text-sm font-medium text-white/60">{{ t('quick.repurposeModal.sourceLabel') }}</p>
                <button v-for="post in repurposePosts" :key="post.id" type="button"
                  class="w-full rounded-lg border-2 p-3 text-left transition"
                  :class="selectedSourcePostId === post.id ? 'border-primary' : 'border-white/10 hover:border-primary/50'"
                  @click="handleSelectSourcePost(post.id)">
                  <div class="flex items-start justify-between gap-2">
                    <p class="text-sm font-medium line-clamp-2 text-white/60">{{ formatPostSnippet(post.content) }}</p>
                    <UBadge v-if="selectedSourcePostId === post.id" v-motion-fade :duration="200" color="primary"
                      variant="solid" size="xs">{{ t('quick.repurposeModal.selected') }}</UBadge>
                  </div>
                  <p class="mt-1 text-xs text-white/30">{{ formatDate(post.publishedAt ?? post.createdAt) }}</p>
                  <p class="text-xs text-white/30">{{ formatPostPlatforms(post.targetPlatforms) }}</p>
                </button>
              </div>
              <div class="space-y-2">
                <p class="text-sm font-medium text-white/60">{{ t('quick.repurposeModal.formatsLabel') }}</p>
                <div class="flex flex-wrap gap-4">
                  <UCheckbox v-model="repurposeFormatsState.posts" :label="t('quick.repurposeModal.formatPost')" />
                  <UCheckbox v-model="repurposeFormatsState.carousels"
                    :label="t('quick.repurposeModal.formatCarousel')" />
                  <UCheckbox v-model="repurposeFormatsState.reels" :label="t('quick.repurposeModal.formatReel')" />
                </div>
              </div>
            </div>
          </template>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton variant="ghost" @click="handleCloseRepurpose" class="text-white/30">{{
                t('quick.repurposeModal.cancel') }}</UButton>
              <UButton color="primary" :loading="repurposeConfirmLoading" @click="handleConfirmRepurpose">{{
                t('quick.repurposeModal.confirm') }}</UButton>
            </div>
          </template>
        </UModal>
      </template>
    </main>
  </div>
</template>

<style scoped></style>

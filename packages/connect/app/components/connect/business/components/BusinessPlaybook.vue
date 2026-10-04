<i18n src="#site/app/pages/app/business/[id]/playbook.json"></i18n>
<script lang="ts" setup>
import dayjs from 'dayjs'

const props = defineProps<{ businessId: string }>()

const { t } = useI18n()
const toast = useToast()
const router = useRouter()

const businessId = props.businessId

interface PlaybookEdition {
  id: string
  status: 'draft' | 'current' | 'archived' | 'discarded'
  version: number
  hash: string
  playbook: Record<string, unknown>
  publishedBy: string
  publishedAt: string | null
  updatedAt: string
  projection: { sections: number, keys: number, at: string } | null
}

interface ServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

const businessName = ref('')
const currentEdition = ref<PlaybookEdition | null>(null)
const editions = ref<PlaybookEdition[]>([])
const editorText = ref('')
const editingEditionId = ref<string | null>(null)
const pageBusy = ref(true)
const generating = ref(false)
const saving = ref(false)
const publishingId = ref<string | null>(null)
const syncing = ref(false)
const quizOpen = ref(false)
const refining = ref(false)
const quizAnswers = ref<Record<string, string>>({})
const refinedPlaybook = ref<Record<string, unknown> | null>(null)
const intakeSaving = ref(false)
const rowBusyId = ref<string | null>(null)
const exporting = ref(false)
const importing = ref(false)
const migrating = ref(false)
const importInput = ref<HTMLInputElement | null>(null)
const showAdvanced = ref(false)

interface BrandReadiness {
  brandedReady: boolean
  editionId: string | null
  corpus: { ready: boolean, missingSections: string[], warnings: string[] }
}

const readiness = ref<BrandReadiness | null>(null)

interface QuizQuestion {
  id: string
  section: string
  label: string
}

const quizSections = computed(() => [
  { id: 'identity', questions: ['id_website', 'id_industry', 'id_location'] },
  { id: 'audience', questions: ['aud_primary', 'aud_problem', 'aud_outcome'] },
  { id: 'voice', questions: ['voice_tone', 'voice_banned'] },
  { id: 'positioning', questions: ['pos_audience', 'pos_differentiator'] },
  { id: 'offers', questions: ['offers_main'] },
  { id: 'hooks', questions: ['hooks_angles'] },
  { id: 'competitors', questions: ['competitors_alt'] },
  { id: 'keywords', questions: ['keywords_terms'] },
  { id: 'testimonials', questions: ['testimonials_proof'] },
  { id: 'safety', questions: ['safety_never', 'safety_verify'] },
  { id: 'brand', questions: ['brand_author', 'brand_cta', 'brand_imagestyle'] },
])

const quizQuestions = computed<QuizQuestion[]>(() => quizSections.value.flatMap(section =>
  section.questions.map(qid => ({ id: qid, section: section.id, label: t(`quiz.q.${qid}`) })),
))

const answeredCount = computed(() => quizQuestions.value.filter(q =>
  (quizAnswers.value[q.id] ?? '').trim().length > 0,
).length)

const hasEdition = computed(() => currentEdition.value !== null || editions.value.length > 0)
const publishTargetId = computed(() => editingEditionId.value ?? currentEdition.value?.id ?? '')

const flowSteps = computed(() => [
  { label: t('flow.business'), hint: t('flow.businessHint'), to: '/app/business', icon: 'i-lucide-building-2' },
  {
    label: t('flow.playbook'), hint: t('flow.playbookHint'), to: `/app/business/${businessId}/playbook`, icon: 'i-lucide-book-open'
  },
  { label: t('flow.brandBase'), hint: t('flow.brandBaseHint'), to: `/app/business/${businessId}/corpus`, icon: 'i-lucide-database' },
  {
    label: t('flow.board'), hint: t('flow.boardHint'), to: `/app/business/${businessId}/content`, icon: 'i - lucide - kanban'
  },
  {
    label: t('flow.publishing'), hint: t('flow.publishingHint'), to: `/app/business/${businessId}/publishing`, icon: 'i - lucide - send'
  },
])

const activeFlowIndex = computed(() => flowSteps.value.findIndex(s => s.to === `/app/business/${businessId}/playbook`))

const statusColor = (status: string) => {
  if (status === 'current') return 'success'
  if (status === 'draft') return 'warning'
  return 'neutral'
}

const formatDate = (value: unknown) => {
  if (!value) return ''
  return dayjs(value as string).format('MMM DD, HH:mm')
}

const shortHash = (hash: string) => hash.slice(0, 8)

const applyEdition = (edition: PlaybookEdition) => {
  editingEditionId.value = edition.id
  editorText.value = JSON.stringify(edition.playbook, null, 2)
}

const readErrorMessage = (err: unknown) => {
  const fetchError = err as { data?: { message?: string, statusMessage?: string }, message?: string }
  return fetchError.data?.message || fetchError.data?.statusMessage || fetchError.message || t('toast.loadFailed')
}

const handleGoBack = () => router.push('/app/business')

const refreshEditions = async () => {
  try {
    const res = await $fetch<ServiceResult<PlaybookEdition[]>>(`/api/v1/business/${businessId}/playbook/editions`)
    editions.value = res.data ?? []
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.loadFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
}

const refreshCurrent = async () => {
  try {
    const res = await $fetch<ServiceResult<PlaybookEdition | null>>(`/api/v1/business/${businessId}/playbook/current`)
    currentEdition.value = res.data ?? null
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.loadFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
}

const refreshReadiness = async () => {
  try {
    const res = await $fetch<ServiceResult<BrandReadiness>>(`/api/v1/business/${businessId}/playbook/readiness`)
    readiness.value = res.data ?? null
  }
  catch {
    readiness.value = null
  }
}

const quizGroupFor = (qid: string, section: string): string => {
  if (qid === 'brand_author' || qid === 'brand_cta') return 'conversion'
  if (qid === 'brand_imagestyle') return 'visuals'
  if (qid === 'safety_verify') return 'verify'
  if (section === 'keywords') return 'search'
  if (section === 'testimonials') return 'proof'
  return section
}

interface EditionCompletion {
  filledGroups: string[]
  missingFields: string[]
  ready: boolean
}

const editingEdition = computed(() => {
  const id = editingEditionId.value
  if (!id) return null
  return editions.value.find(edition => edition.id === id)
    ?? (currentEdition.value?.id === id ? currentEdition.value : null)
})

const editingCompletion = computed((): EditionCompletion | null => {
  const completion = (editingEdition.value?.playbook as { completion?: EditionCompletion } | undefined)?.completion
  if (!completion || !Array.isArray(completion.missingFields)) return null
  return completion
})

const collectIntakeAnswers = () => {
  return quizQuestions.value
    .filter(q => (quizAnswers.value[q.id] ?? '').trim().length > 0)
    .map(q => ({ group: quizGroupFor(q.id, q.section), question: q.label, answer: (quizAnswers.value[q.id] ?? '').trim() }))
}

const loadPage = async () => {
  pageBusy.value = true
  try {
    const businessRes = await $fetch<{ data?: { name?: string } }>(`/api/v1/business/${businessId}`)
    businessName.value = businessRes.data?.name ?? ''
    await refreshCurrent()
    await refreshEditions()
    await refreshReadiness()
    if (currentEdition.value) applyEdition(currentEdition.value)
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.loadFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    pageBusy.value = false
  }
}

const handleSaveIntakeDraft = async () => {
  const answers = collectIntakeAnswers()
  if (answers.length === 0) {
    toast.add({ title: t('quiz.needAnswers'), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  intakeSaving.value = true
  try {
    const res = await $fetch<ServiceResult<PlaybookEdition>>(`/api/v1/business/${businessId}/playbook/intake`, {
      method: 'POST',
      body: { answers },
    })
    if (res.data) applyEdition(res.data)
    await refreshEditions()
    await refreshReadiness()
    toast.add({ title: t('toast.intakeDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.intakeFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    intakeSaving.value = false
  }
}

const handleRestoreEdition = async (id: string) => {
  rowBusyId.value = id
  try {
    const res = await $fetch<ServiceResult<PlaybookEdition>>(`/api/v1/business/${businessId}/playbook/restore`, {
      method: 'POST',
      body: { editionId: id },
    })
    if (res.data) applyEdition(res.data)
    await refreshEditions()
    toast.add({ title: t('toast.restoreDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.restoreFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    rowBusyId.value = null
  }
}

const handleDiscardEdition = async (id: string) => {
  rowBusyId.value = id
  try {
    await $fetch(`/api/v1/business/${businessId}/playbook/discard`, {
      method: 'POST',
      body: { editionId: id },
    })
    await refreshEditions()
    await refreshReadiness()
    toast.add({ title: t('toast.discardDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.discardFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    rowBusyId.value = null
  }
}

const downloadExport = (payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `playbook - ${businessId}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

const handleExportEdition = async () => {
  exporting.value = true
  try {
    const res = await $fetch<{ data?: { edition?: unknown } }>(`/api/v1/business/${businessId}/playbook/export`)
    if (!res.data?.edition) throw new Error(t('toast.exportFailed'))
    downloadExport(res.data.edition)
    toast.add({ title: t('toast.exportDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.exportFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    exporting.value = false
  }
}

const handleTriggerImport = () => importInput.value?.click()

const readImportFile = (file: File): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try { resolve(JSON.parse(String(reader.result ?? ''))) }
      catch (err: unknown) { reject(err) }
    }
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsText(file)
  })
}

const handleImportFile = async (event: Event) => {
  const file = (event.target as HTMLInputElement | null)?.files?.[0]
  if (!file) return
  importing.value = true
  try {
    const playbook = await readImportFile(file)
    const res = await $fetch<ServiceResult<PlaybookEdition>>(`/api/v1/business/${businessId}/playbook/import`, {
      method: 'POST',
      body: playbook,
    })
    if (res.data) applyEdition(res.data)
    await refreshEditions()
    toast.add({ title: t('toast.importDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.importFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    importing.value = false
  }
}

const handleMigrate = async () => {
  migrating.value = true
  try {
    const res = await $fetch<ServiceResult<{ migrated: boolean, duplicate: boolean, edition: PlaybookEdition | null }>>(
      `/api/v1/business/${businessId}/playbook/migrate`,
      { method: 'POST' },
    )
    if (res.data?.migrated && res.data.edition) {
      applyEdition(res.data.edition)
      await refreshEditions()
      toast.add({ title: t('toast.migrateDone'), icon: 'i-heroicons-check-circle', color: 'success' })
    }
    else {
      toast.add({ title: t('toast.migrateNoop'), icon: 'i-heroicons-information-circle', color: 'neutral' })
    }
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.migrateFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    migrating.value = false
  }
}

const handleGenerate = async () => {
  generating.value = true
  try {
    const res = await $fetch<ServiceResult<PlaybookEdition>>(`/api/v1/business/${businessId}/playbook/generate`, { method: 'POST' })
    if (res.data) applyEdition(res.data)
    await refreshEditions()
    toast.add({ title: t('toast.generateDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.generateFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    generating.value = false
  }
}

const parseEditor = (): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(editorText.value)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      toast.add({ title: t('toast.invalidJson'), icon: 'i-heroicons-x-circle', color: 'error' })
      return null
    }
    return parsed as Record<string, unknown>
  }
  catch {
    toast.add({ title: t('toast.invalidJson'), icon: 'i-heroicons-x-circle', color: 'error' })
    return null
  }
}

const handleSaveDraft = async () => {
  const playbook = parseEditor()
  if (!playbook) return
  saving.value = true
  try {
    const res = await $fetch<ServiceResult<PlaybookEdition>>(`/api/v1/business/${businessId}/playbook/draft`, {
      method: 'PUT',
      body: playbook,
    })
    if (res.data) applyEdition(res.data)
    await refreshEditions()
    toast.add({ title: t('toast.saveDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.saveFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    saving.value = false
  }
}

const handlePublishEdition = async (id: string) => {
  if (!id) {
    toast.add({ title: t('toast.noEdition'), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  publishingId.value = id
  try {
    await $fetch(`/api/v1/business/${businessId}/playbook/publish`, {
      method: 'POST',
      body: { editionId: id },
    })
    await refreshCurrent()
    await refreshEditions()
    toast.add({ title: t('toast.publishDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.publishFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    publishingId.value = null
  }
}

const handlePublishCurrent = () => { void handlePublishEdition(publishTargetId.value) }

const handleSync = async () => {
  syncing.value = true
  try {
    const res = await $fetch<ServiceResult<{ edition: PlaybookEdition }>>(`/api/v1/business/${businessId}/playbook/sync`, { method: 'POST' })
    if (res.data?.edition) currentEdition.value = res.data.edition
    toast.add({ title: t('toast.syncDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.syncFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    syncing.value = false
  }
}

const handleLoadEdition = (id: string) => {
  const found = editions.value.find(edition => edition.id === id)
  if (!found) return
  applyEdition(found)
}

const handleOpenQuiz = () => {
  refinedPlaybook.value = null
  quizOpen.value = true
}

const handleCloseQuiz = () => { quizOpen.value = false }

const handleRefineQuiz = async () => {
  if (answeredCount.value === 0) {
    toast.add({ title: t('quiz.needAnswers'), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  refining.value = true
  try {
    const answers = quizQuestions.value
      .filter(q => (quizAnswers.value[q.id] ?? '').trim().length > 0)
      .map(q => ({ section: quizGroupFor(q.id, q.section), question: q.label, answer: quizAnswers.value[q.id].trim() }))
    const res = await $fetch<{ playbook?: Record<string, unknown> }>(
      `/api/v1/business/${businessId}/playbook/refine`,
      { method: 'POST', body: { answers, useBusinessContext: true } },
    )
    if (!res.playbook) throw new Error(t('quiz.refineFailed'))
    refinedPlaybook.value = res.playbook
    toast.add({ title: t('quiz.refinedTitle'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('quiz.refineFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    refining.value = false
  }
}

const handleApplyRefined = async () => {
  if (!refinedPlaybook.value) return
  editorText.value = JSON.stringify(refinedPlaybook.value, null, 2)
  handleCloseQuiz()
  await handleSaveDraft()
}

onMounted(loadPage)
</script>

<template>
  <div class="mx-auto p-4 lg:py-6">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <UButton variant="ghost" color="neutral" icon="i-heroicons-arrow-left" size="sm" class="mb-2 -ml-2"
          @click="handleGoBack">
          {{ t('back') }}
        </UButton>
        <h1 class="text-xl font-semibold text-white/90">{{ t('title') }}</h1>
        <p class="text-sm text-white/40">{{ businessName || '…' }}</p>
      </div>
    </div>

    <!-- Flow stepper -->
    <nav class="mb-6 overflow-x-auto" aria-label="Content creation flow">
      <ol class="flex items-center gap-1 min-w-max rounded-xl border border-white/5 bg-[#111111] p-2">
        <li v-for="(step, index) in flowSteps" :key="step.to">
          <NuxtLink :to="step.to"
            class="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors" :class="index === activeFlowIndex
              ? 'bg-primary/15 text-primary'
              : 'text-white/40 hover:bg-white/5 hover:text-white/70'">
            <UIcon :name="step.icon" class="size-3.5 shrink-0" />
            <span class="hidden sm:inline">{{ step.label }}</span>
            <UIcon v-if="index < flowSteps.length - 1" name="i-lucide-chevron-right"
              class="size-3 text-white/15 ml-1" />
          </NuxtLink>
        </li>
      </ol>
    </nav>

    <!-- Loading -->
    <div v-if="pageBusy" class="flex items-center justify-center py-20">
      <UIcon name="i-heroicons-arrow-path" class="size-6 animate-spin text-white/40" />
    </div>

    <template v-else>
      <!-- Empty state -->
      <div v-if="!hasEdition" v-motion-fade :duration="250" class="flex flex-col items-center gap-6 py-16 text-center">
        <div
          class="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center">
          <UIcon name="i-lucide-book-open" class="size-10 text-primary" />
        </div>
        <div class="max-w-md">
          <h2 class="text-lg font-semibold text-white/90 mb-2">{{ t('empty.title') }}</h2>
          <p class="text-sm text-white/40">{{ t('empty.description') }}</p>
        </div>
        <div class="flex flex-wrap justify-center gap-3">
          <UButton color="primary" variant="solid" icon="i-heroicons-sparkles" :loading="generating"
            @click="handleGenerate">
            {{ t('empty.cta') }}
          </UButton>
          <UButton color="neutral" variant="outline" icon="i-heroicons-chat-bubble-left-right" @click="handleOpenQuiz">
            {{ t('quiz.start') }}
          </UButton>
        </div>
      </div>

      <!-- Main content -->
      <div v-else class="grid gap-6 lg:grid-cols-[1fr_320px]">
        <!-- Left column: Playbook content -->
        <div class="space-y-4 min-w-0">
          <!-- Status banner -->
          <div v-motion-fade :duration="200" class="rounded-xl border border-white/5 bg-[#111111] p-4">
            <div class="flex flex-wrap items-center gap-3">
              <UBadge color="neutral" variant="subtle">{{ t('header.edition') }}</UBadge>
              <UBadge color="neutral" variant="outline">{{ t('header.version', {
                version: currentEdition?.version ?? 1
              }) }}</UBadge>
              <UBadge :color="statusColor(currentEdition?.status ?? 'draft')" variant="subtle" class="capitalize">
                {{ t(`statuses.${currentEdition?.status ?? 'draft'}`) }}
              </UBadge>
              <UBadge v-if="readiness?.brandedReady" color="success" variant="subtle">{{ t('readiness.ready') }}
              </UBadge>
              <UBadge v-else-if="readiness" color="warning" variant="subtle">{{ t('readiness.notReady') }}</UBadge>
              <span class="ms-auto text-xs text-white/30">
                {{ currentEdition?.publishedAt ? t('header.published', { date: formatDate(currentEdition.publishedAt) })
                  : t('header.neverPublished') }}
              </span>
            </div>
          </div>

          <!-- Action bar -->
          <div v-motion-fade :duration="200" class="flex flex-wrap items-center gap-2">
            <UButton color="primary" variant="solid" icon="i-heroicons-check" :loading="publishingId !== null"
              @click="handlePublishCurrent">
              {{ t('actions.publish') }}
            </UButton>
            <UButton color="neutral" variant="outline" icon="i-heroicons-document-arrow-down" :loading="saving"
              @click="handleSaveDraft">
              {{ t('actions.save') }}
            </UButton>
            <UButton color="neutral" variant="outline" icon="i-heroicons-sparkles" :loading="generating"
              @click="handleGenerate">
              {{ t('actions.generate') }}
            </UButton>
            <UButton color="neutral" variant="outline" icon="i-heroicons-chat-bubble-left-right"
              @click="handleOpenQuiz">
              {{ t('actions.quiz') }}
            </UButton>
            <UDropdownMenu :items="[
              { label: t('actions.sync'), icon: 'i-heroicons-arrow-path', onSelect: handleSync, disabled: syncing },
              { label: t('actions.export'), icon: 'i-heroicons-arrow-down-tray', onSelect: handleExportEdition, disabled: exporting },
              { label: t('actions.import'), icon: 'i-heroicons-arrow-up-tray', onSelect: handleTriggerImport, disabled: importing },
              { type: 'separator' },
              { label: t('actions.migrate'), icon: 'i-heroicons-archive-box', onSelect: handleMigrate, disabled: migrating },
            ]">
              <UButton color="neutral" variant="ghost" icon="i-heroicons-ellipsis-horizontal" />
            </UDropdownMenu>
            <input ref="importInput" type="file" accept="application/json" class="hidden" @change="handleImportFile">
          </div>

          <!-- JSON Editor -->
          <UCard v-motion-fade :duration="200">
            <template #header>
              <div class="flex items-center justify-between w-full">
                <div>
                  <h2 class="font-semibold text-white/80">{{ t('editor.title') }}</h2>
                  <p class="text-xs text-white/30">{{ t('editor.description') }}</p>
                </div>
                <UButton color="neutral" variant="ghost" size="xs"
                  :icon="showAdvanced ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                  @click="showAdvanced = !showAdvanced">
                  {{ showAdvanced ? 'Hide editor' : 'Show editor' }}
                </UButton>
              </div>
            </template>
            <UFormField v-if="showAdvanced" name="playbookEditor">
              <UTextarea v-model="editorText" :placeholder="t('editor.placeholder')" :rows="20" spellcheck="false"
                class="w-full font-mono text-xs" />
            </UFormField>
            <p v-else class="text-sm text-white/30">{{ t('editor.description') }}</p>
          </UCard>

          <!-- Completion checklist -->
          <UCard v-if="editingCompletion" v-motion-fade :duration="200" data-testid="playbook-completion">
            <template #header>
              <h2 class="font-semibold text-white/80">{{ t('completion.title') }}</h2>
              <p class="text-xs text-white/30">{{ t('completion.description') }}</p>
            </template>
            <div class="flex flex-wrap items-center gap-2">
              <UBadge :color="editingCompletion.ready ? 'success' : 'warning'" variant="subtle">
                {{ editingCompletion.ready ? t('completion.ready') : t('completion.notReady', {
                  count:
                    editingCompletion.missingFields.length
                }) }}
              </UBadge>
              <UBadge v-for="group in editingCompletion.filledGroups" :key="group" color="success" variant="outline"
                size="xs">
                {{ group }}
              </UBadge>
            </div>
            <ul v-if="editingCompletion.missingFields.length > 0" class="mt-3 space-y-1 text-sm">
              <li v-for="field in editingCompletion.missingFields" :key="field"
                class="flex items-center gap-2 text-white/40">
                <UIcon name="i-heroicons-exclamation-circle" class="size-4 shrink-0" />
                {{ t('completion.missing', { field }) }}
              </li>
            </ul>
            <p v-else class="mt-3 text-sm text-white/40">{{ t('completion.allDone') }}</p>
          </UCard>
        </div>

        <!-- Right column: History + Quick actions -->
        <aside class="space-y-4">
          <!-- Quick actions card -->
          <UCard v-motion-fade :duration="200">
            <template #header>
              <h3 class="font-semibold text-white/80">{{ t('actions.title') }}</h3>
            </template>
            <div class="space-y-2">
              <UButton color="primary" variant="solid" icon="i-heroicons-check" :loading="publishingId !== null"
                class="w-full justify-center" @click="handlePublishCurrent">
                {{ t('actions.publish') }}
              </UButton>
              <UButton color="neutral" variant="outline" icon="i-heroicons-document-arrow-down" :loading="saving"
                class="w-full justify-center" @click="handleSaveDraft">
                {{ t('actions.save') }}
              </UButton>
              <UButton color="neutral" variant="outline" icon="i-heroicons-sparkles" :loading="generating"
                class="w-full justify-center" @click="handleGenerate">
                {{ t('actions.generate') }}
              </UButton>
              <UButton color="neutral" variant="outline" icon="i-heroicons-chat-bubble-left-right"
                class="w-full justify-center" @click="handleOpenQuiz">
                {{ t('actions.quiz') }}
              </UButton>
            </div>
          </UCard>

          <!-- History card -->
          <UCard v-motion-fade :duration="200">
            <template #header>
              <h3 class="font-semibold text-white/80">{{ t('history.title') }}</h3>
            </template>
            <div v-if="editions.length === 0" class="py-4 text-center text-sm text-white/30">
              {{ t('history.empty') }}
            </div>
            <ul v-else class="space-y-2 max-h-96 overflow-y-auto">
              <li v-for="edition in editions" :key="edition.id" class="rounded-lg bg-white/5 p-3 space-y-2">
                <div class="flex items-center gap-2 text-xs">
                  <UBadge color="neutral" variant="outline" size="xs">{{ t('header.version', {
                    version: edition.version
                  }) }}
                  </UBadge>
                  <UBadge :color="statusColor(edition.status)" variant="subtle" size="xs" class="capitalize">
                    {{ t(`statuses.${edition.status}`) }}
                  </UBadge>
                  <span class="ms-auto text-white/20 font-mono">{{ shortHash(edition.hash) }}</span>
                </div>
                <div class="flex items-center gap-2 text-xs text-white/30">
                  <span>{{ t('history.updated', { date: formatDate(edition.updatedAt) }) }}</span>
                </div>
                <div class="flex gap-1.5">
                  <UButton color="neutral" variant="ghost" size="xs" @click="handleLoadEdition(edition.id)">
                    {{ t('history.load') }}
                  </UButton>
                  <UButton v-if="edition.status === 'draft'" color="primary" variant="outline" size="xs"
                    :loading="publishingId === edition.id" @click="handlePublishEdition(edition.id)">
                    {{ t('history.publish') }}
                  </UButton>
                  <UButton v-if="edition.status !== 'draft'" color="neutral" variant="ghost" size="xs"
                    :loading="rowBusyId === edition.id" @click="handleRestoreEdition(edition.id)">
                    {{ t('history.restore') }}
                  </UButton>
                  <UButton v-if="edition.status === 'draft'" color="error" variant="ghost" size="xs"
                    :loading="rowBusyId === edition.id" @click="handleDiscardEdition(edition.id)">
                    {{ t('history.discard') }}
                  </UButton>
                </div>
              </li>
            </ul>
          </UCard>
        </aside>
      </div>
    </template>

    <!-- Quiz modal -->
    <UModal v-model:open="quizOpen" :title="t('quiz.title')" :description="t('quiz.description')"
      :ui="{ content: 'max-w-3xl' }">
      <template #body>
        <div v-if="!refinedPlaybook" class="space-y-6">
          <p class="text-sm text-white/40">{{ t('quiz.description') }}</p>
          <section v-for="section in quizSections" :key="section.id" class="space-y-3">
            <h3 class="text-sm font-semibold text-white/70">{{ t(`quiz.s.${section.id}`) }}</h3>
            <UFormField v-for="qid in section.questions" :key="qid" :label="t(`quiz.q.${qid}`)" :name="`quiz-${qid}`">
              <UTextarea v-model="quizAnswers[qid]" :rows="2" :placeholder="t('quiz.answerPlaceholder')"
                class="w-full" />
            </UFormField>
          </section>
          <p class="text-xs text-white/30">{{ t('quiz.progress', {
            answered: answeredCount, total: quizQuestions.length
          }) }}</p>
        </div>
        <div v-else class="space-y-3">
          <h3 class="text-sm font-semibold text-white/70">{{ t('quiz.refinedTitle') }}</h3>
          <p class="text-sm text-white/40">{{ t('quiz.refinedDescription') }}</p>
          <pre
            class="max-h-96 overflow-auto rounded-xl bg-white/5 p-3 font-mono text-xs text-white/60">{{ JSON.stringify(refinedPlaybook, null, 2) }}</pre>
        </div>
      </template>
      <template #footer>
        <div class="flex flex-wrap justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="handleCloseQuiz">
            {{ t('quiz.close') }}
          </UButton>
          <UButton v-if="!refinedPlaybook" color="neutral" variant="outline" icon="i-heroicons-document-arrow-down"
            :loading="intakeSaving" @click="handleSaveIntakeDraft">
            {{ t('quiz.saveDraft') }}
          </UButton>
          <UButton v-if="!refinedPlaybook" color="primary" variant="solid" icon="i-heroicons-sparkles"
            :loading="refining" @click="handleRefineQuiz">
            {{ t('quiz.refine') }}
          </UButton>
          <UButton v-else color="primary" variant="solid" icon="i-heroicons-check" :loading="saving"
            @click="handleApplyRefined">
            {{ t('quiz.apply') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped></style>

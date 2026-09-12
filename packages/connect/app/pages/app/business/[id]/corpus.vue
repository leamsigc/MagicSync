<i18n src="./corpus.json"></i18n>
<script lang="ts" setup>
const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const businessId = route.params.id as string

interface ServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

interface CorpusRow {
  section?: string
  key?: string
  content: string
}

interface BrandReadiness {
  brandedReady: boolean
  editionId: string | null
  corpus: { ready: boolean, missingSections: string[], warnings: string[] }
}

const SECTION_IDS = [
  'voice_guide',
  'tone_examples',
  'content_hooks',
  'positioning',
  'offer_architecture',
  'competitors',
  'seo_keywords',
  'testimonials',
] as const

const KEY_IDS = ['cta_links', 'author', 'image_style'] as const

const BUDGET_CHARS = 6000

const pageBusy = ref(true)
const busyKey = ref<string | null>(null)
const contents = ref<Record<string, string>>({})
const preview = ref('')
const readiness = ref<BrandReadiness | null>(null)
const exporting = ref(false)
const importing = ref(false)
const importInput = ref<HTMLInputElement | null>(null)

useHead({
  title: t('seo_title'),
  meta: [
    { name: 'description', content: t('seo_description') }
  ]
})

const previewLength = computed(() => preview.value.length)
const overBudget = computed(() => previewLength.value > BUDGET_CHARS)

function isFilled(id: string) {
  return (contents.value[id] ?? '').trim().length > 0
}

function readErrorMessage(err: unknown) {
  const fetchError = err as { data?: { message?: string, statusMessage?: string }, message?: string }
  return fetchError.data?.message || fetchError.data?.statusMessage || fetchError.message || t('toast.loadFailed')
}

function handleGoBack() {
  router.push(`/app/business/${businessId}/playbook`)
}

async function refreshPreview() {
  try {
    const res = await $fetch<ServiceResult<string>>(`/api/v1/business/${businessId}/context`)
    preview.value = res.data ?? ''
  }
  catch {
    preview.value = ''
  }
}

async function refreshReadiness() {
  try {
    const res = await $fetch<ServiceResult<BrandReadiness>>(`/api/v1/business/${businessId}/playbook/readiness`)
    readiness.value = res.data ?? null
  }
  catch {
    readiness.value = null
  }
}

async function loadPage() {
  pageBusy.value = true
  try {
    const [sectionsRes, keysRes] = await Promise.all([
      $fetch<ServiceResult<CorpusRow[]>>(`/api/v1/business/${businessId}/corpus`),
      $fetch<ServiceResult<CorpusRow[]>>(`/api/v1/business/${businessId}/brand-keys`),
    ])
    const next: Record<string, string> = {}
    for (const row of sectionsRes.data ?? []) {
      if (row.section) next[row.section] = row.content
    }
    for (const row of keysRes.data ?? []) {
      if (row.key) next[row.key] = row.content
    }
    contents.value = next
    await refreshPreview()
    await refreshReadiness()
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.loadFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    pageBusy.value = false
  }
}

async function refreshAfterSave() {
  await refreshPreview()
  await refreshReadiness()
}

async function handleSaveSection(section: string) {
  busyKey.value = section
  try {
    await $fetch(`/api/v1/business/${businessId}/corpus`, {
      method: 'PUT',
      body: { section, content: contents.value[section] ?? '' }
    })
    await refreshAfterSave()
    toast.add({ title: t('toast.saveDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.saveFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    busyKey.value = null
  }
}

function downloadCorpus(payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `corpus-${businessId}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

async function handleExportCorpus() {
  exporting.value = true
  try {
    const sections: Record<string, string> = {}
    const keys: Record<string, string> = {}
    for (const section of SECTION_IDS) sections[section] = contents.value[section] ?? ''
    for (const key of KEY_IDS) keys[key] = contents.value[key] ?? ''
    downloadCorpus({ format: 'magicsync-corpus/v1', exportedAt: new Date().toISOString(), sections, keys })
    toast.add({ title: t('toast.exportDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.exportFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    exporting.value = false
  }
}

function handleTriggerCorpusImport() {
  importInput.value?.click()
}

function collectImportEntries(source: Record<string, unknown>): Array<[string, unknown]> {
  const sections = source.sections as Record<string, unknown> | undefined
  const keys = source.keys as Record<string, unknown> | undefined
  const entries: Array<[string, unknown]> = [...Object.entries(sections ?? {}), ...Object.entries(keys ?? {})]
  for (const [id, value] of Object.entries(source)) {
    if (id !== 'sections' && id !== 'keys' && id !== 'format' && id !== 'exportedAt') entries.push([id, value])
  }
  return entries
}

function pickKnownCorpus(entries: Array<[string, unknown]>): Record<string, string> | null {
  const known = new Set<string>([...SECTION_IDS, ...KEY_IDS])
  const next: Record<string, string> = {}
  for (const [id, value] of entries) {
    if (!known.has(id) || typeof value !== 'string') return null
    next[id] = value
  }
  return next
}

function parseCorpusImport(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return pickKnownCorpus(collectImportEntries(raw as Record<string, unknown>))
}

function isCorpusSection(id: string): boolean {
  return (SECTION_IDS as readonly string[]).includes(id)
}

function corpusPutPath(id: string): string {
  return isCorpusSection(id) ? 'corpus' : 'brand-keys'
}

function corpusPutBody(id: string, content: string): Record<string, string> {
  return isCorpusSection(id) ? { section: id, content } : { key: id, content }
}

async function handleImportCorpusFile(event: Event) {
  const file = (event.target as HTMLInputElement | null)?.files?.[0]
  if (!file) {
    return
  }
  importing.value = true
  try {
    const parsed: unknown = JSON.parse(await file.text())
    const next = parseCorpusImport(parsed)
    if (!next) {
      throw new Error(t('toast.importInvalid'))
    }
    for (const [id, content] of Object.entries(next)) {
      await $fetch(`/api/v1/business/${businessId}/${corpusPutPath(id)}`, { method: 'PUT', body: corpusPutBody(id, content) })
      contents.value[id] = content
    }
    await refreshAfterSave()
    toast.add({ title: t('toast.importDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.importFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    importing.value = false
  }
}

async function handleSaveKey(key: string) {
  busyKey.value = key
  try {
    await $fetch(`/api/v1/business/${businessId}/brand-keys`, {
      method: 'PUT',
      body: { key, content: contents.value[key] ?? '' }
    })
    await refreshAfterSave()
    toast.add({ title: t('toast.saveDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.saveFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    busyKey.value = null
  }
}

onMounted(loadPage)
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <BasePageHeader :title="t('title')" :description="t('description')">
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <UButton variant="outline" color="neutral" icon="i-heroicons-arrow-down-tray" :loading="exporting" data-testid="corpus-export" @click="handleExportCorpus">
            {{ t('actions.export') }}
          </UButton>
          <UButton variant="outline" color="neutral" icon="i-heroicons-arrow-up-tray" :loading="importing" data-testid="corpus-import" @click="handleTriggerCorpusImport">
            {{ t('actions.import') }}
          </UButton>
          <UButton variant="ghost" color="neutral" icon="i-heroicons-arrow-left" @click="handleGoBack">
            {{ t('back') }}
          </UButton>
        </div>
        <input ref="importInput" type="file" accept="application/json" class="hidden" @change="handleImportCorpusFile" >
      </template>
    </BasePageHeader>

    <div v-if="pageBusy" class="flex items-center justify-center py-20">
      <UIcon name="i-heroicons-arrow-path" class="size-6 animate-spin" />
    </div>

    <template v-else>
      <UCard v-motion-fade-visible :duration="200" data-testid="corpus-readiness">
        <template #header>
          <h2 class="font-semibold">{{ t('readiness.title') }}</h2>
        </template>
        <div v-if="readiness" class="flex flex-wrap items-center gap-2">
          <UBadge :color="readiness.corpus.ready ? 'success' : 'warning'" variant="subtle">
            {{ readiness.corpus.ready ? t('readiness.ready') : t('readiness.notReady', { count: readiness.corpus.missingSections.length }) }}
          </UBadge>
          <UBadge :color="readiness.brandedReady ? 'success' : 'neutral'" variant="subtle">
            {{ readiness.brandedReady ? t('readiness.brandedReady') : t('readiness.brandedBlocked') }}
          </UBadge>
        </div>
      </UCard>

      <UCard v-motion-fade-visible :duration="200">
        <template #header>
          <h2 class="font-semibold">{{ t('sections.title') }}</h2>
        </template>
        <div class="space-y-5">
          <section v-for="section in SECTION_IDS" :key="section" :data-testid="`corpus-section-${section}`">
            <div class="mb-1 flex items-center gap-2">
              <h3 class="text-sm font-semibold">{{ t(`sections.${section}`) }}</h3>
              <UBadge :color="isFilled(section) ? 'success' : 'neutral'" variant="subtle" size="xs">
                {{ isFilled(section) ? t('actions.filledBadge') : t('actions.emptyBadge') }}
              </UBadge>
              <UButton
                class="ms-auto"
                size="xs"
                color="primary"
                variant="outline"
                :loading="busyKey === section"
                :data-testid="`corpus-save-${section}`"
                @click="handleSaveSection(section)"
              >
                {{ t('actions.save') }}
              </UButton>
            </div>
            <UTextarea v-model="contents[section]" :rows="4" class="w-full font-mono text-xs" />
          </section>
        </div>
      </UCard>

      <UCard v-motion-fade-visible :duration="200">
        <template #header>
          <h2 class="font-semibold">{{ t('keys.title') }}</h2>
        </template>
        <div class="space-y-5">
          <section v-for="key in KEY_IDS" :key="key" :data-testid="`corpus-key-${key}`">
            <div class="mb-1 flex items-center gap-2">
              <h3 class="text-sm font-semibold">{{ t(`keys.${key}`) }}</h3>
              <UButton
                class="ms-auto"
                size="xs"
                color="primary"
                variant="outline"
                :loading="busyKey === key"
                :data-testid="`corpus-save-${key}`"
                @click="handleSaveKey(key)"
              >
                {{ t('actions.save') }}
              </UButton>
            </div>
            <UTextarea v-model="contents[key]" :rows="2" class="w-full font-mono text-xs" />
          </section>
        </div>
      </UCard>

      <UCard v-motion-fade-visible :duration="200">
        <template #header>
          <h2 class="font-semibold">{{ t('preview.title') }}</h2>
          <p class="text-sm text-muted">{{ t('preview.description') }}</p>
        </template>
        <div v-if="overBudget" v-motion-fade :duration="200" class="mb-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-warning">
          {{ t('budget.warning', { count: previewLength }) }}
        </div>
        <pre v-if="preview" data-testid="corpus-preview" class="max-h-96 overflow-auto rounded-xl bg-elevated p-3 font-mono text-xs">{{ preview }}</pre>
        <p v-else class="py-4 text-center text-sm text-muted">{{ t('preview.empty') }}</p>
      </UCard>
    </template>
  </div>
</template>

<style scoped></style>

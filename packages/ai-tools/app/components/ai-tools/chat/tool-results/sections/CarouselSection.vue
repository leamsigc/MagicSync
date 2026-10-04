<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
import { parseSectionPayload, type ToolCallLike } from '../../../../../composables/ai-tools/chat/runSections'
import { toSlideData } from '#layers/BaseUI/app/utils/carouselTemplates'
import CarouselSlideStrip from '#layers/BaseUI/app/components/carousel/CarouselSlideStrip.vue'
import CarouselSlideViewer from '#layers/BaseUI/app/components/carousel/CarouselSlideViewer.vue'

interface WorkflowSlide {
  id: string
  headline: string
  body: string
  kicker?: string
  items?: string[]
  stat?: string
  statLabel?: string
  quote?: string
  author?: string
  cta?: string
  template?: string
}

interface SocialAccount {
  id: string
  platform: string
  accountName: string
}

interface BestTimeSlot {
  platform: string
  dayOfWeek: number
  hour: number
  avgEngagement: number
  postCount: number
}

const props = defineProps<{
  calls: ToolCallLike[]
  businessId?: string | null
  isStreaming?: boolean
}>()

const emit = defineEmits<{
  (e: 'revise', intent: { artifactId: string, slideId: string, version: number }): void
}>()

const { t } = useI18n()
const toast = useToast()

/** Delivery flow state (approve → create → post → scheduled). The step rail
 * lives in RunCard and reflects real run status — never this local state. */
type DeliveryStage = 'review' | 'creating' | 'post' | 'scheduled'
const stage = ref<DeliveryStage>('review')
const busy = ref(false)
const accounts = ref<SocialAccount[]>([])
const selectedAccounts = ref<string[]>([])
const bestTimes = ref<BestTimeSlot[]>([])
const selectedSlot = ref<number | null>(null)
const customTime = ref('')
const scheduleResult = ref<{ when: string, count: number } | null>(null)
const deleted = ref(false)

function findCarouselPayload(value: Record<string, unknown> | null, depth = 0): Record<string, unknown> | null {
  if (!value || depth > 3) return null
  if (Array.isArray(value.slides)) return value
  for (const key of ['data', 'output', 'result']) {
    const nested = value[key]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const found = findCarouselPayload(nested as Record<string, unknown>, depth + 1)
      if (found) return found
    }
  }
  return null
}

const payload = computed<Record<string, unknown>>(() => {
  for (const call of props.calls) {
    const parsed = findCarouselPayload(parseSectionPayload(call.result))
    if (parsed) return parsed
  }
  return {}
})

const slides = computed(() => (Array.isArray(payload.value.slides) ? payload.value.slides : []) as WorkflowSlide[])
const version = computed(() => typeof payload.value.version === 'number' ? payload.value.version : 1)
const artifactId = computed(() => typeof payload.value.artifactId === 'string' ? payload.value.artifactId : '')
const platform = computed(() => typeof payload.value.platform === 'string' ? payload.value.platform : 'instagram')
const caption = computed(() => typeof payload.value.caption === 'string' ? payload.value.caption : '')

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function platformLabel(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
}

function formatSlot(slot: BestTimeSlot): string {
  const hour = String(slot.hour).padStart(2, '0')
  return `${dayNames[slot.dayOfWeek]} · ${hour}:00`
}

function slotHint(slot: BestTimeSlot): string {
  if (slot.avgEngagement > 0) return t('workflow.strongEngagement', { count: slot.postCount })
  return t('workflow.consistentActivity', { count: slot.postCount })
}

function handleApprove() {
  if (!artifactId.value || !props.businessId || busy.value || props.isStreaming) return
  void approveAndCreate()
}

function handleRequestChanges() {
  if (!artifactId.value || props.isStreaming) return
  emit('revise', { artifactId: artifactId.value, slideId: '', version: version.value })
}

function handleKeepDraft(): void {
  toast.add({ title: t('workflow.keptAsDraft'), icon: 'i-heroicons-bookmark', color: 'neutral' })
}

/** The stable id this artifact saves under, so re-saving updates one carousel. */
const carouselId = computed(() => `chat-${artifactId.value || payloadHash()}`)

function payloadHash(): string {
  const source = JSON.stringify(slides.value.map(slide => slide.id ?? slide.headline))
  let hash = 0
  for (let i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) | 0
  return Math.abs(hash).toString(36)
}

/** Shape the chat's slides into what the carousel save API accepts. */
function slidesForSave(): Record<string, unknown>[] {
  return slides.value.map(slide => ({
    id: slide.id || `slide-${slide.headline?.slice(0, 12) || 'untitled'}`,
    templateKey: templateKeyForSlide(slide),
    data: toSlideData(slide),
    pattern: 'dots',
    patternColor: '#f97316',
    patternOpacity: 0.08,
    bgImage: null,
    customHtml: '',
  }))
}

const savedCarouselId = ref('')
const saving = ref(false)

/**
 * The editor only exists as a page, and it can only load a carousel that has
 * been persisted — so the modal embeds that page and asks for a save first.
 */
const editorUrl = computed(() => {
  const id = savedCarouselId.value
  if (!id || !props.businessId) return ''
  return `/tools/carousel-creator?embed=1&carouselId=${encodeURIComponent(id)}`
})

/** Persist on demand so switching to Edit has something to open. */
function handleEditorRequested(): void {
  if (!savedCarouselId.value && !saving.value) void handleSaveToCarousels()
}

/**
 * Put this carousel in the user's carousels so the editor can open it.
 *
 * The preview already draws these slides; saving reuses the same template
 * mapping, so what was reviewed is what the editor opens.
 */
async function handleSaveToCarousels(): Promise<void> {
  if (saving.value || slides.value.length === 0) return
  saving.value = true
  try {
    await $fetch('/api/v1/carousel', {
      method: 'POST',
      body: {
        id: carouselId.value,
        name: caption.value.slice(0, 80) || t('workflow.saveDefaultName'),
        slides: slidesForSave(),
        palette: { bg: '#0f0e0d', text: '#fafaf9', accent: '#f97316' },
      },
    })
    savedCarouselId.value = carouselId.value
    toast.add({ title: t('workflow.savedToCarousels'), icon: 'i-heroicons-bookmark', color: 'success' })
  }
  catch (error: unknown) {
    toast.add({
      title: t('workflow.saveToCarouselsFailed'),
      description: error instanceof Error ? error.message : undefined,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
  finally {
    saving.value = false
  }
}

function handleOpenEditor(): void {
  if (!artifactId.value || !props.businessId) return
  const id = savedCarouselId.value || carouselId.value
  window.open(`/tools/carousel-creator?carouselId=${encodeURIComponent(id)}&businessId=${encodeURIComponent(props.businessId)}`, '_blank', 'noopener,noreferrer')
}

async function handleDelete(): Promise<void> {
  if (!artifactId.value || busy.value) return
  busy.value = true
  try {
    await $fetch(`/api/v1/artifacts/${artifactId.value}`, {
      method: 'DELETE',
      query: { businessId: props.businessId },
    })
    deleted.value = true
    toast.add({ title: t('workflow.deleted'), icon: 'i-heroicons-trash', color: 'success' })
  }
  catch (error: unknown) {
    toast.add({
      title: t('workflow.deleteFailed'),
      description: error instanceof Error ? error.message : undefined,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  }
  finally {
    busy.value = false
  }
}

/** Mirrors the strip's own choice, so a saved slide keeps its template. */
function templateKeyForSlide(slide: WorkflowSlide): string {
  if (slide.template) return slide.template
  if (slide.cta) return 'cta'
  if (slide.quote) return 'quote'
  if (slide.items?.length) return 'tips-list'
  return 'big-statement'
}

/** Every string the shared strip and viewer show, from this file's own i18n. */
const carouselLabels = computed(() => ({
  prev: t('carousel.prev'),
  next: t('carousel.next'),
  goTo: t('carousel.goTo'),
  pages: t('carousel.pages'),
  expand: t('carousel.expand'),
  edit: t('carousel.edit'),
  editHint: t('carousel.editHint'),
  editSave: t('carousel.editSave'),
  editSaving: t('carousel.editSaving'),
  allPages: t('carousel.allPages'),
  single: t('carousel.single'),
  close: t('carousel.close'),
  of: t('carousel.of'),
}))

const viewerOpen = ref(false)
const viewerIndex = ref(0)

function handleExpand(index: number): void {
  viewerIndex.value = index
  viewerOpen.value = true
}

async function approveAndCreate() {
  busy.value = true
  stage.value = 'creating'
  try {
    await $fetch(`/api/v1/artifacts/${artifactId.value}/review`, {
      method: 'POST',
      query: { businessId: props.businessId },
      body: { decision: 'approved', feedback: '', version: version.value },
    })
    await $fetch(`/api/v1/artifacts/${artifactId.value}/materialize`, {
      method: 'POST',
      query: { businessId: props.businessId },
    })
    stage.value = 'post'
    toast.add({ title: t('workflow.created'), icon: 'i-heroicons-check-circle', color: 'success' })
    await loadPostSetup()
  } catch (error: unknown) {
    stage.value = 'review'
    toast.add({
      title: t('workflow.approveFailed'),
      description: error instanceof Error ? error.message : undefined,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    busy.value = false
  }
}

async function loadPostSetup() {
  try {
    const list = await $fetch<SocialAccount[] | { data?: SocialAccount[] }>('/api/v1/social-accounts', {
      query: props.businessId ? { businessId: props.businessId } : {},
    })
    const rows = Array.isArray(list) ? list : (list.data ?? [])
    accounts.value = rows
    selectedAccounts.value = rows
      .filter(account => account.platform?.toLowerCase() === platform.value.toLowerCase())
      .map(account => account.id)
    if (selectedAccounts.value.length === 0 && rows.length > 0) {
      selectedAccounts.value = rows.slice(0, 1).map(account => account.id)
    }
  } catch {
    accounts.value = []
  }
  try {
    const res = await $fetch<{ success: boolean, data?: { topSlots?: BestTimeSlot[] } }>('/api/v1/stats', {
      query: { mode: 'best-times', days: 90, businessId: props.businessId ?? undefined },
    })
    bestTimes.value = (res.data?.topSlots ?? []).slice(0, 3)
  } catch {
    bestTimes.value = []
  }
}

function handleToggleAccount(id: string) {
  selectedAccounts.value = selectedAccounts.value.includes(id)
    ? selectedAccounts.value.filter(entry => entry !== id)
    : [...selectedAccounts.value, id]
}

function handleSelectSlot(index: number) {
  selectedSlot.value = selectedSlot.value === index ? null : index
  if (selectedSlot.value !== null) customTime.value = ''
}

function nextOccurrence(slot: BestTimeSlot): Date {
  const now = new Date()
  const date = new Date(now)
  date.setHours(slot.hour, 0, 0, 0)
  let delta = (slot.dayOfWeek - now.getDay() + 7) % 7
  if (delta === 0 && date.getTime() <= now.getTime()) delta = 7
  date.setDate(now.getDate() + delta)
  return date
}

function resolveScheduleTime(): Date | null {
  if (customTime.value) return new Date(customTime.value)
  if (selectedSlot.value === null) return null
  const slot = bestTimes.value[selectedSlot.value]
  if (!slot) return null
  return nextOccurrence(slot)
}

function handleSchedule() {
  if (!selectedAccounts.value.length || busy.value) {
    toast.add({ title: t('workflow.selectAccountsFirst'), icon: 'i-heroicons-x-circle', color: 'warning' })
    return
  }
  const when = resolveScheduleTime()
  if (!when || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
    toast.add({ title: t('workflow.pickTimeFirst'), icon: 'i-heroicons-x-circle', color: 'warning' })
    return
  }
  void scheduleFor(when)
}

async function scheduleFor(when: Date) {
  busy.value = true
  try {
    await $fetch(`/api/v1/artifacts/${artifactId.value}/schedule`, {
      method: 'POST',
      query: { businessId: props.businessId },
      body: { scheduledAt: when.toISOString(), targetAccountIds: selectedAccounts.value },
    })
    stage.value = 'scheduled'
    scheduleResult.value = { when: when.toLocaleString(), count: selectedAccounts.value.length }
    toast.add({ title: t('workflow.scheduled'), icon: 'i-heroicons-check-circle', color: 'success' })
  } catch (error: unknown) {
    toast.add({
      title: t('workflow.scheduleFailed'),
      description: error instanceof Error ? error.message : undefined,
      icon: 'i-heroicons-x-circle',
      color: 'error',
    })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section v-if="!deleted" v-motion-fade data-testid="run-section" data-kind="carousel" :duration="250" class="space-y-4">
    <!-- Carousel preview -->
    <section class="overflow-hidden rounded-xl border border-default bg-default">
      <div class="flex items-center justify-between gap-2 border-b border-default px-4 py-3.5">
        <p class="font-semibold text-highlighted">{{ t('workflow.previewTitle') }}</p>
        <p class="text-xs text-muted">{{ t('workflow.slideMeta', { count: slides.length, platform: platformLabel(platform) }) }}</p>
      </div>
      <div class="p-4">
        <CarouselSlideStrip
          v-if="slides.length"
          :slides="slides"
          :labels="carouselLabels"
          @expand="handleExpand"
        />
        <p class="mt-3 text-xs text-muted">{{ t('workflow.previewHint') }}</p>
        <p v-if="!savedCarouselId" v-motion-fade :duration="200" class="mt-1 text-xs text-muted">{{ t('workflow.editUnlockHint') }}</p>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2 border-t border-default px-5 py-3.5">
        <p class="text-xs text-muted">{{ stage === 'scheduled' ? t('workflow.afterScheduleNote') : t('workflow.reviewNote') }}</p>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            v-if="stage === 'review'"
            size="sm"
            variant="outline"
            color="neutral"
            class="whitespace-nowrap"
            icon="i-heroicons-pencil"
            :disabled="!artifactId || isStreaming"
            @click="handleRequestChanges"
          >
            {{ t('workflow.requestChanges') }}
          </UButton>
          <UButton
            v-if="stage === 'review'"
            size="sm"
            color="primary"
            variant="solid"
            class="whitespace-nowrap"
            :loading="busy || isStreaming"
            :disabled="!artifactId || !businessId"
            @click="handleApprove"
          >
            {{ t('workflow.approveSchedule') }}
          </UButton>
          <UButton
            v-if="stage === 'review'"
            size="sm"
            color="neutral"
            variant="outline"
            class="whitespace-nowrap"
            :disabled="busy || isStreaming"
            @click="handleKeepDraft"
          >
            {{ t('workflow.keepDraft') }}
          </UButton>
          <UButton
            v-if="stage === 'review'"
            size="sm"
            variant="soft"
            color="primary"
            class="whitespace-nowrap"
            icon="i-heroicons-bookmark"
            :loading="saving"
            :disabled="slides.length === 0 || isStreaming"
            data-testid="carousel-save-to-carousels"
            @click="handleSaveToCarousels"
          >
            {{ savedCarouselId ? t('workflow.savedToCarousels') : t('workflow.saveToCarousels') }}
          </UButton>
          <UButton
            v-if="stage === 'review'"
            size="sm"
            variant="ghost"
            color="neutral"
            class="whitespace-nowrap"
            icon="i-heroicons-arrow-top-right-on-square"
            :disabled="!artifactId || isStreaming"
            @click="handleOpenEditor"
          >
            {{ t('workflow.openEditor') }}
          </UButton>
          <UButton
            v-if="stage === 'review'"
            size="sm"
            color="error"
            variant="ghost"
            class="whitespace-nowrap"
            icon="i-heroicons-trash"
            :loading="busy"
            :disabled="!artifactId || isStreaming"
            @click="handleDelete"
          >
            {{ t('workflow.delete') }}
          </UButton>
          <UBadge v-else-if="stage === 'creating'" color="warning" variant="subtle">{{ t('workflow.creating') }}</UBadge>
          <UBadge v-else color="success" variant="subtle">{{ t('workflow.created') }}</UBadge>
        </div>
      </div>
    </section>

    <!-- Post setup (after approval) -->
    <section v-if="stage === 'post' || stage === 'scheduled'" v-motion-fade :duration="200" class="grid gap-4 rounded-xl border border-default bg-default p-4 lg:grid-cols-2">
      <div>
        <h3 class="font-semibold text-highlighted">{{ t('workflow.whereToPost') }}</h3>
        <div v-if="accounts.length === 0" class="mt-2 text-xs text-muted">{{ t('workflow.noAccounts') }}</div>
        <div v-else class="mt-2 space-y-1.5">
          <button
            v-for="account in accounts"
            :key="account.id"
            type="button"
            class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-elevated"
            @click="handleToggleAccount(account.id)"
          >
            <span
              class="flex h-4 w-4 items-center justify-center rounded border"
              :class="selectedAccounts.includes(account.id) ? 'border-primary bg-primary text-inverted' : 'border-muted'"
            >
              <UIcon v-if="selectedAccounts.includes(account.id)" name="i-heroicons-check" class="h-3 w-3" />
            </span>
            <span class="font-medium">{{ account.platform }}</span>
            <span class="truncate text-muted">· {{ account.accountName }}</span>
          </button>
        </div>
        <p class="mt-2 text-xs text-muted">{{ t('workflow.accountHint') }}</p>
      </div>
      <div>
        <h3 class="font-semibold text-highlighted">{{ t('workflow.suggestedTimes') }}</h3>
        <div v-if="bestTimes.length === 0" class="mt-2 text-xs text-muted">{{ t('workflow.noTimes') }}</div>
        <div v-else class="mt-1 divide-y divide-default">
          <button
            v-for="(slot, index) in bestTimes"
            :key="`${slot.dayOfWeek}-${slot.hour}`"
            type="button"
            class="flex w-full items-center justify-between gap-2 py-2 text-left text-sm"
            @click="handleSelectSlot(index)"
          >
            <span><b class="font-semibold">{{ formatSlot(slot) }}</b> — <span class="text-muted">{{ slotHint(slot) }}</span></span>
            <span
              class="flex h-4 w-4 items-center justify-center rounded-full border"
              :class="selectedSlot === index ? 'border-primary bg-primary' : 'border-muted'"
            />
          </button>
        </div>
        <UInput v-model="customTime" type="datetime-local" size="sm" class="mt-2 w-full" :aria-label="t('workflow.customTime')" />
        <h3 class="mt-4 font-semibold text-highlighted">{{ t('workflow.captionDraft') }}</h3>
        <p class="text-xs text-muted">{{ t('workflow.captionHint') }}</p>
        <div class="mt-2 rounded-lg bg-elevated p-2.5">
          <Markdown :value="caption" class="text-sm" />
        </div>
        <UButton
          v-if="stage === 'post'"
          class="mt-3"
          color="primary"
          variant="solid"
          :loading="busy"
          :disabled="selectedAccounts.length === 0"
          @click="handleSchedule"
        >
          {{ t('workflow.schedule') }}
        </UButton>
        <p v-else-if="scheduleResult" class="mt-3 text-sm text-success">
          ✓ {{ t('workflow.scheduledFor', { when: scheduleResult.when, count: scheduleResult.count }) }}
        </p>
      </div>
    </section>

    <CarouselSlideViewer
      v-model:open="viewerOpen"
      :slides="slides"
      :labels="carouselLabels"
      :initial-index="viewerIndex"
      :editor-url="editorUrl"
      :editor-busy="saving"
      @edit="handleEditorRequested"
    />
  </section>
</template>

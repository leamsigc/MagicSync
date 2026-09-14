<i18n src="../artifact.json"></i18n>
<script setup lang="ts">
import type { ChatArtifact } from '../composables/useChatArtifacts'

const props = defineProps<{
  artifact: ChatArtifact
  businessId: string
  itemId?: string | null
}>()

const emit = defineEmits<{
  (event: 'changed', id: string): void
}>()

const { t } = useI18n()
const toast = useToast()
const router = useRouter()

const editing = ref(false)
const editText = ref('')
const busyAction = ref<string | null>(null)
const feedback = ref('')
const showFeedback = ref(false)
const scheduleAt = ref('')
const virality = ref<Record<string, unknown> | null>(null)
const engagement = ref<Record<string, unknown> | null>(null)
const activePlatform = ref('')

function outputOf(): Record<string, unknown> {
  const raw = props.artifact.output
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(typeof raw === 'string' ? raw : '{}')
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  }
  catch {
    return {}
  }
}

function captionOf(): string {
  const caption = outputOf().caption
  return typeof caption === 'string' ? caption : ''
}

function platformVariants(): Record<string, { caption?: string, hashtags?: string[] }> {
  const variants = outputOf().platformVariants
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return {}
  return variants as Record<string, { caption?: string, hashtags?: string[] }>
}

function platformTabs(): string[] {
  return Object.keys(platformVariants())
}

function readErrorMessage(err: unknown): string {
  const fetchError = err as { data?: { message?: string, statusMessage?: string }, message?: string }
  return fetchError.data?.message || fetchError.data?.statusMessage || fetchError.message || t('toast.actionFailed')
}

function artifactQuery(): string {
  return `businessId=${props.businessId}`
}

async function refresh() {
  emit('changed', props.artifact.id)
}

function handleStartEdit() {
  editText.value = captionOf()
  editing.value = true
}

function handleCancelEdit() {
  editing.value = false
}

async function handleSaveEdit() {
  busyAction.value = 'edit'
  try {
    await $fetch(`/api/v1/artifacts/${props.artifact.id}/edit?${artifactQuery()}`, {
      method: 'PUT',
      body: { output: { ...outputOf(), caption: editText.value } },
    })
    editing.value = false
    toast.add({ title: t('toast.editDone'), icon: 'i-heroicons-check-circle', color: 'success' })
    await refresh()
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.editFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    busyAction.value = null
  }
}

async function handleReviewDecision(decision: 'approved' | 'changes_requested') {
  if (decision === 'changes_requested' && !showFeedback.value) {
    showFeedback.value = true
    return
  }
  busyAction.value = decision
  try {
    await $fetch(`/api/v1/artifacts/${props.artifact.id}/review?${artifactQuery()}`, {
      method: 'POST',
      body: { decision, feedback: feedback.value, version: props.artifact.version },
    })
    showFeedback.value = false
    feedback.value = ''
    toast.add({ title: t(`toast.${decision}Done`), icon: 'i-heroicons-check-circle', color: 'success' })
    await refresh()
  }
  catch (err: unknown) {
    toast.add({ title: t(`toast.${decision}Failed`), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    busyAction.value = null
  }
}

function handleApprove() {
  void handleReviewDecision('approved')
}

function handleRequestChanges() {
  void handleReviewDecision('changes_requested')
}

async function handleMaterialize() {
  busyAction.value = 'draft'
  try {
    await $fetch(`/api/v1/artifacts/${props.artifact.id}/materialize?${artifactQuery()}`, { method: 'POST' })
    toast.add({ title: t('toast.draftDone'), icon: 'i-heroicons-check-circle', color: 'success' })
    await refresh()
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.draftFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    busyAction.value = null
  }
}

async function handleSchedule() {
  if (!scheduleAt.value) {
    toast.add({ title: t('schedule.needsDate'), icon: 'i-heroicons-x-circle', color: 'error' })
    return
  }
  busyAction.value = 'schedule'
  try {
    await $fetch(`/api/v1/artifacts/${props.artifact.id}/schedule?${artifactQuery()}`, {
      method: 'POST',
      body: { scheduledAt: scheduleAt.value },
    })
    toast.add({ title: t('toast.scheduleDone'), icon: 'i-heroicons-check-circle', color: 'success' })
    await refresh()
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.scheduleFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    busyAction.value = null
  }
}

async function handleVirality() {
  busyAction.value = 'virality'
  try {
    const res = await $fetch<{ result?: Record<string, unknown> }>(`/api/v1/artifacts/${props.artifact.id}/virality?${artifactQuery()}`, { method: 'POST' })
    virality.value = res.result ?? null
    toast.add({ title: t('toast.checkDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.checkFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    busyAction.value = null
  }
}

async function handleEngagement() {
  busyAction.value = 'engagement'
  try {
    const res = await $fetch<{ result?: Record<string, unknown> }>(`/api/v1/artifacts/${props.artifact.id}/engagement?${artifactQuery()}`, { method: 'POST' })
    engagement.value = res.result ?? null
    toast.add({ title: t('toast.checkDone'), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.checkFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    busyAction.value = null
  }
}

function handleOpenEditor() {
  if (props.artifact.kind === 'carousel' || props.artifact.kind === 'reel_storyboard') {
    router.push({ path: '/tools/carousel-creator', query: { artifact: props.artifact.id } })
    return
  }
  router.push(`/app/business/${props.businessId}/playbook`)
}

function handleSelectPlatform(platform: string) {
  activePlatform.value = platform
}

function resultRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function viralityData(): Record<string, unknown> {
  return resultRecord(virality.value)
}

function viralityScore(): number | null {
  const score = viralityData().score
  return typeof score === 'number' && Number.isFinite(score) ? score : null
}

function viralityTierLabel(): string {
  const tier = viralityData().tier
  return typeof tier === 'string' ? tier : ''
}

function viralityReason(): string {
  const reason = viralityData().reason
  return typeof reason === 'string' ? reason : ''
}

function viralityStrengths(): string[] {
  return stringList(viralityData().strengths)
}

function viralitySuggestions(): string[] {
  return stringList(viralityData().suggestions)
}

function viralityEngagementRate(): number | null {
  const rate = viralityData().engagement_rate
  return typeof rate === 'number' && Number.isFinite(rate) ? rate : null
}

function tierColor(tier: string): string {
  if (tier === 'breakout') return 'success'
  if (tier === 'viral') return 'primary'
  if (tier === 'steady') return 'warning'
  return 'neutral'
}

function ringArc(score: number): string {
  return ((Math.min(100, Math.max(0, score)) / 100) * 113).toFixed(1)
}

function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${rate.toFixed(1)}%`
}

function rateWidth(rate: number | null): string {
  return `${rate === null ? 0 : Math.min(100, Math.max(0, rate))}%`
}

interface EngagementRow {
  postId: string
  rate: number | null
}

interface ViralPlatform {
  platform: string
  score: number
  tier: string
  strengths: string[]
  suggestions: string[]
}

function engagementRows(): EngagementRow[] {
  const results = resultRecord(engagement.value).results
  if (!Array.isArray(results)) return []
  return results
    .map((row) => {
      const record = resultRecord(row)
      const postId = typeof record.post_id === 'string' ? record.post_id : ''
      const rate = typeof record.engagement_rate === 'number' ? record.engagement_rate : null
      return { postId, rate }
    })
    .filter(row => row.postId !== '')
}

const expandedViralPlatform = ref<string | null>(null)
const applyPlatforms = ref<string[]>([])

function viralPlatforms(): ViralPlatform[] {
  const list = viralityData().platforms
  if (!Array.isArray(list)) return []
  return list
    .map((entry) => {
      const record = resultRecord(entry)
      const platform = typeof record.platform === 'string' ? record.platform : ''
      const score = typeof record.score === 'number' ? record.score : 0
      const tier = typeof record.tier === 'string' ? record.tier : viralityTierFallback(score)
      return {
        platform,
        score,
        tier,
        strengths: stringList(record.strengths),
        suggestions: stringList(record.suggestions),
      }
    })
    .filter(entry => entry.platform !== '')
}

function viralityTierFallback(score: number): string {
  if (score >= 80) return 'breakout'
  if (score >= 60) return 'viral'
  if (score >= 40) return 'steady'
  return 'sleeper'
}

function viralPlatformNames(value: unknown): string[] {
  const list = resultRecord(value).platforms
  if (!Array.isArray(list)) return []
  const names: string[] = []
  for (const entry of list) {
    const platform = resultRecord(entry).platform
    if (typeof platform === 'string' && platform) names.push(platform)
  }
  return names
}

watch(virality, (value) => {
  const names = viralPlatformNames(value)
  applyPlatforms.value = names
  expandedViralPlatform.value = names[0] ?? null
})

function isApplySelected(platform: string): boolean {
  return applyPlatforms.value.includes(platform)
}

function handleToggleApplyPlatform(platform: string) {
  if (applyPlatforms.value.includes(platform)) {
    applyPlatforms.value = applyPlatforms.value.filter(entry => entry !== platform)
  }
  else {
    applyPlatforms.value = [...applyPlatforms.value, platform]
  }
}

function handleToggleExpandPlatform(platform: string) {
  expandedViralPlatform.value = expandedViralPlatform.value === platform ? null : platform
}

const canApplyVirality = computed(() => !!props.itemId && (viralPlatforms().length > 0
  ? applyPlatforms.value.length > 0
  : viralitySuggestions().length > 0))

const applyLabel = computed(() => {
  if (viralPlatforms().length === 0) return t('checks.apply')
  return t('checks.applySelected', { count: applyPlatforms.value.length })
})

function applyFeedbackText(): string {
  const entries = viralPlatforms().filter(entry => applyPlatforms.value.includes(entry.platform))
  const suggestions = entries.length > 0
    ? entries.flatMap(entry => entry.suggestions.map(suggestion => `${entry.platform}: ${suggestion}`))
    : viralitySuggestions()
  return t('checks.applyFeedback', { suggestions: suggestions.join('; ') })
}

async function handleApplySuggestions() {
  if (!props.itemId) return
  busyAction.value = 'apply'
  try {
    await $fetch(`/api/v1/content-items/${props.itemId}/actions`, {
      method: 'POST',
      body: {
        businessId: props.businessId,
        action: 'improve',
        feedback: applyFeedbackText(),
        platforms: viralPlatforms().length > 0 ? applyPlatforms.value : undefined,
      },
    })
    toast.add({ title: t('toast.applyDone'), icon: 'i-heroicons-check-circle', color: 'success' })
    await refresh()
    await handleVirality()
  }
  catch (err: unknown) {
    toast.add({ title: t('toast.applyFailed'), description: readErrorMessage(err), icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    busyAction.value = null
  }
}

function slideList(): Array<{ altText?: string, templateKey?: string }> {
  const slides = outputOf().slides
  if (!Array.isArray(slides)) return []
  return slides.filter((slide): slide is { altText?: string, templateKey?: string } => !!slide && typeof slide === 'object')
}

function reelScenes(): Array<{ narration?: string, voiceover?: string, sceneText?: string, durationSeconds?: number }> {
  const scenes = outputOf().scenes
  if (!Array.isArray(scenes)) return []
  return scenes.filter((scene): scene is { narration?: string, voiceover?: string, sceneText?: string, durationSeconds?: number } => !!scene && typeof scene === 'object')
}

function instagramBoundsOk(): boolean | null {
  if (props.artifact.kind !== 'carousel') return null
  const count = slideList().length
  return count >= 2 && count <= 10
}

function statusColor(status: string): string {
  if (status === 'approved' || status === 'published') return 'success'
  if (status === 'review_required' || status === 'changes_requested') return 'warning'
  if (status === 'failed' || status === 'rejected') return 'error'
  return 'neutral'
}
</script>

<template>
  <UCard v-motion-fade-visible :duration="250" :data-testid="`artifact-${artifact.id}`">
    <template #header>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-semibold">{{ t(`kinds.${artifact.kind}`) }}</span>
        <UBadge :color="statusColor(artifact.status)" variant="subtle" size="xs" class="capitalize">
          {{ t(`statuses.${artifact.status}`) }}
        </UBadge>
        <UBadge color="neutral" variant="outline" size="xs">v{{ artifact.version }}</UBadge>
      </div>
    </template>

    <div class="space-y-3">
      <div v-if="artifact.kind === 'social_post'">
        <div v-if="platformTabs().length > 1" class="mb-2 flex flex-wrap gap-1">
          <UButton
            v-for="platform in platformTabs()"
            :key="platform"
            size="xs"
            :variant="activePlatform === platform ? 'solid' : 'outline'"
            color="neutral"
            @click="handleSelectPlatform(platform)"
          >
            {{ platform }}
          </UButton>
        </div>
        <p v-if="!editing" class="whitespace-pre-wrap text-sm">{{ captionOf() }}</p>
        <UTextarea v-else v-model="editText" :rows="5" class="w-full text-sm" />
      </div>

      <div v-else-if="artifact.kind === 'carousel'" class="space-y-2">
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <UBadge color="neutral" variant="outline" size="xs">
            {{ t('carousel.slides', { count: slideList().length }) }}
          </UBadge>
          <UBadge v-if="instagramBoundsOk() === true" color="success" variant="subtle" size="xs">
            {{ t('carousel.boundsOk') }}
          </UBadge>
          <UBadge v-else color="warning" variant="subtle" size="xs">
            {{ t('carousel.boundsWarn') }}
          </UBadge>
        </div>
        <ol class="grid gap-2 sm:grid-cols-2">
          <li v-for="(slide, index) in slideList()" :key="index" class="rounded-xl bg-elevated p-3 text-xs">
            <p class="font-semibold">{{ index + 1 }}. {{ slide.templateKey || t('carousel.untitled') }}</p>
            <p v-if="slide.altText" class="mt-1 text-muted">{{ slide.altText }}</p>
          </li>
        </ol>
      </div>

      <div v-else-if="artifact.kind === 'reel_storyboard'" class="space-y-2">
        <ol class="space-y-2">
          <li v-for="(scene, index) in reelScenes()" :key="index" class="rounded-xl bg-elevated p-3 text-xs">
            <p class="font-semibold">{{ t('reel.scene', { index: index + 1, seconds: scene.durationSeconds ?? 3 }) }}</p>
            <p class="mt-1 text-muted">{{ scene.sceneText || scene.voiceover || scene.narration }}</p>
          </li>
        </ol>
      </div>

      <details v-else class="rounded-xl bg-elevated p-3">
        <summary class="cursor-pointer text-sm font-medium">{{ t('structured.title') }}</summary>
        <pre class="mt-2 max-h-64 overflow-auto font-mono text-xs">{{ JSON.stringify(outputOf(), null, 2) }}</pre>
      </details>

      <div v-if="virality" v-motion-fade :duration="200" class="space-y-2 rounded-xl bg-elevated p-3">
        <div class="flex items-center gap-3">
          <div v-if="viralityScore() !== null" class="relative size-11 shrink-0">
            <svg viewBox="0 0 44 44" class="size-11 -rotate-90">
              <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" stroke-width="5" class="text-muted" />
              <circle
                cx="22" cy="22" r="18" fill="none" stroke="currentColor" stroke-width="5"
                stroke-linecap="round" class="text-primary"
                :stroke-dasharray="`${ringArc(viralityScore() ?? 0)} 113`"
              />
            </svg>
            <span class="absolute inset-0 flex items-center justify-center text-xs font-bold">{{ viralityScore() }}</span>
          </div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="text-xs font-semibold">{{ t('checks.virality') }}</p>
              <UBadge v-if="viralityTierLabel()" :color="tierColor(viralityTierLabel())" variant="subtle" size="xs" class="capitalize">
                {{ viralityTierLabel() }}
              </UBadge>
            </div>
            <p v-if="viralityReason()" class="mt-0.5 text-xs text-muted">{{ viralityReason() }}</p>
            <p v-if="viralityEngagementRate() !== null" class="mt-0.5 text-xs text-muted">
              {{ t('checks.engagementRate') }}: {{ formatRate(viralityEngagementRate()) }}
            </p>
          </div>
        </div>
        <div v-if="viralPlatforms().length > 0" class="space-y-1.5">
          <p class="text-xs font-semibold text-muted">{{ t('checks.perPlatform') }}</p>
          <div v-for="entry in viralPlatforms()" :key="entry.platform" class="rounded-lg bg-default p-2">
            <div class="flex items-center gap-2 text-xs">
              <UCheckbox
                :model-value="isApplySelected(entry.platform)"
                :aria-label="t('checks.applyToPlatform', { platform: entry.platform })"
                @update:model-value="handleToggleApplyPlatform(entry.platform)"
              />
              <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left" @click="handleToggleExpandPlatform(entry.platform)">
                <span class="truncate font-medium">{{ entry.platform }}</span>
                <span class="font-bold">{{ entry.score }}</span>
                <UBadge :color="tierColor(entry.tier)" variant="subtle" size="xs" class="capitalize">
                  {{ entry.tier }}
                </UBadge>
                <UIcon :name="expandedViralPlatform === entry.platform ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="ms-auto size-3.5 shrink-0 text-muted" />
              </button>
            </div>
            <div v-if="expandedViralPlatform === entry.platform" class="mt-1.5 space-y-1">
              <ul v-if="entry.strengths.length > 0" class="space-y-1">
                <li v-for="(strength, strengthIndex) in entry.strengths" :key="`ps-${strengthIndex}`" class="flex items-start gap-1.5 text-xs">
                  <UIcon name="i-heroicons-check-circle" class="mt-0.5 size-3.5 shrink-0 text-success" />
                  <span>{{ strength }}</span>
                </li>
              </ul>
              <ul v-if="entry.suggestions.length > 0" class="space-y-1">
                <li v-for="(suggestion, suggestionIndex) in entry.suggestions" :key="`pg-${suggestionIndex}`" class="flex items-start gap-1.5 text-xs">
                  <UIcon name="i-heroicons-light-bulb" class="mt-0.5 size-3.5 shrink-0 text-warning" />
                  <span>{{ suggestion }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <ul v-else-if="viralityStrengths().length > 0" class="space-y-1">
          <li v-for="(strength, index) in viralityStrengths()" :key="`s-${index}`" class="flex items-start gap-1.5 text-xs">
            <UIcon name="i-heroicons-check-circle" class="mt-0.5 size-3.5 shrink-0 text-success" />
            <span>{{ strength }}</span>
          </li>
        </ul>
        <div v-else-if="viralitySuggestions().length > 0" class="space-y-1">
          <p class="text-xs font-semibold text-muted">{{ t('checks.suggestions') }}</p>
          <ul class="space-y-1">
            <li v-for="(suggestion, index) in viralitySuggestions()" :key="`g-${index}`" class="flex items-start gap-1.5 text-xs">
              <UIcon name="i-heroicons-light-bulb" class="mt-0.5 size-3.5 shrink-0 text-warning" />
              <span>{{ suggestion }}</span>
            </li>
          </ul>
        </div>
        <UButton
          v-if="canApplyVirality"
          size="xs"
          variant="outline"
          color="primary"
          icon="i-heroicons-sparkles"
          :loading="busyAction === 'apply'"
          :disabled="viralPlatforms().length > 0 && applyPlatforms.length === 0"
          @click="handleApplySuggestions"
        >
          {{ applyLabel }}
        </UButton>
      </div>
      <div v-if="engagement" v-motion-fade :duration="200" class="space-y-2 rounded-xl bg-elevated p-3">
        <p class="text-xs font-semibold">{{ t('checks.engagement') }}</p>
        <ul v-if="engagementRows().length > 0" class="space-y-1.5">
          <li v-for="row in engagementRows()" :key="row.postId" class="text-xs">
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono">{{ row.postId.slice(0, 8) }}</span>
              <span class="text-muted">{{ formatRate(row.rate) }}</span>
            </div>
            <div class="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div class="h-full rounded-full bg-primary" :style="{ width: rateWidth(row.rate) }" />
            </div>
          </li>
        </ul>
        <p v-else class="text-xs text-muted">{{ t('checks.noData') }}</p>
      </div>

      <div v-if="showFeedback" v-motion-fade :duration="200" class="space-y-2">
        <UTextarea v-model="feedback" :rows="2" :placeholder="t('feedback.placeholder')" class="w-full text-sm" />
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <template v-if="!editing">
          <UButton size="xs" variant="outline" color="neutral" @click="handleStartEdit">
            {{ t('actions.edit') }}
          </UButton>
          <UButton size="xs" variant="outline" color="neutral" :loading="busyAction === 'virality'" @click="handleVirality">
            {{ t('actions.virality') }}
          </UButton>
          <UButton size="xs" variant="outline" color="neutral" :loading="busyAction === 'engagement'" @click="handleEngagement">
            {{ t('actions.engagement') }}
          </UButton>
          <UButton size="xs" variant="solid" color="primary" :loading="busyAction === 'approved'" @click="handleApprove">
            {{ t('actions.approve') }}
          </UButton>
          <UButton size="xs" variant="outline" color="neutral" :loading="busyAction === 'changes_requested'" @click="handleRequestChanges">
            {{ t('actions.changes') }}
          </UButton>
          <UButton size="xs" variant="outline" color="neutral" :loading="busyAction === 'draft'" @click="handleMaterialize">
            {{ t('actions.draft') }}
          </UButton>
          <UButton size="xs" variant="outline" color="neutral" @click="handleOpenEditor">
            {{ t('actions.editor') }}
          </UButton>
        </template>
        <template v-else>
          <UButton size="xs" variant="solid" color="primary" :loading="busyAction === 'edit'" @click="handleSaveEdit">
            {{ t('actions.save') }}
          </UButton>
          <UButton size="xs" variant="ghost" color="neutral" @click="handleCancelEdit">
            {{ t('actions.cancel') }}
          </UButton>
        </template>
      </div>

      <div class="flex flex-wrap items-center gap-2 border-t border-muted pt-3">
        <UInput v-model="scheduleAt" type="datetime-local" size="xs" />
        <UButton size="xs" variant="outline" color="neutral" :loading="busyAction === 'schedule'" @click="handleSchedule">
          {{ t('actions.schedule') }}
        </UButton>
      </div>
    </div>
  </UCard>
</template>

<style scoped></style>

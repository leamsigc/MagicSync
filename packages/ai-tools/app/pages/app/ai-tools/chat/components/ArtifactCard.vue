<i18n src="../artifact.json"></i18n>
<script setup lang="ts">
import type { ChatArtifact } from '../composables/useChatArtifacts'

const props = defineProps<{
  artifact: ChatArtifact
  businessId: string
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

      <div v-if="virality" v-motion-fade :duration="200" class="rounded-xl bg-elevated p-3 text-xs">
        <p class="font-semibold">{{ t('checks.virality') }}</p>
        <pre class="mt-1 max-h-40 overflow-auto font-mono">{{ JSON.stringify(virality, null, 2) }}</pre>
      </div>
      <div v-if="engagement" v-motion-fade :duration="200" class="rounded-xl bg-elevated p-3 text-xs">
        <p class="font-semibold">{{ t('checks.engagement') }}</p>
        <pre class="mt-1 max-h-40 overflow-auto font-mono">{{ JSON.stringify(engagement, null, 2) }}</pre>
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

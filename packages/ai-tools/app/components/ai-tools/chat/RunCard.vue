<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
import {
  groupSections,
  railSteps,
  type MessageRunLike,
  type ToolCallLike,
} from '../../../composables/ai-tools/chat/runSections'
import ResearchSection from './tool-results/sections/ResearchSection.vue'
import IdeasSection from './tool-results/sections/IdeasSection.vue'
import CarouselSection from './tool-results/sections/CarouselSection.vue'
import DraftSection from './tool-results/sections/DraftSection.vue'
import BoardSection from './tool-results/sections/BoardSection.vue'
import DeliverySection from './tool-results/sections/DeliverySection.vue'
import type { MessageRunState } from '../../../composables/ai-tools/chat/useAgentChat'

const props = defineProps<{
  calls: ToolCallLike[]
  run?: MessageRunState
  businessId?: string | null
  isStreaming?: boolean
  cancelLoading?: boolean
}>()

const emit = defineEmits<{
  (event: 'revise', intent: { artifactId: string, slideId: string, version: number }): void
  (event: 'cancel'): void
}>()

const { t } = useI18n()
const toast = useToast()
const open = ref(false)
const approvalLoading = ref(false)

const sections = computed(() => {
  const grouped = groupSections(props.calls)
  if (!grouped.some(section => section.kind === 'carousel')) return grouped
  return grouped.filter(section => section.kind === 'carousel')
})
const hasCarousel = computed(() => sections.value.some(section => section.kind === 'carousel'))
const visibleCalls = computed(() => sections.value.flatMap(section => section.calls))
const rail = computed(() => hasCarousel.value ? [] : railSteps(props.run as MessageRunLike | undefined, visibleCalls.value))

const runningCount = computed(() => visibleCalls.value.filter(call => !call.result && !call.error).length)
const failedCount = computed(() => visibleCalls.value.filter(call => Boolean(call.error)).length)
const completedCount = computed(() => visibleCalls.value.filter(call => Boolean(call.result) && !call.error).length)

const status = computed<'running' | 'done' | 'failed' | 'cancelled'>(() => {
  if (props.run?.cancelled) return 'cancelled'
  if (failedCount.value > 0 || rail.value.some(step => step.status === 'failed')) return 'failed'
  if (props.run && !props.run.completed && !props.isStreaming && rail.value.every(step => step.status === 'done')) return 'done'
  if (runningCount.value > 0 || props.isStreaming) return 'running'
  return 'done'
})

const progressPercent = computed(() => {
  if (status.value === 'cancelled' || status.value === 'failed') return completedCount.value > 0 && props.calls.length > 0
    ? Math.round((completedCount.value / props.calls.length) * 100)
    : 0
  if (status.value === 'done') return 100
  if (props.calls.length === 0) return 8
  return Math.max(8, Math.round((completedCount.value / props.calls.length) * 100))
})

const statusLabel = computed(() => {
  if (status.value === 'cancelled') return t('run.cancelled')
  if (status.value === 'failed') return t('run.failed')
  if (status.value === 'running') return t('run.running')
  return t('run.completed')
})

const statusColor = computed<'warning' | 'error' | 'success' | 'neutral'>(() => {
  if (status.value === 'cancelled') return 'neutral'
  if (status.value === 'failed') return 'error'
  if (status.value === 'running') return 'warning'
  return 'success'
})

const runTitle = computed(() => {
  if (props.run?.title) return props.run.title
  if (status.value === 'cancelled') return t('run.cancelled')
  if (hasCarousel.value) return t('workflow.title')
  if (status.value === 'failed') return t('run.attentionTitle')
  if (status.value === 'running') return t('run.workingTitle')
  return t('run.completedTitle')
})

const runSubtitle = computed(() => {
  if (hasCarousel.value) return t('workflow.subtitle')
  if (props.run && props.run.steps.length > 0) return props.run.steps.map(step => step.label).join(' → ')
  if (status.value === 'failed') return t('run.summaryFailed', { count: failedCount.value })
  if (status.value === 'running') return t('run.summaryRunning', { count: runningCount.value })
  return t('run.summaryCompleted', { count: completedCount.value })
})

const runTag = computed(() => hasCarousel.value ? t('workflow.skillTag') : undefined)

function toggleOpen(): void {
  open.value = !open.value
}

function handleRevise(intent: { artifactId: string, slideId: string, version: number }): void {
  emit('revise', intent)
}

function handleCancel(): void {
  if (props.cancelLoading) return
  emit('cancel')
}

function stepMarkClass(mark: string): string {
  if (mark === 'active') return 'border-primary font-medium text-highlighted'
  if (mark === 'failed') return 'border-transparent font-medium text-error'
  return 'border-transparent text-muted'
}

/**
 * Complete the approval transition through the shared goal endpoint. The
 * server remains authoritative; the card only clears the footer after success.
 */
async function handleApprovalAction(actionId: string, actionLabel: string): Promise<void> {
  if (!props.run || approvalLoading.value) return
  approvalLoading.value = true
  try {
    await $fetch(`/api/v1/agent/goals/${props.run.id}/approve`, {
      method: 'POST',
      body: { approved: actionId === 'approve' },
    })
    props.run.approval = null
    toast.add({ title: t('runCard.approvalNoted', { action: actionLabel || actionId }), icon: 'i-heroicons-check-circle', color: 'success' })
  }
  catch (error: unknown) {
    toast.add({ title: t('error'), description: error instanceof Error ? error.message : undefined, icon: 'i-heroicons-x-circle', color: 'error' })
  }
  finally {
    approvalLoading.value = false
  }
}
</script>

<template>
  <section v-motion-fade :duration="220" data-testid="run-card" class="w-full max-w-[980px] overflow-hidden rounded-2xl border border-primary/20 bg-elevated shadow-lg shadow-black/5">
    <button
      type="button"
      class="flex w-full items-center gap-3 border-b border-default bg-elevated/80 px-4 py-3 text-left transition-colors hover:bg-default/60"
      :aria-expanded="open"
      @click="toggleOpen"
    >
      <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <UIcon :name="status === 'running' ? 'i-heroicons-arrow-path' : status === 'failed' ? 'i-heroicons-exclamation-triangle' : status === 'cancelled' ? 'i-heroicons-stop-circle' : 'i-heroicons-check'" class="h-4 w-4" :class="status === 'running' ? 'animate-spin text-warning' : status === 'failed' ? 'text-error' : status === 'cancelled' ? 'text-muted' : 'text-success'" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-sm font-semibold text-highlighted">{{ runTitle }}</span>
        <span class="block truncate text-xs text-muted">{{ runSubtitle }}</span>
      </span>
      <span class="flex shrink-0 items-center gap-2">
        <UBadge v-if="runTag" color="neutral" variant="subtle" size="xs">{{ runTag }}</UBadge>
        <UBadge :color="statusColor" variant="subtle" size="xs">{{ statusLabel }}</UBadge>
        <UIcon name="i-heroicons-chevron-down" class="h-4 w-4 text-muted transition-transform" :class="open ? 'rotate-180' : ''" />
      </span>
    </button>

    <div class="h-1 w-full bg-default" aria-hidden="true">
      <div class="h-full bg-primary transition-[width] duration-300" :style="{ width: `${progressPercent}%` }" />
    </div>

    <nav v-if="rail.length > 0" class="flex gap-1 overflow-x-auto border-b border-default px-4" :aria-label="runTitle">
      <div
        v-for="(step, index) in rail"
        :key="step.id"
        data-testid="run-step"
        :data-status="step.status"
        class="shrink-0 border-b-2 px-3 py-2.5 text-xs"
        :class="stepMarkClass(step.status)"
      >
        <span v-if="step.status === 'done'" class="mr-1">✓</span>
        <span v-else-if="step.status === 'failed'" class="mr-1">!</span>
        <span v-else class="mr-1">{{ index + 1 }}</span>{{ step.label }}
      </div>
    </nav>

    <div v-if="open || hasCarousel" v-motion-fade :duration="180" class="space-y-3 p-3">
      <template v-for="section in sections" :key="section.kind">
        <ResearchSection v-if="section.kind === 'research'" :calls="section.calls" />
        <IdeasSection v-else-if="section.kind === 'ideas'" :calls="section.calls" />
        <CarouselSection
          v-else-if="section.kind === 'carousel'"
          :calls="section.calls"
          :business-id="businessId"
          :is-streaming="isStreaming"
          @revise="handleRevise"
        />
        <DraftSection v-else-if="section.kind === 'draft'" :calls="section.calls" :business-id="businessId" />
        <BoardSection v-else-if="section.kind === 'board'" :calls="section.calls" />
        <DeliverySection v-else :calls="section.calls" />
      </template>
    </div>

    <div v-if="status === 'running'" class="flex items-center justify-between gap-2 border-t border-default px-4 py-3">
      <p class="text-xs text-muted">{{ t('run.summaryRunning', { count: runningCount }) }}</p>
      <UButton color="neutral" variant="soft" size="sm" :loading="cancelLoading" @click="handleCancel">
        {{ t('stop') }}
      </UButton>
    </div>

    <div v-if="run?.approval" data-testid="run-approval" class="flex flex-wrap items-center justify-between gap-2 border-t border-default px-4 py-3">
      <p class="text-xs text-muted">{{ t('runCard.approvalTitle') }}</p>
      <div class="flex items-center gap-2">
        <UButton
          v-for="action in run.approval.actions"
          :key="action.id"
          color="primary"
          variant="solid"
          size="sm"
          :loading="approvalLoading"
          @click="handleApprovalAction(action.id, action.label)"
        >
          {{ action.label }}
        </UButton>
      </div>
    </div>
  </section>
</template>

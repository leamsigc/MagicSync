<i18n src="../../pipelines.json"></i18n>

<script lang="ts" setup>
import { computed } from 'vue'
import type { PipelineRun } from '#layers/BaseDB/db/schema'
import type { PipelineRunStatus } from '../composables/UsePipelineManager'
import dayjs from 'dayjs'

const { t } = useI18n()
const router = useRouter()

const props = defineProps<{
  runs: PipelineRun[]
  pipelineName?: string
}>()

const emit = defineEmits<{
  delete: [id: string]
}>()

const runStatuses: PipelineRunStatus[] = [
  'queued',
  'running',
  'waiting_input',
  'waiting_review',
  'changes_requested',
  'completed',
  'failed',
  'cancelled'
]

const statusDot: Record<PipelineRunStatus, string> = {
  queued: 'bg-neutral',
  running: 'bg-info',
  waiting_input: 'bg-warning',
  waiting_review: 'bg-secondary',
  changes_requested: 'bg-warning',
  completed: 'bg-success',
  failed: 'bg-error',
  cancelled: 'bg-neutral'
}

const cardAccent: Record<PipelineRunStatus, string> = {
  queued: 'border-t-neutral',
  running: 'border-t-info',
  waiting_input: 'border-t-warning',
  waiting_review: 'border-t-secondary',
  changes_requested: 'border-t-warning',
  completed: 'border-t-success',
  failed: 'border-t-error',
  cancelled: 'border-t-neutral'
}

const groupedRuns = computed(() => {
  const groups: Record<PipelineRunStatus, PipelineRun[]> = {
    queued: [],
    running: [],
    waiting_input: [],
    waiting_review: [],
    changes_requested: [],
    completed: [],
    failed: [],
    cancelled: []
  }
  props.runs.forEach((run) => {
    const status = run.status as PipelineRunStatus
    if (groups[status]) {
      groups[status].push(run)
    }
  })
  return groups
})

function statusLabel(status: PipelineRunStatus) {
  return t(`statuses.${status}`)
}

function stepLabel(run: PipelineRun) {
  return t('board.step', { current: run.currentStep + 1, total: 5 })
}

function shortId(id: string) {
  return id.slice(0, 8)
}

function formatDate(value: unknown) {
  return dayjs(value as string).format('MMM DD, HH:mm')
}

function openRun(id: string) {
  router.push(`/app/pipelines/runs/${id}`)
}

function handleAskDelete(id: string) {
  emit('delete', id)
}
</script>

<template>
  <div class="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4" data-testid="runs-board">
    <section
      v-for="status in runStatuses"
      :key="status"
      v-motion-fade-visible
      :duration="200"
      class="w-72 shrink-0 snap-start rounded-2xl border border-white/10 bg-[#111111]"
      :data-testid="`runs-column-${status}`"
    >
      <header class="flex items-center gap-2 border-b border-white/5 px-3 py-2">
        <span class="size-2 rounded-full" :class="statusDot[status]" />
        <h3 class="flex-1 text-sm font-semibold text-white/70">{{ statusLabel(status) }}</h3>
        <UBadge color="neutral" variant="subtle" size="xs" class="text-white/40">{{ groupedRuns[status].length }}</UBadge>
      </header>
      <div class="flex max-h-[65vh] flex-col gap-2 overflow-y-auto p-2">
        <p v-if="groupedRuns[status].length === 0" class="px-1 py-6 text-center text-xs text-white/20">
          {{ t('board.empty') }}
        </p>
        <article
          v-for="run in groupedRuns[status]"
          :key="run.id"
          v-motion-fade-visible
          :duration="200"
          class="cursor-pointer rounded-xl border border-white/10 border-t-2 bg-white/5 p-3 shadow-xs transition hover:border-primary/40"
          :class="cardAccent[run.status as PipelineRunStatus] ?? 'border-t-neutral'"
          role="link"
          tabindex="0"
          :aria-label="t('board.open')"
          :data-testid="`run-card-${run.id}`"
          @click="openRun(run.id)"
          @keydown.enter="openRun(run.id)"
        >
          <div class="flex items-start gap-2">
            <div class="flex size-5 shrink-0 items-center justify-center rounded-lg bg-white/5">
              <UIcon name="lucide:workflow" class="size-3 text-white/30" />
            </div>
            <h4 class="min-w-0 flex-1 truncate font-mono text-sm font-medium text-white/60">{{ shortId(run.id) }}</h4>
            <UButton
              size="xs"
              color="error"
              variant="ghost"
              icon="i-heroicons-trash"
              :title="t('runDelete.button')"
              :aria-label="t('runDelete.button')"
              @click.stop="handleAskDelete(run.id)"
              class="text-white/20"
            />
          </div>
          <p v-if="pipelineName" class="mt-1 line-clamp-2 text-xs text-white/30">{{ pipelineName }}</p>
          <div class="mt-2 flex flex-wrap items-center gap-1">
            <UBadge color="neutral" variant="outline" size="xs" class="text-white/30">
              <UIcon name="lucide:list-ordered" class="size-3" />
              {{ stepLabel(run) }}
            </UBadge>
            <UBadge color="neutral" variant="outline" size="xs" class="text-white/30">
              <UIcon name="lucide:clock" class="size-3" />
              {{ formatDate(run.updatedAt) }}
            </UBadge>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped></style>

<i18n src="../../pipelines.json"></i18n>

<script lang="ts" setup>
import { computed } from 'vue'
import type { PipelineRun } from '#layers/BaseDB/db/schema'
import type { PipelineRunStatus } from '../composables/UsePipelineManager'
import dayjs from 'dayjs'

const { t } = useI18n()

const props = defineProps<{
  runs: PipelineRun[]
  pipelineName?: string
}>()

const runStatuses: PipelineRunStatus[] = ['running', 'waiting_input', 'completed', 'failed']

const groupedRuns = computed(() => {
  const groups: Record<PipelineRunStatus, PipelineRun[]> = {
    running: [],
    waiting_input: [],
    completed: [],
    failed: []
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

const router = useRouter()
function openRun(id: string) {
  router.push(`/app/pipelines/runs/${id}`)
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mt-4">
    <div v-for="status in runStatuses" :key="status" class="rounded overflow-hidden">
      <div class="px-4 py-3.5">
        <div class="flex items-center gap-2">
          <span
            class="w-2 h-2 rounded-full"
            :class="{
              'bg-info': status === 'running',
              'bg-warning': status === 'waiting_input',
              'bg-success': status === 'completed',
              'bg-error': status === 'failed'
            }"
          />
          <h3 class="font-semibold text-sm text-highlighted">{{ statusLabel(status) }}</h3>
          <UBadge variant="soft" size="xs" color="neutral">{{ groupedRuns[status].length }}</UBadge>
        </div>
      </div>
      <div class="p-3 space-y-3 max-h-[70vh] overflow-y-auto">
        <div
          v-if="groupedRuns[status].length === 0"
          v-motion-fade-visible
          :duration="200"
          class="text-xs text-muted px-2 py-6 text-center"
        >
          {{ t('board.empty') }}
        </div>
        <template v-for="run in groupedRuns[status]" :key="run.id">
          <div
            v-motion-fade-visible
            :duration="200"
            class="bg-elevated rounded-xl hover:shadow-sm hover:-translate-y-0.5 transition-all duration-180 overflow-hidden cursor-pointer"
            role="link"
            tabindex="0"
            :aria-label="t('board.open')"
            @click="openRun(run.id)"
            @keydown.enter="openRun(run.id)"
          >
            <div class="p-3.5 space-y-3">
              <div class="flex items-center gap-2">
                <div class="size-5 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center shrink-0">
                  <UIcon name="lucide:workflow" class="size-3 text-muted" />
                </div>
                <h3 class="text-sm font-medium text-highlighted flex-1 font-mono">{{ shortId(run.id) }}</h3>
              </div>
              <p v-if="pipelineName" class="text-sm text-toned line-clamp-2 leading-relaxed">{{ pipelineName }}</p>
              <div class="flex items-center justify-between flex-wrap gap-2 pt-2">
                <div class="flex items-center gap-2 text-xs text-muted flex-wrap">
                  <UBadge color="neutral" variant="soft" size="xs">
                    <UIcon name="lucide:list-ordered" class="size-3" />
                    {{ stepLabel(run) }}
                  </UBadge>
                  <UBadge color="neutral" variant="soft" size="xs">
                    <UIcon name="lucide:clock" class="size-3" />
                    {{ formatDate(run.updatedAt) }}
                  </UBadge>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped></style>

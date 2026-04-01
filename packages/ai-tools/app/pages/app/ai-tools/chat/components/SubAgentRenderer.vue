<script setup lang="ts">
import type { SubAgentState } from '../composables/useSubAgent'

const props = defineProps<{
  agent: SubAgentState
}>()

const emit = defineEmits<{
  toggle: [agentId: string]
}>()

const statusIcon = computed(() => {
  switch (props.agent.status) {
    case 'created': return 'i-heroicons-clock'
    case 'running': return 'i-heroicons-arrow-path'
    case 'completed': return 'i-heroicons-check-circle'
    case 'failed': return 'i-heroicons-x-circle'
    default: return 'i-heroicons-question-mark-circle'
  }
})

const statusColor = computed(() => {
  switch (props.agent.status) {
    case 'created': return 'text-neutral-400'
    case 'running': return 'text-blue-500 animate-spin'
    case 'completed': return 'text-green-500'
    case 'failed': return 'text-red-500'
    default: return 'text-neutral-400'
  }
})

const taskTypeBadge = computed(() => {
  switch (props.agent.taskType) {
    case 'research': return { label: 'Research', color: 'info' as const }
    case 'analysis': return { label: 'Analysis', color: 'warning' as const }
    case 'multi-step': return { label: 'Multi-Step', color: 'primary' as const }
    case 'complex': return { label: 'Complex', color: 'neutral' as const }
    default: return null
  }
})
</script>

<template>
  <div class="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
    <!-- Header -->
    <button
      class="w-full flex items-center gap-3 px-4 py-3 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      @click="emit('toggle', agent.id)">
      <UIcon :name="statusIcon" :class="['w-4 h-4', statusColor]" />
      <div class="flex-1 text-left">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium truncate">{{ agent.task }}</span>
          <UBadge v-if="taskTypeBadge" :label="taskTypeBadge.label" :color="taskTypeBadge.color" size="xs" />
        </div>
        <div class="flex items-center gap-2 mt-0.5">
          <span class="text-xs text-neutral-500">
            Step {{ agent.stepCount }}/{{ agent.maxSteps }}
          </span>
          <span class="text-xs text-neutral-400">|</span>
          <span class="text-xs text-neutral-500 capitalize">{{ agent.status }}</span>
        </div>
      </div>
      <UIcon name="i-heroicons-chevron-down"
        :class="['w-4 h-4 text-neutral-400 transition-transform', { 'rotate-180': agent.isExpanded }]" />
    </button>

    <!-- Expanded Content -->
    <div v-if="agent.isExpanded" class="border-t border-neutral-200 dark:border-neutral-700">
      <!-- Steps -->
      <div v-if="agent.steps.length" class="divide-y divide-neutral-100 dark:divide-neutral-800">
        <div v-for="(step, idx) in agent.steps" :key="idx" class="px-4 py-3">
          <div class="flex items-start gap-2">
            <span class="text-xs text-neutral-400 font-mono mt-0.5 shrink-0">
              {{ idx + 1 }}.
            </span>
            <div class="flex-1 min-w-0">
              <!-- Tool Call -->
              <div v-if="step.toolCall" class="space-y-2">
                <div class="flex items-center gap-2">
                  <UBadge :label="step.toolCall.tool" color="info" size="xs" />
                  <span class="text-xs text-neutral-500">Tool Call</span>
                </div>
                <div class="bg-neutral-100 dark:bg-neutral-800 rounded p-2 text-xs font-mono overflow-x-auto">
                  <pre class="whitespace-pre-wrap">{{ JSON.stringify(step.toolCall.input, null, 2) }}</pre>
                </div>
                <div v-if="step.toolCall.result" class="mt-2">
                  <span class="text-xs text-neutral-500 block mb-1">Result:</span>
                  <div
                    class="bg-green-50 dark:bg-green-900/20 rounded p-2 text-xs overflow-x-auto max-h-32 overflow-y-auto">
                    <p class="whitespace-pre-wrap">{{ step.toolCall.result }}</p>
                  </div>
                </div>
              </div>
              <!-- Regular Step -->
              <p v-else class="text-sm whitespace-pre-wrap">{{ step.content }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- No steps yet -->
      <div v-else class="px-4 py-6 text-center">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin text-neutral-400 mx-auto mb-2" />
        <p class="text-xs text-neutral-500">Waiting for first step...</p>
      </div>

      <!-- Result -->
      <div v-if="agent.result && agent.status === 'completed'"
        class="px-4 py-3 bg-green-50 dark:bg-green-900/20 border-t border-green-100 dark:border-green-900/40">
        <div class="flex items-start gap-2">
          <UIcon name="i-heroicons-check-circle" class="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
          <div>
            <p class="text-xs font-medium text-green-700 dark:text-green-400 mb-1">Result</p>
            <p class="text-sm whitespace-pre-wrap">{{ agent.result }}</p>
          </div>
        </div>
      </div>

      <!-- Error -->
      <div v-if="agent.error && agent.status === 'failed'"
        class="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-100 dark:border-red-900/40">
        <div class="flex items-start gap-2">
          <UIcon name="i-heroicons-x-circle" class="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p class="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Error</p>
            <p class="text-sm">{{ agent.error }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

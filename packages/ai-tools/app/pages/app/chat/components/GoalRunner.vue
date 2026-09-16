<i18n src="./goal-runner.json"></i18n>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGoalRun, type GoalStepStatus } from '../composables/useGoalRun'

const props = defineProps<{
  businessId: string | null
}>()

const { t } = useI18n()
const {
  status,
  summary,
  steps,
  waiting,
  error,
  busy,
  startGoal,
  respondToApproval,
  cancelGoal,
  refreshGoal,
  resetGoal,
} = useGoalRun()

const goalInput = ref('')

const STATUS_COLORS: Record<GoalStepStatus, 'neutral' | 'primary' | 'success' | 'error' | 'warning'> = {
  pending: 'neutral',
  running: 'primary',
  completed: 'success',
  failed: 'error',
  waiting_approval: 'warning',
}

const canStart = computed(() => !!props.businessId && goalInput.value.trim().length > 0 && !busy.value)
const showOutcome = computed(() => status.value === 'completed' || status.value === 'failed' || status.value === 'cancelled')
const showProgress = computed(() => steps.value.length > 0 || status.value === 'running')

function statusColor(stepStatus: GoalStepStatus): 'neutral' | 'primary' | 'success' | 'error' | 'warning' {
  return STATUS_COLORS[stepStatus] ?? 'neutral'
}

function handleStart(): void {
  if (!props.businessId) return
  void startGoal(props.businessId, goalInput.value)
}

function handleApprove(): void {
  void respondToApproval(true)
}

function handleReject(): void {
  void respondToApproval(false)
}

function handleCancel(): void {
  void cancelGoal()
}

function handleRefresh(): void {
  void refreshGoal()
}

function handleReset(): void {
  goalInput.value = ''
  resetGoal()
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <p class="text-sm font-semibold text-highlighted">{{ t('title') }}</p>
      <p class="text-xs text-muted">{{ t('description') }}</p>
    </div>
    <div class="flex flex-col gap-2 sm:flex-row">
      <UInput
        v-model="goalInput"
        :placeholder="t('inputPlaceholder')"
        :disabled="busy"
        class="flex-1"
      />
      <UButton
        icon="i-heroicons-sparkles"
        color="primary"
        :label="t('start')"
        :loading="busy"
        :disabled="!canStart"
        @click="handleStart"
      />
    </div>
    <div v-if="showProgress" v-motion-fade :duration="200" class="space-y-2">
      <p class="text-sm font-semibold text-highlighted">{{ t('stepsTitle') }}</p>
      <ul class="space-y-1">
        <li v-for="step in steps" :key="step.id" class="flex items-center justify-between gap-2 text-sm">
          <span class="text-highlighted">{{ step.label }}</span>
          <UBadge :color="statusColor(step.status)" variant="subtle" size="xs">
            {{ t(`statuses.${step.status}`) }}
          </UBadge>
        </li>
      </ul>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="status === 'running'"
          size="xs"
          variant="ghost"
          color="neutral"
          :label="t('cancel')"
          :loading="busy"
          @click="handleCancel"
        />
        <UButton
          v-if="showOutcome"
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-heroicons-arrow-path"
          :label="t('refresh')"
          :loading="busy"
          @click="handleRefresh"
        />
        <UButton
          v-if="showOutcome"
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-heroicons-plus"
          :label="t('newGoal')"
          @click="handleReset"
        />
      </div>
    </div>
    <div v-if="waiting" v-motion-fade :duration="200" class="space-y-2 rounded-xl border border-warning/30 bg-warning/5 p-3">
      <p class="text-sm font-semibold text-highlighted">{{ t('waitingTitle') }}: {{ waiting.title }}</p>
      <p class="text-xs text-muted">{{ waiting.label }}</p>
      <div class="flex gap-2">
        <UButton size="sm" color="primary" :label="t('approve')" :loading="busy" @click="handleApprove" />
        <UButton size="sm" variant="ghost" color="neutral" :label="t('reject')" :loading="busy" @click="handleReject" />
      </div>
    </div>
    <p v-if="summary" v-motion-fade :duration="200" class="text-sm text-highlighted">
      <span class="font-semibold">{{ t('summaryTitle') }}:</span> {{ summary }}
    </p>
    <p v-if="error" v-motion-fade :duration="200" class="text-sm text-error">{{ error }}</p>
  </div>
</template>

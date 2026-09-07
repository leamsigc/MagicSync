<script lang="ts" setup>
/**
 * Component Description: Business-owner onboarding checklist.
 * Shows the 3 setup steps (business → connect accounts → first post)
 * with live completion state and a dismiss control.
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 */

export interface GettingStartedStep {
  key: string
  label: string
  description: string
  to: string
  icon: string
  done: boolean
  cta?: string
}

interface Props {
  steps: GettingStartedStep[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  dismiss: []
}>()

const STORAGE_KEY = 'magicsync:getting-started-dismissed'
const dismissed = ref(false)

onMounted(() => {
  dismissed.value = localStorage.getItem(STORAGE_KEY) === '1'
})

const allDone = computed(() => props.steps.length > 0 && props.steps.every(s => s.done))
const completedCount = computed(() => props.steps.filter(s => s.done).length)
const nextStepIndex = computed(() => props.steps.findIndex(s => !s.done))
const progress = computed(() => Math.round((completedCount.value / Math.max(props.steps.length, 1)) * 100))

function handleDismiss() {
  dismissed.value = true
  localStorage.setItem(STORAGE_KEY, '1')
  emit('dismiss')
}
</script>

<template>
  <UCard v-if="!dismissed && !allDone" class="overflow-hidden" :ui="{ body: 'p-4 sm:p-6' }">
    <div class="flex items-start justify-between gap-4 mb-1">
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary shrink-0">
          <UIcon name="i-lucide-rocket" class="w-5 h-5" />
        </div>
        <div>
          <h2 class="text-base font-semibold text-foreground">Get set up in 3 steps</h2>
          <p class="text-sm text-muted-foreground">
            {{ completedCount }} of {{ steps.length }} done — you're {{ progress }}% ready to post.
          </p>
        </div>
      </div>
      <UButton icon="i-lucide-x" variant="ghost" color="neutral" size="sm" aria-label="Dismiss setup guide"
        @click="handleDismiss" />
    </div>

    <UProgress :model-value="progress" size="sm" class="my-4" />

    <ol class="grid gap-3 sm:grid-cols-3">
      <li v-for="(step, index) in steps" :key="step.key">
        <component :is="step.done ? 'div' : 'NuxtLink'" :to="step.done ? undefined : step.to"
          class="relative flex items-center gap-3 rounded-lg border p-3 h-full transition-colors"
          :class="step.done
            ? 'border-border bg-muted/40 opacity-75'
            : index === nextStepIndex
              ? 'border-primary/50 bg-primary/5 hover:bg-primary/10 cursor-pointer'
              : 'border-border hover:bg-accent/40 cursor-pointer'">
          <div class="flex items-center justify-center w-9 h-9 rounded-full shrink-0"
            :class="step.done ? 'bg-success/15 text-success' : 'bg-secondary text-secondary-foreground'">
            <UIcon v-if="step.done" name="i-lucide-check" class="w-4.5 h-4.5" />
            <UIcon v-else :name="step.icon" class="w-4.5 h-4.5" />
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-foreground leading-tight">
              <span class="text-muted-foreground mr-1">{{ index + 1 }}.</span>{{ step.label }}
            </p>
            <p class="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {{ step.done ? 'Done ✓' : step.description }}
            </p>
            <span v-if="!step.done && index === nextStepIndex"
              class="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary">
              {{ step.cta || 'Start' }}
              <UIcon name="i-lucide-arrow-right" class="w-3 h-3" />
            </span>
          </div>
        </component>
      </li>
    </ol>
  </UCard>
</template>

<style scoped></style>

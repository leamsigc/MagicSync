<i18n src="#site/app/pages/app/chat/chat.json"></i18n>
<script setup lang="ts">
const props = defineProps<{
  busyKey: string | null
}>()

const emit = defineEmits<{
  (e: 'schedule-now'): void
  (e: 'post-now'): void
  (e: 'schedule-timeframe', value: string): void
  (e: 'select-account'): void
}>()

const { t } = useI18n()
const timeframe = ref('')

function isBusy(key: string): boolean {
  return props.busyKey === key
}

function handleScheduleNow(): void {
  emit('schedule-now')
}

function handlePostNow(): void {
  emit('post-now')
}

function handleScheduleTimeframe(): void {
  emit('schedule-timeframe', timeframe.value)
}

function handleSelectAccount(): void {
  emit('select-account')
}
</script>

<template>
  <div v-motion-fade :duration="200" class="flex flex-wrap items-center gap-2">
    <UButton
      size="sm"
      color="primary"
      variant="solid"
      icon="i-heroicons-calendar"
      :loading="isBusy('schedule-now')"
      @click="handleScheduleNow"
    >
      {{ t('workflow.draft.scheduleNow') }}
    </UButton>
    <UButton
      size="sm"
      color="neutral"
      variant="outline"
      icon="i-heroicons-paper-airplane"
      :loading="isBusy('post-now')"
      @click="handlePostNow"
    >
      {{ t('workflow.draft.postNow') }}
    </UButton>
    <UInput
      v-model="timeframe"
      type="datetime-local"
      size="sm"
      class="min-w-44 flex-1"
      :aria-label="t('workflow.draft.scheduleTimeframe')"
    />
    <UButton
      size="sm"
      color="neutral"
      variant="outline"
      icon="i-heroicons-clock"
      :loading="isBusy('schedule-timeframe')"
      @click="handleScheduleTimeframe"
    >
      {{ t('workflow.draft.scheduleTimeframe') }}
    </UButton>
    <UButton
      size="sm"
      color="neutral"
      variant="ghost"
      icon="i-heroicons-user-circle"
      :loading="isBusy('select-account')"
      @click="handleSelectAccount"
    >
      {{ t('workflow.draft.selectAccount') }}
    </UButton>
  </div>
</template>

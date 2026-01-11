<!--  Translation file -->
<i18n src="./DateRangeSelector.json"></i18n>

<script lang="ts" setup>
/**
 * Component Description: Date range selector with optional distribution settings
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [✔] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { CalendarDate, getLocalTimeZone, today } from '@internationalized/date'
import type { DateRange } from '@internationalized/date'

const emit = defineEmits<{
  update: [value: { startDate: Date; endDate: Date }]
}>()

const { t } = useI18n()
const locale = useI18n().locale

const currentLocalDay = today(getLocalTimeZone())
const range = ref<DateRange>({
  start: currentLocalDay,
  end: currentLocalDay.add({ days: 7 })
})

const formatDate = (date: any) => {
  if (!date) return ''
  return new Date(date.year, date.month - 1, date.day).toLocaleDateString(locale.value)
}

watch(range, (newRange) => {
  if (newRange.start && newRange.end) {
    emit('update', {
      startDate: new Date(newRange.start.year, newRange.start.month - 1, newRange.start.day),
      endDate: new Date(newRange.end.year, newRange.end.month - 1, newRange.end.day)
    })
  }
}, { deep: true, immediate: true })
</script>

<template>
  <div class="w-full">
    <label class="block text-sm font-medium mb-2">
      {{ t('dateRange.title') || 'Select Date Range' }}
    </label>

    <UPopover :ui="{ content: 'p-0' }">
      <UButton color="neutral" variant="subtle" block class="justify-start text-left font-normal"
        icon="i-heroicons-calendar-days">
        <template v-if="range.start && range.end">
          {{ formatDate(range.start) }} - {{ formatDate(range.end) }}
        </template>
        <template v-else>
          {{ t('dateRange.placeholder') || 'Pick a date range' }}
        </template>
      </UButton>

      <template #content>
        <UCalendar v-model="range" range class="p-2" />
      </template>
    </UPopover>
  </div>
</template>

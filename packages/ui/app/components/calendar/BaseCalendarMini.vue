<script setup lang="ts">
/**
 *
 * Component Description: The mini month calendar in the sidebar.
 *
 * Clicking a day navigates to it. Hovering a day emits its range so the caller
 * can warm the payload cache for it: the pointer reaches a target before the
 * click does, so the fetch has a head start.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { parseDate, type CalendarDate } from '@internationalized/date'
import { rangeFor, type DateRange } from '../../utils/calendarDates'

const { view, date, pathFor } = useCalendarRange()

const emit = defineEmits<{
  'hover-range': [range: DateRange]
}>()

const model = computed({
  get: () => date.value,
  set(value: CalendarDate | null | undefined) {
    if (value) {
      navigateTo(pathFor(value))
    }
  }
})

// Warm the range a click would open while the pointer hovers a day
function onPointerover(event: PointerEvent) {
  const value = (event.target as HTMLElement).closest('[data-value]')?.getAttribute('data-value')
  if (!value) {
    return
  }

  try {
    emit('hover-range', rangeFor(view.value, parseDate(value)))
  } catch {
    // Not a day cell
  }
}
</script>

<template>
  <UCalendar
    v-model="model"
    :week-starts-on="1"
    :year-controls="false"
    size="xs"
    fixed-weeks
    @pointerover="onPointerover"
  />
</template>

<script setup lang="ts">
/**
 * Component Description: One day column of the timed grid.
 *
 * The hour axis, the positioned event blocks and the now indicator. Its top is
 * midnight for the pointer gestures too, so a drag reads a time straight off the
 * pointer, and `data-date` is what a drag reads a day back off.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { CalendarEvent } from '#layers/BaseShared/shared/calendarTypes'
import {
  HOUR_HEIGHT,
  isSameDay,
  isToday,
  type PositionedEvent
} from '../../utils/calendarLayout'
import { dateWithMinutes, isoDate, parseLocalDatetime, snapMinutes } from '../../utils/calendarDates'

const props = defineProps<{
  day: Date
  events: PositionedEvent[]
  /** The leftmost column on screen, where an event arriving from a hidden day takes its form. */
  first?: boolean
  /** Id of the event whose popover is open, so the form hangs off one day only. */
  editingId?: string
  /** Past days dim and keep emitting — the caller toasts instead of creating. */
  disabled?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  commit: [event: CalendarEvent, start: Date]
  update: [event: CalendarEvent]
  remove: [event: CalendarEvent]
  open: [id: string]
  close: []
  /** An empty slot was clicked: the caller opens the create modal at this instant. */
  drill: [date: Date]
}>()

// Placeholder blocks shown while a range loads, as [start hour, hours]
const SKELETONS = [[9, 1.5], [13, 1], [16, 2]] as const

const hours = Array.from({ length: 23 }, (_, index) => index + 1)

const column = useTemplateRef('column')

// A block running past midnight draws in both days, and the form goes to the
// one holding its start so it does not open twice
function anchored(event: CalendarEvent): boolean {
  return isSameDay(parseLocalDatetime(event.start), props.day) || (!!props.first && parseLocalDatetime(event.start) < props.day)
}

// Clicks on a block, a button or an open popover bubble up here and must not
// start a draft — only the empty column behind them creates
function onColumnClick(pointer: MouseEvent) {
  if ((pointer.target as HTMLElement).closest('[data-event],button,a,[role="dialog"]')) {
    return
  }

  const top = column.value?.getBoundingClientRect().top ?? 0
  const minutes = snapMinutes(Math.max(0, (pointer.clientY - top) / HOUR_HEIGHT) * 60)

  emit('drill', dateWithMinutes(props.day, minutes))
}

function forwardCommit(event: CalendarEvent, start: Date) {
  emit('commit', event, start)
}

function forwardUpdate(event: CalendarEvent) {
  emit('update', event)
}

function forwardRemove(event: CalendarEvent) {
  emit('remove', event)
}

function forwardOpen(id: string) {
  emit('open', id)
}

function forwardClose() {
  emit('close')
}
</script>

<template>
  <!-- The column start is the scroller's snap point for midnight, the hour lines
    cover the rest of the day -->
  <div
    ref="column"
    data-day-column
    :data-date="isoDate(day)"
    :data-past="disabled || undefined"
    :aria-disabled="disabled || undefined"
    class="relative border-s border-default snap-start"
    :class="disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
    :style="{ height: `${24 * HOUR_HEIGHT}px` }"
    @click="onColumnClick"
  >
    <div
      v-for="hour in hours"
      :key="hour"
      class="absolute inset-x-0 border-t border-default pointer-events-none snap-start"
      :style="{ top: `${hour * HOUR_HEIGHT}px` }"
    />

    <USkeleton
      v-for="[hour, hours] in loading ? SKELETONS : []"
      :key="hour"
      class="absolute inset-x-1 rounded-xs"
      :style="{ top: `${hour * HOUR_HEIGHT}px`, height: `${hours * HOUR_HEIGHT}px` }"
    />

    <!-- A call site that has its own event row (the post calendar does) swaps the
      block through `#event-block` and keeps everything else: the geometry, the
      pointer gesture and the popover chrome stay generic. The default branch is
      what the grid renders when nothing is swapped in -->
    <template
      v-for="positioned in events"
      :key="positioned.event.id"
    >
      <slot
        v-if="$slots['event-block']"
        name="event-block"
        :positioned="positioned"
        :anchored="anchored(positioned.event)"
        :editing-id="editingId"
      />

      <BaseCalendarEventBlock
        v-else
        :positioned="positioned"
        :anchored="anchored(positioned.event)"
        :editing-id="editingId"
        @commit="forwardCommit"
        @update="forwardUpdate"
        @remove="forwardRemove"
        @open="forwardOpen"
        @close="forwardClose"
      >
        <template #event-form="{ event: formEvent }">
          <slot
            name="event-form"
            :event="formEvent"
          />
        </template>
      </BaseCalendarEventBlock>
    </template>

    <ClientOnly>
      <BaseCalendarNowIndicator v-if="isToday(day)" />
    </ClientOnly>
  </div>
</template>

<!--  Translation file -->
<i18n src="./BaseCalendarEventChip.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: All-day and month-grid event chip.
 *
 * A compact tinted pill below `lg`, where a month cell has no room for both a
 * dot and a time: the calendar color is carried by the fill and only the title
 * rides inside. Colored from the event's own token.
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
  calendarDotClasses,
  eventBlockClasses,
  eventChipCompactClasses,
  eventOutlineClasses
} from '../../composables/useCalendarColors'
import { formatTime, parseLocalDatetime } from '../../utils/calendarDates'

const { t } = useI18n()

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  event: CalendarEvent
  /** The month grid shows the time; the all-day row does not. */
  showTime?: boolean
  /** The segment the popover hangs off, for a chip drawn across more than one day. */
  anchored?: boolean
  /** Id of the event whose popover is open, so the form hangs off one day only. */
  editingId?: string
}>(), { anchored: true })

const emit = defineEmits<{
  update: [event: CalendarEvent]
  remove: [event: CalendarEvent]
  open: [id: string]
  close: []
}>()

const startTime = computed(() => formatTime(parseLocalDatetime(props.event.start)))

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
  <!-- The default slot is spelled out rather than written as a `v-slot` attribute
    on the tag: `@vue/compiler-core@3.5.43` fails its codegen on a `v-slot`
    attribute combined with a named `<template #event-form>` slot on the same
    component ("Codegen node is missing for element/if/for node"). The explicit
    `<template #default>` form compiles and reads the same -->
  <BaseCalendarEventPopover
    :event="event"
    :anchored="anchored"
    :editing-id="editingId"
    @update="forwardUpdate"
    @remove="forwardRemove"
    @open="forwardOpen"
    @close="forwardClose"
  >
    <template #default="{ open }">
      <button
        v-bind="$attrs"
        type="button"
        data-event
        class="select-none flex items-center gap-1.5 min-w-0 rounded-full px-1.5 py-0.5 text-xs text-start transition-colors focus-visible:outline-3"
        :class="[
          eventOutlineClasses[event.color],
          event.allDay
            ? eventBlockClasses[event.color]
            : ['text-default hover:bg-elevated data-active:bg-elevated', eventChipCompactClasses[event.color]]
        ]"
        :data-active="open || undefined"
        :aria-label="event.allDay
          ? t('allDayAria', { title: event.title })
          : t('eventAria', { title: event.title, time: startTime })"
        @click.stop
      >
        <span
          v-if="event.allDay"
          :class="calendarDotClasses[event.color]"
          class="rounded-full flex items-center justify-center p-0.5 -mx-0.75"
        >
          <UIcon
            name="i-lucide-calendar"
            class="size-2.5 shrink-0 text-inverted"
          />
        </span>
        <span
          v-else
          class="max-lg:hidden size-2 shrink-0 rounded-full"
          :class="calendarDotClasses[event.color]"
        />

        <span class="font-medium truncate">{{ event.title }}</span>
        <!-- The call site's compact identity row: the post calendar fills it
          with the targeted platform icons, the way the retired month grid did -->
        <slot name="meta" :event="event" />
        <!-- `data-time` so a call site in a tight spot can hide it from outside -->
        <span
          v-if="showTime && !event.allDay"
          data-time
          class="ms-auto shrink-0 text-muted tabular-nums text-[11px]"
        >
          {{ startTime }}
        </span>
      </button>
    </template>

    <template #event-form="{ event: formEvent, close }">
      <slot
        name="event-form"
        :event="formEvent"
        :close="close"
      />
    </template>
  </BaseCalendarEventPopover>
</template>

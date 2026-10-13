<!--  Translation file -->
<i18n src="./BaseCalendarEventBlock.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: Timed event block inside the week and day grids.
 *
 * Pointer-draggable: the block translates as a ghost while the pointer is down
 * and emits the dropped start on release, which is the only thing a move
 * commits — a post has a single `scheduledAt` and no duration. Colored from the
 * event's own token, so the block knows nothing about what an event is.
 *
 * The chip body is a `#content` slot so a call site can put its own row inside
 * the button; the default is the title plus the previewed time, which is all the
 * generic grid needs. `suppressed` is wired to the popover's `disabled`, which
 * is what keeps a finished drag from opening the form on the click that ends it.
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
  eventOutlineClasses
} from '../../composables/useCalendarColors'
import { PX_PER_MINUTE, eventBlockStyle, type PositionedEvent } from '../../utils/calendarLayout'
import { formatTime, parseLocalDatetime } from '../../utils/calendarDates'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  /** The laid-out event: geometry plus the event itself. */
  positioned: PositionedEvent
  /** The day the popover hangs off, for a block drawn in more than one day. */
  anchored?: boolean
  /** Id of the event whose popover is open, so the form hangs off one day only. */
  editingId?: string
  /** False for an event that cannot move: it renders `data-draggable="false"` and ignores the gesture. */
  draggable?: boolean
}>(), { anchored: true, draggable: true })

const emit = defineEmits<{
  commit: [event: CalendarEvent, start: Date]
  update: [event: CalendarEvent]
  remove: [event: CalendarEvent]
  open: [id: string]
  close: []
}>()

const event = computed(() => props.positioned.event)

const {
  dragging,
  suppressed,
  deltaMinutes,
  onPointerdown,
  onPointermove,
  onPointerup,
  onPointercancel
} = useCalendarEventDrag(event, {
  onCommit: (start: Date) => emit('commit', event.value, start)
})

const style = computed(() => ({
  ...eventBlockStyle(props.positioned),
  transform: dragging.value ? `translateY(${deltaMinutes.value * PX_PER_MINUTE}px)` : undefined
}))

// While dragging, show the previewed times instead of the stored ones
const previewTime = computed(() => {
  const start = parseLocalDatetime(event.value.start)
  const end = parseLocalDatetime(event.value.end)

  if (!dragging.value) {
    return `${formatTime(start)} – ${formatTime(end)}`
  }

  const shifted = start.getTime() + deltaMinutes.value * 60_000

  return `${formatTime(new Date(shifted))} – ${formatTime(new Date(shifted + end.getTime() - start.getTime()))}`
})

const compact = computed(() => props.positioned.height < 40)

/** A fixed event still opens its form, it just never starts a drag. */
function onBlockPointerdown(pointerEvent: PointerEvent) {
  if (!props.draggable) {
    return
  }

  onPointerdown(pointerEvent)
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
  <BaseCalendarEventPopover
    :event="event"
    :anchored="anchored"
    :editing-id="editingId"
    :disabled="suppressed"
    @update="forwardUpdate"
    @remove="forwardRemove"
    @open="forwardOpen"
    @close="forwardClose"
  >
    <button
      type="button"
      data-event
      v-motion
      :initial="{ opacity: 0, scale: 0.98 }"
      :enter="{ opacity: 1, scale: 1, transition: { duration: 200 } }"
      class="absolute flex flex-col items-start overflow-hidden rounded-xs px-3 py-1 text-xs text-start transition-colors select-none touch-none focus-visible:outline-3"
      :class="[
        eventBlockClasses[event.color],
        eventOutlineClasses[event.color],
        dragging ? 'z-20' : 'z-5'
      ]"
      :style="style"
      :data-draggable="draggable ? 'true' : 'false'"
      :aria-label="t('eventAria', { title: event.title, time: previewTime })"
      @click.stop
      @pointerdown="onBlockPointerdown"
      @pointermove="onPointermove"
      @pointerup="onPointerup"
      @pointercancel="onPointercancel"
    >
      <span
        class="absolute inset-s-1 inset-y-1 w-1 rounded-full"
        :class="calendarDotClasses[event.color]"
      />

      <slot
        name="content"
        :compact="compact"
        :preview-time="previewTime"
      >
        <span class="w-full font-medium truncate">{{ event.title }}</span>
        <span
          v-if="!compact || dragging"
          class="w-full truncate opacity-80 tabular-nums"
        >
          {{ previewTime }}
        </span>
      </slot>
    </button>

    <template #event-form="{ event: formEvent, close }">
      <slot
        name="event-form"
        :event="formEvent"
        :close="close"
      />
    </template>
  </BaseCalendarEventPopover>
</template>

<!--  Translation file -->
<i18n src="./BaseCalendarDayView.json"></i18n>
<script setup lang="ts">
/**
 *
 * Component Description: A single day, full width — the hour axis and one day
 * column behind a floating day header and all-day band.
 *
 * The day column is the width of the grid, so the form stands below an event
 * rather than beside it (`formSide`), and a drag can only move it in time.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { CalendarEvent } from '#layers/BaseShared/shared/calendarTypes'
import type { UseCalendarEvents } from '../../composables/useCalendarEvents'
import {
  HOUR_HEIGHT,
  isToday,
  layoutAllDay,
  layoutDay,
  PX_PER_MINUTE,
  scrollViewport
} from '../../utils/calendarLayout'
import { dateWithMinutes, formatFullDate, formatHour, isPastDay, isoDate, minutesIntoDay, toDate } from '../../utils/calendarDates'

const { t } = useI18n()

const props = defineProps<{
  /** The event pool: bucketed by day, plus the loading state. */
  calendar: UseCalendarEvents
  /** Id of the event whose form is open, so it hangs off one day only. */
  editingId?: string
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

const { date } = useCalendarRange()
const mounted = useMounted()

const day = computed(() => toDate(date.value))

const timedEvents = computed(() => layoutDay(
  props.calendar.eventsForDay(day.value).filter(event => !event.allDay),
  day.value
))

const allDayEvents = computed(() => layoutAllDay(
  props.calendar.eventsForDays([day.value]).filter(event => event.allDay),
  [day.value]
))

const hours = Array.from({ length: 23 }, (_, index) => index + 1)

// One column the width of the grid, so the day header needs no weekday strip
const gridStyle = { gridTemplateColumns: '3.5rem minmax(0, 1fr)' }

const DAY_HEADER_HEIGHT = 41
const ALL_DAY_LANE_HEIGHT = 28
const ALL_DAY_ROW_BORDER = 1

const allDayLanes = computed(() => allDayEvents.value.reduce((lanes, { lane }) => Math.max(lanes, lane + 1), 1))

const chromeHeight = computed(() => DAY_HEADER_HEIGHT + allDayLanes.value * ALL_DAY_LANE_HEIGHT + ALL_DAY_ROW_BORDER)

const chromeOffset = computed(() => `calc(var(--ui-header-height) + 0.5rem + ${chromeHeight.value}px)`)

const START_OFFSET = 7 * HOUR_HEIGHT

const startPull = computed(() => `calc(-1 * clamp(0px, ${START_OFFSET}px, ${24 * HOUR_HEIGHT}px + ${chromeOffset}px - 100svh))`)

const container = useTemplateRef('container')

// Opens on the current time when showing today — at 8pm the grid lands on the
// evening instead of midnight — and on the morning default for any other day
function startOffset(): number {
  if (!isToday(day.value)) {
    return START_OFFSET
  }

  const nowTop = minutesIntoDay(new Date()) * PX_PER_MINUTE

  return Math.max(0, nowTop - 2 * HOUR_HEIGHT)
}

async function scrollToStart() {
  await nextTick()

  const viewport = scrollViewport(container.value?.$el)

  if (!viewport) {
    return
  }

  viewport.scrollTo({ top: startOffset() })

  // A programmatic scroll can land before layout settles or get pulled by the
  // hour-line snap; one more frame confirms it stuck, else it goes again
  requestAnimationFrame(() => {
    if (Math.abs(viewport.scrollTop - startOffset()) > HOUR_HEIGHT) {
      viewport.scrollTo({ top: startOffset() })
    }
  })
}

onMounted(scrollToStart)

// Prev/next stays mounted, so the scroll has to follow the anchor date too
watch(date, () => {
  void scrollToStart()
})

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

function forwardDrill(target: Date) {
  emit('drill', target)
}

// An all-day cell has no hour to read off a click, so it drafts at 9am — the
// same default the month grid uses. Clicks on a chip, a button or an open
// popover bubble up here and must not start a draft
function drillMorning(target: Date, pointer?: MouseEvent) {
  if ((pointer?.target as HTMLElement | undefined)?.closest?.('[data-event],button,a,[role="dialog"]')) {
    return
  }

  emit('drill', dateWithMinutes(target, 9 * 60))
}
</script>

<template>
  <div class="relative flex-1 flex flex-col min-h-0">
    <UScrollArea
      ref="container"
      :style="{ scrollPaddingTop: chromeOffset }"
      class="flex-1 z-0 snap-y snap-proximity [scrollbar-gutter:stable] [view-transition-name:calendar]"
    >
      <div
        data-week-grid
        class="grid"
        :style="{ ...gridStyle, paddingTop: chromeOffset, marginTop: mounted ? undefined : startPull }"
      >
        <div
          class="relative"
          :style="{ height: `${24 * HOUR_HEIGHT}px` }"
        >
          <span
            v-for="hour in hours"
            :key="hour"
            class="absolute end-2 -translate-y-1/2 text-[11px] text-dimmed tabular-nums"
            :style="{ top: `${hour * HOUR_HEIGHT}px` }"
          >
            {{ formatHour(hour) }}
          </span>
        </div>

        <BaseCalendarDayColumn
          :day="day"
          :events="timedEvents"
          :editing-id="editingId"
          :disabled="isPastDay(day)"
          :loading="calendar.loading.value"
          @commit="forwardCommit"
          @update="forwardUpdate"
          @remove="forwardRemove"
          @open="forwardOpen"
          @close="forwardClose"
          @drill="forwardDrill"
        >
          <template #event-form="form">
            <slot
              name="event-form"
              v-bind="form"
            />
          </template>
          <template #event-block="block">
            <slot
              name="event-block"
              v-bind="block"
            />
          </template>
        </BaseCalendarDayColumn>
      </div>
    </UScrollArea>

    <div
      class="absolute top-[calc(var(--ui-header-height)+0.5rem)] inset-x-0 z-30 glass-material bg-(--glass-bg) border-b border-default overflow-hidden [scrollbar-gutter:stable] [view-transition-name:weekdays]"
    >
      <div
        class="grid"
        :style="gridStyle"
      >
        <div />
        <div class="flex items-center gap-1 py-2 text-sm border-s border-default">
          <span class="text-muted truncate">
            {{ formatFullDate(day) }}
          </span>
        </div>
      </div>

      <div
        class="grid border-t border-default"
        :style="{ ...gridStyle, gridTemplateRows: `repeat(${allDayLanes}, ${ALL_DAY_LANE_HEIGHT}px)` }"
      >
        <span class="row-span-full self-center text-[10px] text-dimmed text-end pe-2">
          {{ t('allDay') }}
        </span>

        <div
          :data-date="isoDate(day)"
          :data-past="isPastDay(day) || undefined"
          class="row-span-full border-s border-default"
          :class="isPastDay(day) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
          :style="{ gridColumn: 2 }"
          @click="drillMorning(day, $event)"
        />

        <BaseCalendarEventChip
          v-for="{ event, lane } in allDayEvents"
          :key="event.id"
          :event="event"
          :editing-id="editingId"
          class="mx-1 mt-1 h-5"
          :style="{ gridRow: lane + 1 }"
          @update="forwardUpdate"
          @remove="forwardRemove"
          @open="forwardOpen"
          @close="forwardClose"
        >
          <template #event-form="form">
            <slot
              name="event-form"
              v-bind="form"
            />
          </template>
        </BaseCalendarEventChip>
      </div>
    </div>
  </div>
</template>

<!--  Translation file -->
<i18n src="./BaseCalendarWeekView.json"></i18n>
<script setup lang="ts">
/**
 *
 * Component Description: The Apple-style week grid — seven day columns behind a
 * floating day-header and all-day band.
 *
 * The day header rides over the scroller, so events scroll behind the blur. The
 * grid pads itself by the header band and opens at 7am: a server render has no
 * scroll position to hand over, so it pulls the grid up by that much instead and
 * the client swaps the pull for a real scroll on the frame it hydrates.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { breakpointsTailwind } from '@vueuse/core'
import type { CalendarDate } from '@internationalized/date'
import type { CalendarEvent } from '#layers/BaseShared/shared/calendarTypes'
import type { UseCalendarEvents } from '../../composables/useCalendarEvents'
import {
  differenceInCalendarDays,
  HOUR_HEIGHT,
  isSameDay,
  isToday,
  layoutAllDay,
  layoutDay,
  PX_PER_MINUTE,
  scrollViewport
} from '../../utils/calendarLayout'
import { dateWithMinutes, eachDay, formatHour, formatWeekday, isPastDay, isoDate, minutesIntoDay, toDate } from '../../utils/calendarDates'

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

const { range, date } = useCalendarRange()

const isSmallScreen = useBreakpoints(breakpointsTailwind).smaller('lg')
// Only narrow after mount: the server always renders the full week, so the
// hydrated DOM must match it
const mounted = useMounted()

// A phone shows a three-day window around the anchor date, clamped so it stays
// inside the fetched week
function narrowedWindow(week: Date[], anchor: CalendarDate): Date[] {
  const index = differenceInCalendarDays(toDate(anchor), week[0]!)
  const start = Math.min(Math.max(index, 0), week.length - 3)

  return week.slice(start, start + 3)
}

const days = computed(() => {
  const week = eachDay(range.value)
  if (week.length <= 3 || !mounted.value || !isSmallScreen.value) {
    return week
  }

  return narrowedWindow(week, date.value)
})

const gridStyle = computed(() => ({
  gridTemplateColumns: `3.5rem repeat(${days.value.length}, minmax(0, 1fr))`
}))

const timedEvents = computed(() => days.value.map(day =>
  layoutDay(props.calendar.eventsForDay(day).filter(event => !event.allDay), day)
))

const allDayEvents = computed(() => layoutAllDay(
  props.calendar.eventsForDays(days.value).filter(event => event.allDay),
  days.value
))

const hours = Array.from({ length: 23 }, (_, index) => index + 1)

// The day header rides over the scroller, so the grid has to pad itself by the
// header band plus the header's own height. Only the all-day row varies, the day
// names are the fixed height the month view mirrors (plus its border)
const DAY_HEADER_HEIGHT = 41
// A lane is a row holding an `h-5` chip, its 4px top margin and the 4px it
// leaves below. The row adds its top border on top of that
const ALL_DAY_LANE_HEIGHT = 28
const ALL_DAY_ROW_BORDER = 1

// The row always stands, empty or not: it is the only place a multi-day event
// can be drawn, and a row that appears with the first all-day event of a week
// pushes the whole grid down as it arrives
const allDayLanes = computed(() => allDayEvents.value.reduce((lanes, { lane }) => Math.max(lanes, lane + 1), 1))

const chromeHeight = computed(() => DAY_HEADER_HEIGHT + allDayLanes.value * ALL_DAY_LANE_HEIGHT + ALL_DAY_ROW_BORDER)

const chromeOffset = computed(() => `calc(var(--ui-header-height) + 0.5rem + ${chromeHeight.value}px)`)

const START_OFFSET = 7 * HOUR_HEIGHT

const startPull = computed(() => `calc(-1 * clamp(0px, ${START_OFFSET}px, ${24 * HOUR_HEIGHT}px + ${chromeOffset}px - 100svh))`)

const container = useTemplateRef('container')

// Opens on the current time when the week holds today — at 8pm the grid lands
// on the evening instead of midnight — and on the morning default otherwise
function startOffset(): number {
  const holdsToday = days.value.some(day => isSameDay(day, new Date()))

  if (!holdsToday) {
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
    <!-- Snapped on the hour lines, so the grid settles on a whole hour under the
      chrome instead of cutting one in half. The padding matches the grid's, an
      hour then lands right below the header. `stable` holds the scrollbar's
      gutter whether or not the day overflows -->
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
          v-for="(day, index) in days"
          :key="day.getTime()"
          :day="day"
          :events="timedEvents[index]!"
          :first="index === 0"
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

    <!-- Outside the scroller like the month view's weekday bar: sitting inside
      it, the scroll area (a backdrop root, it carries a view transition name)
      would be all the blur has to sample. The grid scrolls, so its columns are a
      scrollbar narrower than this band and the day headers drifted right of
      their own columns by the last one. Reserving the same gutter here lines
      them back up -->
    <div
      class="absolute top-[calc(var(--ui-header-height)+0.5rem)] inset-x-0 z-30 glass-material bg-(--glass-bg) border-b border-default overflow-hidden [scrollbar-gutter:stable] [view-transition-name:weekdays]"
    >
      <div
        class="grid"
        :style="gridStyle"
      >
        <div />

        <div
          v-for="day in days"
          :key="day.getTime()"
          class="flex items-center justify-center gap-1 py-2 text-sm border-s border-default"
        >
          <span class="text-muted">
            {{ formatWeekday(day) }}
          </span>
          <span
            class="flex items-center justify-center size-6 font-semibold rounded-full"
            :class="isToday(day) ? 'bg-primary text-inverted' : 'text-highlighted'"
          >
            {{ day.getDate() }}
          </span>
        </div>
      </div>

      <!-- Full-height rows rather than a gap and a bottom padding around the
        chips: the row still stands at its size with nothing in it, and the column
        separators reach the border closing it -->
      <div
        class="grid border-t border-default"
        :style="{ ...gridStyle, gridTemplateRows: `repeat(${allDayLanes}, ${ALL_DAY_LANE_HEIGHT}px)` }"
      >
        <span class="row-span-full self-center text-[10px] text-dimmed text-end pe-2">
          {{ t('allDay') }}
        </span>

        <div
          v-for="(day, index) in days"
          :key="`all-day-${day.getTime()}`"
          :data-date="isoDate(day)"
          :data-past="isPastDay(day) || undefined"
          class="row-span-full border-s border-default"
          :class="isPastDay(day) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
          :style="{ gridColumn: index + 2 }"
          @click="drillMorning(day, $event)"
        />

        <BaseCalendarEventChip
          v-for="{ event, colStart, colSpan, lane } in allDayEvents"
          :key="event.id"
          :event="event"
          :editing-id="editingId"
          class="mx-1 mt-1 h-5"
          :style="{ gridColumn: `${colStart + 2} / span ${colSpan}`, gridRow: lane + 1 }"
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

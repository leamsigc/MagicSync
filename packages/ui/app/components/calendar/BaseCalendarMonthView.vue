<!--  Translation file -->
<i18n src="./BaseCalendarMonthView.json"></i18n>
<script setup lang="ts">
/**
 *
 * Component Description: The month grid — a fixed six rows of seven days under a
 * floating weekday bar.
 *
 * Deliberately not virtualized: the upstream template streams six-week chunks
 * through a virtualizer to cover five years either side, which is the single
 * most complex piece of that port. A fixed grid of the fetched month keeps every
 * function here inside the branch budget. The title still follows the scroll —
 * the month of the last day of the top visible row is docked, and the view rides
 * its own copy of it while the grid moves, so the header hands the title over.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { CalendarDate } from '@internationalized/date'
import type { CalendarEvent } from '#layers/BaseShared/shared/calendarTypes'
import type { AllDayPositionedEvent } from '../../utils/calendarLayout'
import type { UseCalendarEvents } from '../../composables/useCalendarEvents'
import {
  isSameDay,
  isToday,
  layoutAllDay,
  scrollViewport
} from '../../utils/calendarLayout'
import {
  dateWithMinutes,
  eachDay,
  formatShortMonth,
  formatWeekday,
  isPastDay,
  isoDate,
  MONTH_WEEKS,
  monthRange,
  parseLocalDatetime,
  toCalendarDate
} from '../../utils/calendarDates'

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
  /** An empty day cell was clicked: the caller opens the create modal that morning. */
  drill: [date: Date]
}>()

const { date, title, pathFor, visibleMonth, monthLabelsVisible } = useCalendarRange()

const SLOT_HEIGHT = 22
const MAX_SLOTS = 4
// Bars never take the last slot, so a day always has room for an event or the
// "+N more" button
const MAX_LANES = MAX_SLOTS - 1
const ROW_HEIGHT = 140
// The scroll area starts at the page top so events show through the blurred
// chrome: the header plus the weekday bar the grid rests under
const HEADER_PADDING = 8
const HEADER_HEIGHT = 64
const WEEKDAY_HEIGHT = 40
const CHROME_HEIGHT = HEADER_PADDING + HEADER_HEIGHT + WEEKDAY_HEIGHT
// Height of a month label, spacing the overlay. It is the `text-2xl` line box
const LABEL_HEIGHT = 32
// Where the docked label rests, on the centre of the header title
const DOCK_TOP = HEADER_PADDING + (HEADER_HEIGHT - 1 - LABEL_HEIGHT) / 2

interface MonthCell {
  day: Date
  events: { event: CalendarEvent, slot: number, anchored: boolean }[]
  /** The row the "+N more" button takes. */
  moreSlot: number
  hidden: number
}

interface MonthRow {
  days: Date[]
  lanes: AllDayPositionedEvent[]
  cells: MonthCell[]
}

const gridStyle = {
  // The last slot takes the leftover height so the column separators reach the
  // bottom of the row
  gridTemplateRows: ['auto', ...Array.from({ length: MAX_LANES }, () => `${SLOT_HEIGHT}px`), `minmax(${SLOT_HEIGHT}px, 1fr)`].join(' ')
}

const monthDays = computed(() => eachDay(monthRange(date.value)))

const weekdays = computed(() => monthDays.value.slice(0, 7).map(formatWeekday))

const weeks = computed(() => Array.from(
  { length: MONTH_WEEKS },
  (_, week) => monthDays.value.slice(week * 7, week * 7 + 7)
))

function byStart(a: CalendarEvent, b: CalendarEvent): number {
  return a.start.localeCompare(b.start)
}

function covers(lane: AllDayPositionedEvent, index: number): boolean {
  return index >= lane.colStart && index < lane.colStart + lane.colSpan
}

function freeSlots(lanes: AllDayPositionedEvent[], index: number): number[] {
  const taken = new Set(lanes.filter(lane => covers(lane, index)).map(lane => lane.lane))

  return Array.from({ length: MAX_SLOTS }, (_, slot) => slot).filter(slot => !taken.has(slot))
}

// Timed events fill the slots the day's bars leave free, top first, and the last
// free slot becomes the "+N more" button when they overflow
function visibleSlotCount(timed: number, free: number, dropped: number): number {
  return dropped > 0 || timed > free ? Math.max(free - 1, 0) : free
}

function toCell(day: Date, index: number, lanes: AllDayPositionedEvent[]): MonthCell {
  const timed = props.calendar.eventsForDay(day).filter(event => !event.allDay).sort(byStart)
  const free = freeSlots(lanes, index)
  const dropped = lanes.filter(lane => covers(lane, index) && lane.lane >= MAX_LANES).length
  const visible = timed.slice(0, visibleSlotCount(timed.length, free.length, dropped))

  return {
    day,
    events: visible.map((event, position) => ({
      event,
      slot: free[position]!,
      anchored: isSameDay(parseLocalDatetime(event.start), day)
    })),
    moreSlot: free[Math.max(visible.length, free.length - 1)] ?? 0,
    hidden: dropped + timed.length - visible.length
  }
}

function toRow(days: Date[]): MonthRow {
  const lanes = layoutAllDay(
    props.calendar.eventsForDays(days).filter(event => event.allDay),
    days
  )

  return {
    days,
    lanes,
    cells: days.map((day, index) => toCell(day, index, lanes))
  }
}

const rows = computed<MonthRow[]>(() => weeks.value.map(toRow))

// The docked month is the one that most recently crossed the top of the
// viewport, read off the last day of the row sitting there
const root = useTemplateRef('root')
const viewport = computed(() => scrollViewport(root.value?.$el))

function dockedMonth(): CalendarDate | null {
  const offset = viewport.value?.scrollTop
  if (offset == null) {
    return null
  }

  const row = weeks.value[Math.min(MONTH_WEEKS - 1, Math.max(0, Math.floor(offset / ROW_HEIGHT)))]

  return row ? toCalendarDate(row[6]!).set({ day: 1 }) : null
}

function onScroll() {
  const docked = dockedMonth()
  if (!docked) {
    return
  }

  if (!visibleMonth.value || docked.compare(visibleMonth.value) !== 0) {
    visibleMonth.value = docked
  }

  // The riding labels only exist while the grid moves; the header title carries
  // the docked month the rest of the time
  monthLabelsVisible.value = true
}

useEventListener(viewport, 'scroll', onScroll, { passive: true })

function label(day: Date): string {
  return day.getDate() === 1 ? `${formatShortMonth(day)} 1` : String(day.getDate())
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

// A month cell has no hour to read off a click, so it drafts at 9am — past days
// still emit, and the caller toasts instead of creating. Clicks on a chip, a
// button or an open popover bubble up here and must not start a draft
function drillMorning(target: Date, pointer?: MouseEvent) {
  if ((pointer?.target as HTMLElement | undefined)?.closest?.('[data-event],button,a,[role="dialog"]')) {
    return
  }

  emit('drill', dateWithMinutes(target, 9 * 60))
}

onUnmounted(() => {
  visibleMonth.value = null
  monthLabelsVisible.value = false
})
</script>

<template>
  <div class="relative flex-1 flex flex-col min-h-0">
    <UScrollArea
      ref="root"
      :style="{ paddingTop: `${CHROME_HEIGHT}px` }"
      class="flex-1 z-0 snap-y snap-proximity [scrollbar-gutter:stable] [view-transition-name:calendar]"
    >
      <div
        v-for="row in rows"
        :key="row.days[0]!.getTime()"
        class="grid grid-cols-7 min-w-0 border-b border-default"
        :style="{ ...gridStyle, height: `${ROW_HEIGHT}px` }"
      >
        <!-- Column separators, behind everything so a gesture on empty space
          anywhere in the day lands here. They carry the day a drag reads back
          off them -->
        <div
          v-for="(cell, index) in row.cells"
          :key="`day-${cell.day.getTime()}`"
          :data-date="isoDate(cell.day)"
          :data-past="isPastDay(cell.day) || undefined"
          class="row-span-full border-default"
          :class="[index !== 0 && 'border-s', isPastDay(cell.day) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer']"
          :style="{ gridColumn: index + 1 }"
          @click="drillMorning(cell.day, $event)"
        />

        <!-- A `UButton` here would be the ghost and solid `xs` variants, but the
          month grid renders a hundred of these at once and resolving the theme
          that many times is what made switching to this view slow. It is a link,
          so it renders as one -->
        <NuxtLink
          v-for="(cell, index) in row.cells"
          :key="`number-${cell.day.getTime()}`"
          :to="pathFor(toCalendarDate(cell.day), 'day')"
          class="select-none row-start-1 justify-self-end inline-flex items-center justify-center h-6 min-w-6 m-0.5 px-1 py-1 text-xs font-semibold rounded-full transition-colors focus-visible:outline-3"
          :class="isToday(cell.day)
            ? 'text-inverted bg-primary active:bg-primary/75 outline-primary/25'
            : 'text-default hover:bg-elevated active:bg-elevated outline-inverted/25'"
          :style="{ gridColumn: index + 1 }"
        >
          {{ label(cell.day) }}
        </NuxtLink>

        <template
          v-for="{ event, colStart, colSpan, lane } in row.lanes"
          :key="event.id"
        >
          <BaseCalendarEventChip
            :event="event"
            :editing-id="editingId"
            class="self-start mx-0.5"
            :style="{ gridColumn: `${colStart + 1} / span ${colSpan}`, gridRow: lane + 2 }"
            @update="forwardUpdate"
            @remove="forwardRemove"
            @open="forwardOpen"
            @close="forwardClose"
          >
            <template #meta="meta">
              <slot
                name="event-chip-meta"
                v-bind="meta"
              />
            </template>
            <template #event-form="form">
              <slot
                name="event-form"
                v-bind="form"
              />
            </template>
          </BaseCalendarEventChip>
        </template>

        <template
          v-for="(cell, index) in row.cells"
          :key="`events-${cell.day.getTime()}`"
        >
          <!-- A phone cell has no room for a title and a time, and the title is
            what identifies the event, so the time gives way. The popover keeps
            its own times, it is wide enough -->
          <BaseCalendarEventChip
            v-for="{ event, slot, anchored } in cell.events"
            :key="event.id"
            :event="event"
            :anchored="anchored"
            :editing-id="editingId"
            show-time
            class="self-start mx-0.5 max-lg:**:data-time:hidden"
            :style="{ gridColumn: index + 1, gridRow: slot + 2 }"
            @update="forwardUpdate"
            @remove="forwardRemove"
            @open="forwardOpen"
            @close="forwardClose"
          >
            <template #meta="meta">
              <slot
                name="event-chip-meta"
                v-bind="meta"
              />
            </template>
            <template #event-form="form">
              <slot
                name="event-form"
                v-bind="form"
              />
            </template>
          </BaseCalendarEventChip>

          <UPopover
            v-if="cell.hidden > 0"
            :key="`more-${cell.day.getTime()}`"
            :content="{ side: 'right' }"
            :ui="{ content: 'flex flex-col gap-0.5 p-2 w-64' }"
          >
            <template #default="{ open }">
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                class="self-start mx-0.5 px-1.5 py-0.5 justify-start text-muted font-normal"
                :class="open && 'bg-elevated'"
                :style="{ gridColumn: index + 1, gridRow: cell.moreSlot + 2 }"
                :aria-label="t('moreAria', { count: cell.hidden })"
              >
                <span class="lg:hidden">{{ t('moreCount', { count: cell.hidden }) }}</span>
                <span class="hidden lg:inline">{{ t('more', { count: cell.hidden }) }}</span>
              </UButton>
            </template>

            <template #content>
              <BaseCalendarEventChip
                v-for="event in calendar.eventsForDay(cell.day)"
                :key="`more-${event.id}`"
                :event="event"
                :anchored="isSameDay(parseLocalDatetime(event.start), cell.day)"
                :editing-id="editingId"
                show-time
                @update="forwardUpdate"
                @remove="forwardRemove"
                @open="forwardOpen"
                @close="forwardClose"
              >
                <template #meta="meta">
                  <slot
                    name="event-chip-meta"
                    v-bind="meta"
                  />
                </template>
                <template #event-form="form">
                  <slot
                    name="event-form"
                    v-bind="form"
                  />
                </template>
              </BaseCalendarEventChip>
            </template>
          </UPopover>
        </template>
      </div>

    </UScrollArea>

    <!-- Under the labels so an incoming one slides over its blur, named for the
      same reason as the header: it has to sit above the grid snapshot during a
      view transition to keep blurring it. Its columns are the week rows': the
      grid scrolls and is a scrollbar narrower, so the band reserves that same
      gutter, or the weekdays drift right of the days below them -->
    <div class="absolute top-[calc(var(--ui-header-height)+0.5rem)] inset-x-0 z-30 h-10 grid grid-cols-7 glass-material bg-(--glass-bg) border-b border-default overflow-hidden [scrollbar-gutter:stable] [view-transition-name:weekdays]">
      <span
        v-for="(weekday, index) in weekdays"
        :key="weekday"
        class="flex items-center justify-end pe-2 text-sm text-muted border-default"
        :class="index !== 0 && 'border-s'"
      >
        {{ weekday }}
      </span>
    </div>

    <!-- The docked month, from the header title spot (the overlay top, also its
      clip line) down over the grid. Quick to come back once the grid moves,
      slower on the way out. Docked, it lands on the header title, so it starts
      where the title does: past the menu button and its gap below `lg`, on the
      header padding above -->
    <div
      class="absolute inset-x-0 bottom-0 z-40 overflow-hidden pointer-events-none transition-opacity"
      :class="monthLabelsVisible ? 'opacity-100 duration-150' : 'opacity-0 duration-300'"
      :style="{ top: `${DOCK_TOP}px` }"
    >
      <div class="absolute top-0 inset-s-13 lg:inset-s-4 flex items-center gap-1.5 h-8 text-xl sm:text-2xl tracking-tight">
        <span class="font-bold text-highlighted truncate">{{ title.months }}</span>
        <!-- Dropped where the header title drops it, or the docked one would hand
          a year over to a title that has none -->
        <span class="font-normal text-muted hidden sm:inline">{{ title.year }}</span>
      </div>
    </div>
  </div>
</template>

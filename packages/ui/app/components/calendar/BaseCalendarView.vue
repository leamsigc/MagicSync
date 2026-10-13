<script setup lang="ts">
/**
 *
 * Component Description: The calendar shell — header, sidebar and whichever of
 * the three grid views the route selects.
 *
 * The single entry point a page uses. It owns the two pieces of state the views
 * share — which event's form is open, and the range the cursor is warming — and
 * forwards every mutation upward, so persistence stays with the caller.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { CalendarEvent, CalendarView } from '#layers/BaseShared/shared/calendarTypes'
import type { DateRange } from '../../utils/calendarDates'
import type { UseCalendarEvents } from '../../composables/useCalendarEvents'

const props = defineProps<{
  /** The event pool: reads, bucketing, loading and the overlay mutations. */
  calendar: UseCalendarEvents
}>()

const emit = defineEmits<{
  commit: [event: CalendarEvent, start: Date]
  update: [event: CalendarEvent]
  remove: [event: CalendarEvent]
  'toggle-calendar': [id: string]
  /** An empty slot was clicked: the caller opens the create modal at this instant. */
  drill: [date: Date]
}>()

const { view, date, pathFor } = useCalendarRange()

// `props.calendar` already carries refs — `toRefs` on a plain object would wrap
// them a second time and hand Ref objects to array props, so derive instead
const calendars = computed(() => props.calendar.calendars.value)
const hiddenCalendars = computed(() => props.calendar.hiddenCalendars.value)

// Held by the shell so a redraw while a form is open does not take it down, and
// so only one event is ever editing at a time
const editingId = ref('')

function onViewChange(next: CalendarView) {
  navigateTo(pathFor(date.value, next))
}

function onOpen(id: string) {
  editingId.value = id
}

function onClose() {
  editingId.value = ''
}

function onCommit(event: CalendarEvent, start: Date) {
  emit('commit', event, start)
}

function onUpdate(event: CalendarEvent) {
  emit('update', event)
}

function onRemove(event: CalendarEvent) {
  emit('remove', event)
}

function onDrill(target: Date) {
  emit('drill', target)
}

function onToggleCalendar(id: string) {
  props.calendar.toggleCalendar(id)
  emit('toggle-calendar', id)
}

function onHoverRange(range: DateRange) {
  props.calendar.warmRange(range)
}
</script>

<template>
  <div class="relative flex-1 flex flex-col overflow-hidden">
    <BaseCalendarHeader @view-change="onViewChange">
      <template #leading>
        <slot name="leading" />
      </template>

      <template #filters>
        <slot name="filters" />
      </template>

      <template #create>
        <slot name="create" />
      </template>
    </BaseCalendarHeader>

    <!-- The sidebar rides in the content row, not as a floating drawer: the page
      already has the dashboard's own sidebar, and a second fixed one lands on
      top of it -->
    <div class="flex min-h-0 flex-1">
      <BaseCalendarSidebar :calendars="calendars" :hidden-calendars="hiddenCalendars"
        @toggle-calendar="onToggleCalendar" @hover-range="onHoverRange">
        <template #header>
          <slot name="sidebar-header" />
        </template>

        <template #calendar-list>
          <slot name="calendar-list">
            <BaseCalendarList :calendars="calendars" :hidden-calendars="hiddenCalendars"
              @toggle-calendar="onToggleCalendar" />
          </slot>
        </template>

        <template #footer>
          <slot name="sidebar-footer" />
        </template>
      </BaseCalendarSidebar>

      <!-- The view transition name lives on each view's scroller: naming this
        wrapper would create a stacking context and keep the month labels from
        painting above the translucent header -->
      <div class="flex min-h-0 flex-1 flex-col">
        <BaseCalendarMonthView v-if="view === 'month'" :calendar="calendar" :editing-id="editingId" @commit="onCommit"
          @update="onUpdate" @remove="onRemove" @open="onOpen" @close="onClose" @drill="onDrill">
          <template #event-chip-meta="meta">
            <slot name="event-chip-meta" v-bind="meta" />
          </template>
          <template #event-form="form">
            <slot name="event-form" v-bind="form" />
          </template>
        </BaseCalendarMonthView>

        <!-- The timed views swap their event block through `#event-block`: the
          grid keeps the geometry, the drag and the popover, and the call site
          supplies the row a post needs inside it. The month grid renders chips
          off the event title, which a post already carries, so nothing is swapped
          there -->
        <BaseCalendarWeekView v-else-if="view === 'week'" :calendar="calendar" :editing-id="editingId"
          @commit="onCommit" @update="onUpdate" @remove="onRemove" @open="onOpen" @close="onClose" @drill="onDrill">
          <template #event-form="form">
            <slot name="event-form" v-bind="form" />
          </template>

          <!-- `openEvent`/`closeEvent` travel down as slot props so the call
            site's own block can drive the shared editing id: it renders the
            block, so only it hears the block's `open`/`close` emits -->
          <template #event-block="block">
            <slot name="event-block" v-bind="block" :open-event="onOpen" :close-event="onClose" />
          </template>
        </BaseCalendarWeekView>

        <BaseCalendarDayView v-else :calendar="calendar" :editing-id="editingId" @commit="onCommit" @update="onUpdate"
          @remove="onRemove" @open="onOpen" @close="onClose" @drill="onDrill">
          <template #event-form="form">
            <slot name="event-form" v-bind="form" />
          </template>

          <template #event-block="block">
            <slot name="event-block" v-bind="block" :open-event="onOpen" :close-event="onClose" />
          </template>
        </BaseCalendarDayView>
      </div>
    </div>
  </div>
</template>

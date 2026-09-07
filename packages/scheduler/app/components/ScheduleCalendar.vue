<script lang="ts" setup>
/**
 *
 *
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.2
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 *
 * NOTE: Uses @fullcalendar/core's Calendar class directly instead of the
 * @fullcalendar/vue3 wrapper. The wrapper's instance state (data().customRenderingMap)
 * fails to initialize under Nuxt 4 dev ("accessed during render but is not defined
 * on instance" → "this.customRenderingMap is undefined"), and its template-ref
 * getApi() does not resolve ("getApi is not a function"). Driving Calendar
 * imperatively avoids both failure modes.
 */
import { Calendar } from "@fullcalendar/core";
import type {
  CalendarOptions,
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventInput,
  EventSourceInput,
  EventWillUnmountArg,
} from "@fullcalendar/core";
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import { createVNode, getCurrentInstance, render, type VNode } from "vue";
import type { PostWithAllData } from "#layers/BaseDB/db/schema";
import PostCalendarPreview from "./PostCalendarPreview.vue";
import dayjs from "dayjs";

interface Props {
  activeView?: "timeGridWeek" | 'timeGridDay' | "dayGridMonth"
  events: Array<EventInput & {
    extendedProps: {
      post: PostWithAllData
    }
  }>
}

const props = withDefaults(defineProps<Props>(), {
  activeView: "dayGridMonth",
  events: () => []
});
const { activeView, events } = toRefs(props)

const calendarEl = ref<HTMLDivElement | null>(null)
const appContext = getCurrentInstance()?.appContext ?? null

let calendar: Calendar | null = null
const eventViews = new Map<string, VNode>()

const $emit = defineEmits({
  'date-clicked': (event: DateClickArg) => true,
  'event-clicked': (event: EventClickArg) => true,
  'time-frame-change': (event: { start: string, end: string }) => true
})

const { locale } = useI18n()

function handleDatesSet(arg: DatesSetArg) {
  $emit('time-frame-change', { start: arg.startStr, end: arg.endStr })
}

function eventKey(event: { id: string; title: string; startStr: string }): string {
  return event.id || `${event.startStr}-${event.title}`
}

// Render the Vue preview inside FullCalendar's vanilla DOM container.
// Assigning the host app context gives the vnode access to globally
// registered components (UButton, UPopover, Icon, ...).
function renderEventContent(arg: EventContentArg) {
  const host = document.createElement('div')
  if (appContext) {
    const vnode = createVNode(PostCalendarPreview, { post: arg.event.extendedProps.post })
    vnode.appContext = appContext
    render(vnode, host)
    eventViews.set(eventKey(arg.event), vnode)
  }
  else {
    host.textContent = arg.event.title
  }
  return { domNodes: Array.from(host.childNodes) }
}

function unmountEventContent(arg: EventWillUnmountArg) {
  const key = eventKey(arg.event)
  const vnode = eventViews.get(key)
  if (vnode?.el) {
    render(null, vnode.el as Element)
    eventViews.delete(key)
  }
}

function createCalendarOptions(): CalendarOptions {
  return {
    plugins: [timeGridPlugin, interactionPlugin, dayGridPlugin],
    initialView: props.activeView,
    editable: false,
    nowIndicator: true,
    locale: locale.value,
    expandRows: false,
    eventOverlap: false,
    selectAllow(selectInfo) {
      return dayjs().diff(selectInfo.start) <= 0
    },

    dayMaxEvents: 1,
    moreLinkText: "Posts",
    moreLinkHint: "show more",
    dateClick(arg: DateClickArg) {
      $emit('date-clicked', arg)
    },
    eventClick(arg: EventClickArg) {
      $emit('event-clicked', arg)
    },
    datesSet: handleDatesSet,
    eventContent: renderEventContent,
    eventWillUnmount: unmountEventContent,
    stickyHeaderDates: true,
    headerToolbar: {
      left: "prevYear,prev,today,next,nextYear",
      center: "title",
      right: "timeGridDay,timeGridWeek,dayGridMonth",
    },
    views: {
      dayGrid: {
        // options apply to dayGridMonth, dayGridWeek, and dayGridDay views
        dayMaxEvents: 1,
        dayMaxEventRows: 1,
      },
    },
    events: props.events as EventSourceInput,
  }
}

watch(events, (newEvents) => {
  if (!calendar) return
  calendar.removeAllEvents()
  if (newEvents.length > 0) {
    calendar.addEventSource(newEvents as EventSourceInput)
  }
})

watch(activeView, (nextView) => {
  calendar?.changeView(nextView)
})

watch(locale, (nextLocale) => {
  calendar?.setOption('locale', nextLocale)
})

function initCalendar() {
  if (!calendarEl.value || calendar) return
  calendar = new Calendar(calendarEl.value, createCalendarOptions())
  calendar.render()
}

// NB: init in a watcher on the element, not only onMounted. <ClientOnly>
// swaps its placeholder for the real div AFTER this component's onMounted
// fires, so calendarEl is still null there. The watcher runs when the div
// actually mounts; onMounted covers the non-deferred case. Both are guarded.
onMounted(initCalendar)
watch(calendarEl, initCalendar)

onBeforeUnmount(() => {
  calendar?.destroy()
  calendar = null
  eventViews.forEach((vnode) => {
    if (vnode.el) render(null, vnode.el as Element)
  })
  eventViews.clear()
})
</script>
<template>
  <ClientOnly>
    <div ref="calendarEl" class="min-h-[600px]" />
  </ClientOnly>
</template>

<style></style>

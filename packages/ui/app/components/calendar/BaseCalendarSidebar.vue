<!--  Translation file -->
<i18n src="./BaseCalendarSidebar.json"></i18n>
<script setup lang="ts">
/**
 *
 * Component Description: The calendar sidebar — header slot, the selectable
 * calendar list, the mini month calendar and a footer slot.
 *
 * Floats over the grid, cut from the same glass the header is, so it reads as
 * the floating band sliding in rather than a sheet of its own. Below `lg` it
 * becomes a slideover, and any route change closes it again.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { Calendar } from '#layers/BaseShared/shared/calendarTypes'
import type { DateRange } from '../../utils/calendarDates'

const { t } = useI18n()

withDefaults(defineProps<{
  calendars: Calendar[]
  /** Ids of the calendars whose events are hidden. */
  hiddenCalendars?: string[]
}>(), { hiddenCalendars: () => [] })

const emit = defineEmits<{
  'toggle-calendar': [id: string]
  'hover-range': [range: DateRange]
}>()

const { isSidebarOpen } = useCalendarRange()

const route = useRoute()

// Same query the sidebar switches on. Closing is only right below it: above, the
// model drives the desktop collapse instead
const isMobile = useMediaQuery('(max-width: 1023px)')

// Everything the menu offers takes over the screen on a phone, so it steps out
// of the way once one of them is on its way in
watch(() => route.fullPath, () => {
  if (isMobile.value) {
    isSidebarOpen.value = false
  }
})

// A phone starts shut; a desktop resize back up reopens — the menu button that
// opens it only renders below `lg`, so a shut sidebar on desktop would strand
onMounted(() => {
  if (isMobile.value) {
    isSidebarOpen.value = false
  }
})

watch(isMobile, (mobile) => {
  if (!mobile) {
    isSidebarOpen.value = true
  }
})

function onToggleCalendar(id: string) {
  emit('toggle-calendar', id)
}

function onHoverRange(range: DateRange) {
  emit('hover-range', range)
}

function closeSidebar() {
  isSidebarOpen.value = false
}
</script>

<template>
  <!-- In the content row, never as a floating drawer: the page already owns the
    dashboard's sidebar, and a second fixed panel lands on top of it. Full height
    with its own top padding so it starts below the absolute calendar header.
    Below `lg` it is the same panel as a slideover the header's menu button
    opens -->
  <aside v-show="isSidebarOpen"
    class="flex min-h-0 flex-col gap-1 overflow-y-auto border-e border-default bg-elevated/30 px-2 pt-[calc(var(--ui-header-height)+0.5rem)]"
    :class="isMobile ? 'fixed inset-y-0 left-0 z-50 w-72 shadow-2xl' : 'relative w-60 shrink-0 xl:w-64'">
    <div class="flex items-center gap-1 px-1 pt-1">
      <slot name="header">
        <span class="text-xl font-bold text-highlighted">{{ t('brand') }}</span>
      </slot>

      <div class="ms-auto flex items-center">
        <UButton icon="i-lucide-x" color="neutral" variant="soft" size="sm" :aria-label="t('closeMenu')"
          class="lg:hidden rounded-full" @click="closeSidebar" />
      </div>
    </div>

    <slot name="calendar-list">
      <BaseCalendarList :calendars="calendars" :hidden-calendars="hiddenCalendars"
        @toggle-calendar="onToggleCalendar" />
    </slot>

    <USeparator class="mt-auto" />

    <BaseCalendarMini @hover-range="onHoverRange" />

    <slot name="footer" />
  </aside>
</template>

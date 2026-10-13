<!--  Translation file -->
<i18n src="./BaseCalendarHeader.json"></i18n>
<script setup lang="ts">
/**
 *
 * Component Description: The calendar page header — view switcher, range title,
 * Today and prev/next navigation.
 *
 * Floats over the views so their content scrolls behind the blur. The month view
 * slides its own copy of the range title over the top while it scrolls, docking
 * it right here, so this one steps aside for as long as they are up.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { TabsItem } from '@nuxt/ui'
import type { CalendarView } from '#layers/BaseShared/shared/calendarTypes'

const { t } = useI18n()

const emit = defineEmits<{
  'view-change': [view: CalendarView]
}>()

const { view, date, title, monthLabelsVisible, prevDate, nextDate, pathFor, setDirection, isSidebarOpen } = useCalendarRange()

const views = computed<TabsItem[]>(() => [
  { label: t('day'), value: 'day' },
  { label: t('week'), value: 'week' },
  { label: t('month'), value: 'month' }
])

function onViewChange(value: string | number) {
  emit('view-change', value as CalendarView)
}

function goPrevious() {
  setDirection('left')
  navigateTo(pathFor(prevDate.value))
}

function goNext() {
  setDirection('right')
  navigateTo(pathFor(nextDate.value))
}

function openSidebar() {
  isSidebarOpen.value = true
}
</script>

<template>
  <!-- Floating over the views so their content scrolls behind the blur, its own
    view transition name keeps it above the sliding grid snapshot (which is
    lifted into the transition overlay, out of reach of the blur) -->
  <header class="absolute top-0 pt-2 inset-x-0 z-10 flex items-center gap-2 sm:gap-4 h-[calc(var(--ui-header-height)+0.5rem)] px-4 border-b border-default glass-material [view-transition-name:header]">
    <!-- The tint rides its own layer so it can run solid at the top and dissolve
      towards the grid instead of ending on a line. Solid up there because rows
      scrolled past the viewport stop being sampled by the filter, and anything
      less than opaque shows their remains clipping mid-band. The blur itself
      stays uniform: masking it away anywhere just uncovers sharp content -->
    <div class="pointer-events-none absolute inset-0 -z-10 bg-(--glass-bg) bg-linear-to-b from-default from-40% to-transparent" />

    <!-- Its own gap rather than the header's, so the title starts at the same
      spot at every width the menu button shows at and the month view has a
      single offset to dock its labels on -->
    <div class="flex items-center gap-2 min-w-0 flex-1">
      <!-- Below `lg` the sidebar is a slideover, this is what opens it -->
      <UButton
        icon="i-lucide-menu"
        color="neutral"
        variant="soft"
        size="sm"
        :aria-label="t('openMenu')"
        class="lg:hidden shrink-0 rounded-full"
        @click="openSidebar"
      />

      <slot name="leading" />

      <!-- The month view slides its own copy of this title over the top while it
        scrolls, docking it right here, so this one steps aside for as long as
        they are up. Both sit at the same spot, and it steps aside without
        fading: two copies of the same text at half opacity each come out
        lighter than one at full, so a crossfade dips in the middle -->
      <h1
        class="flex items-baseline gap-1.5 text-xl sm:text-2xl tracking-tight min-w-0 flex-1 transition-opacity duration-0"
        :class="view === 'month' && monthLabelsVisible ? 'opacity-0 delay-150' : 'opacity-100'"
      >
        <span class="font-bold text-highlighted truncate">{{ title.months }}</span>
        <span class="font-normal text-muted hidden sm:inline">{{ title.year }}</span>
      </h1>
    </div>

    <slot name="filters" />

    <!-- Down to the initial below `md`, where the header cannot spare the width
      for the labels. The triggers give up their padding for it, three of them
      share 5rem there -->
    <UTabs
      :items="views"
      :content="false"
      :model-value="view"
      color="neutral"
      size="sm"
      class="mx-auto w-20 sm:w-42 lg:w-48"
      :ui="{ trigger: 'p-1 lg:p-1.5' }"
      @update:model-value="onViewChange"
    >
      <template #default="{ item }">
        <span class="sm:hidden">{{ item.label.charAt(0) }}</span>
        <span class="hidden sm:inline">{{ item.label }}</span>
      </template>
    </UTabs>

    <!-- Only the title grows below `md`, so the switcher and the controls stay
      together on the end rather than drifting apart -->
    <div class="flex items-center gap-2 md:flex-1 justify-end">
      <slot name="create" />

      <UTheme :props="{ button: { color: 'neutral', variant: 'soft', size: 'sm', class: 'rounded-full' } }">
        <div class="flex items-center gap-1">
          <UTooltip :text="t('previous')">
            <UButton
              icon="i-lucide-chevron-left"
              :aria-label="t('previous')"
              prefetch-on="interaction"
              :to="pathFor(prevDate)"
              @click="goPrevious"
            />
          </UTooltip>
          <UTooltip :text="t('today')">
            <UButton
              :label="t('today')"
              class="hidden sm:inline-flex rounded-full"
              prefetch-on="interaction"
              :to="pathFor(todayDate())"
            />
          </UTooltip>
          <UTooltip :text="t('next')">
            <UButton
              icon="i-lucide-chevron-right"
              :aria-label="t('next')"
              prefetch-on="interaction"
              :to="pathFor(nextDate)"
              @click="goNext"
            />
          </UTooltip>
        </div>
      </UTheme>
    </div>
  </header>
</template>

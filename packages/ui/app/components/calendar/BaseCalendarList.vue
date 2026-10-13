<!--  Translation file -->
<i18n src="./BaseCalendarList.json"></i18n>
<script setup lang="ts">
/**
 *
 * Component Description: The sidebar list of selectable calendars.
 *
 * Each row is a checkbox carrying the calendar's own color token, so the dot in
 * the list and the events in the grid can never disagree. The rows render as a
 * `div` since the navigation menu's link defaults to a `button`, which cannot
 * contain a checkbox.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { NavigationMenuItem } from '@nuxt/ui'
import type { Calendar } from '#layers/BaseShared/shared/calendarTypes'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  calendars: Calendar[]
  /** Ids of the calendars whose events are hidden. */
  hiddenCalendars?: string[]
  /** The label the group is filed under. */
  label?: string
}>(), { hiddenCalendars: () => [] })

const emit = defineEmits<{
  'toggle-calendar': [id: string]
}>()

const items = computed<NavigationMenuItem[]>(() => [
  { label: props.label ?? t('calendars'), type: 'label' },
  ...props.calendars.map(calendar => ({
    label: calendar.name,
    color: calendar.color,
    value: calendar.id,
    slot: 'calendar' as const,
    // Rendered as a `div` since the link defaults to a `button`, which cannot
    // contain the checkbox
    as: 'div' as const
  }))
])

function onToggle(id: string | undefined) {
  if (id) {
    emit('toggle-calendar', id)
  }
}
</script>

<template>
  <UNavigationMenu
    :items="items"
    orientation="vertical"
  >
    <template #calendar="{ item }">
      <UCheckbox
        :label="item.label"
        :color="item.color"
        :model-value="!hiddenCalendars.includes(item.value)"
        class="w-full"
        @update:model-value="onToggle(item.value)"
      />
    </template>
  </UNavigationMenu>
</template>

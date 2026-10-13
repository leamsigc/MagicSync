<!--  Translation file -->
<i18n src="./BusinessCalendarList.json"></i18n>
<script setup lang="ts">
/**
 *
 * Component Description: Sidebar list of the businesses the calendar draws events from.
 *
 * Deliberately thin: `BaseCalendarList` owns the rows, the colour dots and the
 * checkbox behaviour, and this component only feeds it the business list from
 * `useCalendarPosts`. Every business the caller can read shows up here exactly
 * once, with the same deterministic colour its events get in the grid.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

const { t } = useI18n()

const { calendars, hiddenBusinessIds, toggleBusiness } = useCalendarPosts()
</script>

<template>
  <BaseCalendarList
    :calendars="calendars"
    :hidden-calendars="hiddenBusinessIds"
    :label="t('businesses')"
    @toggle-calendar="toggleBusiness"
  />
</template>

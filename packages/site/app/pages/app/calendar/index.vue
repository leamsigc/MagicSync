<!--  Translation file -->
<i18n src="./calendar.json"></i18n>
<script lang="ts" setup>
import dayjs from 'dayjs'

/**
 *
 * Component Description: legacy calendar entry point.
 *
 * `/app/calendar` predates the seeded route, so it redirects to the month view of
 * today and the page that owns the grid takes over from there.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

navigateTo(`/app/calendar/month/${dayjs().format('YYYY-MM-DD')}`)
</script>

<template>
  <div />
</template>

<style></style>

<!--  Translation file -->
<i18n src="./calendar.json"></i18n>
<script lang="ts" setup>
import dayjs from 'dayjs'

/**
 *
 * Component Description: legacy month calendar page.
 *
 * Redirects to `/app/calendar/month/<today>`, the seeded route that now owns the
 * month grid. Kept so every link and bookmark that predates the new route still
 * lands on a working calendar.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

const localePath = useLocalePath()

navigateTo(localePath(`/app/calendar/month/${dayjs().format('YYYY-MM-DD')}`))
</script>

<template>
  <div />
</template>

<style></style>

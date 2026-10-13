<!--  Translation file -->
<i18n src="./calendar.json"></i18n>
<script lang="ts" setup>
import dayjs from 'dayjs'

/**
 *
 * Component Description: legacy week calendar page.
 *
 * Redirects to `/app/calendar/week/<today>`, the seeded route that now owns the
 * week grid. Note the path: the old page was named `weeks`, the route segment is
 * singular, so this is a real move rather than a rename in place.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

navigateTo(`/app/calendar/week/${dayjs().format('YYYY-MM-DD')}`)
</script>

<template>
  <div />
</template>

<style></style>

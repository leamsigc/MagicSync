<!--  Translation file -->
<i18n src="./calendar.json"></i18n>
<script lang="ts" setup>
import CalendarViewWrapper from './components/CalendarViewWrapper.vue';
import dayjs from 'dayjs';

/**
 *
 * Component Description: Month view calendar page.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

const startDate = dayjs().startOf('month').format('YYYY-MM-DD');
const endDate = dayjs().endOf('month').format('YYYY-MM-DD');
</script>
<template>
  <CalendarViewWrapper active-view="dayGridMonth" :start-date="startDate" :end-date="endDate" seo-end-label="month" />
</template>

<style></style>

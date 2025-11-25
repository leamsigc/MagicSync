<!--  Translation file -->
<i18n src="./calendar.json"></i18n>
<script lang="ts" setup>
import CalendarViewWrapper from './components/CalendarViewWrapper.vue';
import dayjs from 'dayjs';

/**
 *
 * Component Description: Week view calendar page.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

const startDate = dayjs().startOf('week').format('YYYY-MM-DD');
const endDate = dayjs().endOf('week').format('YYYY-MM-DD');
</script>
<template>
  <CalendarViewWrapper active-view="timeGridWeek" :start-date="startDate" :end-date="endDate" seo-end-label="week" />
</template>

<style></style>

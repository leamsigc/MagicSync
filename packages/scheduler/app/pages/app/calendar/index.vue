<!--  Translation file -->
<i18n src="./calendar.json"></i18n>
<script lang="ts" setup>
import dayjs from 'dayjs';
import CalendarViewWrapper from './components/CalendarViewWrapper.vue';

/**
 *
 * Component Description: Main calendar page, defaults to month view showing all posts.
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
  <CalendarViewWrapper seo-end-label="month" :start-date="startDate" :end-date="endDate" />
</template>

<style></style>

<!--  Translation file -->
<i18n src="./calendar.json"></i18n>
<script lang="ts" setup>
import CalendarViewWrapper from './components/CalendarViewWrapper.vue';
import dayjs from 'dayjs';

/**
 *
 * Component Description: Individual preview page for BaseBannerPromo component
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

const today = dayjs();
const startDate = today.format('YYYY-MM-DD');
const endDate = today.format('YYYY-MM-DD');
</script>
<template>
  <CalendarViewWrapper active-view="timeGridDay" :start-date="startDate" :end-date="endDate" seo-end-label="day" />
</template>

<style></style>

<!--  Translation file -->
<i18n src="./calendar.json"></i18n>
<script lang="ts" setup>
import CalendarViewWrapper from '#layers/BaseScheduler/app/components/scheduler/calendar/components/CalendarViewWrapper.vue';
import dayjs from 'dayjs';
import MicRecorder from '#layers/BaseTools/app/components/MicRecorder.vue'
import PostAIAssistant from '#layers/BaseTemplate/app/components/PostAIAssistant.vue'
import TemplateVariablePopUp from '#layers/BaseTemplate/app/components/TemplateVariablePopUp.vue'

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
  <CalendarViewWrapper
    active-view="timeGridDay"
    :start-date="startDate"
    :end-date="endDate"
    seo-end-label="day"
    show-platform-filter
    show-post-format-filter>
    <template #mic-recorder="{ onTranscript }">
      <MicRecorder @transcript="onTranscript" />
    </template>
    <template #template-variable="{ onAction }">
      <TemplateVariablePopUp @action="onAction" />
    </template>
    <template #ai-assistant="{ loading, onAction, onTemplateAction }">
      <PostAIAssistant :loading="loading" @action="onAction" @template-action="onTemplateAction" />
    </template>
  </CalendarViewWrapper>
</template>

<style></style>

<!--  Translation file -->
<i18n src="./calendar.json"></i18n>
<script lang="ts" setup>
import dayjs from 'dayjs';
import CalendarViewWrapper from '#layers/BaseScheduler/app/components/scheduler/calendar/components/CalendarViewWrapper.vue';
import MicRecorder from '#layers/BaseTools/app/components/MicRecorder.vue'
import PostAIAssistant from '#layers/BaseTemplate/app/components/PostAIAssistant.vue'
import TemplateVariablePopUp from '#layers/BaseTemplate/app/components/TemplateVariablePopUp.vue'

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
  <CalendarViewWrapper
    seo-end-label="month"
    :start-date="startDate"
    :end-date="endDate"
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

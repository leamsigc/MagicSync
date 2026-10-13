<!--  Translation file -->
<i18n src="../calendar.json"></i18n>
<script lang="ts" setup>
import { parseDate } from '@internationalized/date'
import type { CalendarView } from '#layers/BaseShared/shared/calendarTypes'
import { useCalendarRange } from '#layers/BaseUI/app/composables/useCalendarRange'
import MicRecorder from '#layers/BaseTools/app/components/MicRecorder.vue'
import PostAIAssistant from '#layers/BaseTemplate/app/components/PostAIAssistant.vue'
import PostCalendarShell from '#layers/BaseScheduler/app/components/scheduler/calendar/components/PostCalendarShell.vue'
import TemplateVariablePopUp from '#layers/BaseTemplate/app/components/TemplateVariablePopUp.vue'

/**
 *
 * Component Description: the calendar route — one page for all three views.
 *
 * `/app/calendar/[view]/[date]` is seeded and shareable: the view and the anchor
 * date are both read back off the route by `useCalendarRange`, so a link, a
 * reload or a prev/next navigation all land on the same grid. The four legacy
 * pages (`index`, `month`, `weeks`, `day`) redirect here, which is what keeps
 * every bookmarked link working.
 *
 * Everything above this line is the page's own two jobs: validate the params
 * before anything renders, and set the meta the old pages emitted.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */

const VALID_VIEWS: CalendarView[] = ['day', 'week', 'month']

function isCalendarView(value: unknown): value is CalendarView {
  return VALID_VIEWS.includes(value as CalendarView)
}

definePageMeta({
  // Date changes update the mounted view in place; the default key would remount
  // the page (and reset the month view's scroll) on every URL sync
  key: route => route.params.view as string,
  validate(route) {
    if (!isCalendarView(route.params.view)) {
      return false
    }

    try {
      parseDate(route.params.date as string)
      return true
    } catch {
      return false
    }
  },
  // The month view scrolls continuously, and a sliding view transition would
  // fight the scroll. Same-month to same-month is the only pair that hurts
  middleware: [
    (to, from) => {
      if (to.params.view === 'month' && from?.params.view === 'month') {
        to.meta.viewTransition = false
      }
    }
  ]
})

const { view } = useCalendarRange()

const { t } = useI18n()

// One `useHead` per view instead of three pages' worth: the range in the title
// is the view's own job, the words around it are the page's
useHead(() => ({
  title: t(`seo_title_${view.value}`),
  meta: [
    { name: 'description', content: t(`seo_description_${view.value}`) }
  ]
}))
</script>

<template>
  <PostCalendarShell>
    <template #mic-recorder="{ onTranscript }">
      <MicRecorder @transcript="onTranscript" />
    </template>
    <template #template-variable="{ onAction }">
      <TemplateVariablePopUp @action="onAction" />
    </template>
    <template #ai-assistant="{ loading, onAction, onTemplateAction }">
      <PostAIAssistant :loading="loading" @action="onAction" @template-action="onTemplateAction" />
    </template>
  </PostCalendarShell>
</template>

<style></style>

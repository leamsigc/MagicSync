<!--  Translation file -->
<i18n src="./calendar.json"></i18n>
<script lang="ts" setup>
import type { DateClickArg } from '@fullcalendar/interaction/index.js';
import SchedulerPageHeader from './components/SchedulerPageHeader.vue';
import type { EventClickArg } from '@fullcalendar/core/index.js';
import { usePostManager } from '../posts/composables/UsePostManager';
import UpdatePostModal from '../posts/components/UpdatePostModal.vue';
import NewCalendarPostModal from '../posts/components/NewCalendarPostModal.vue';
import dayjs from 'dayjs';
import type { PostWithAllData } from '#layers/BaseDB/db/schema';

/**
 *
 * Component Description:Individual preview page for BaseBannerPromo component
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */


const activeBusinessId = useState<string>('business:id');

const { getPosts, postList } = usePostManager();
const currentMonth = ref(dayjs().format('YYYY-MM'));
await getPosts(activeBusinessId.value, {
  limit: 100,
  page: 1,
  offset: 0,
}, {
  startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
  endDate: dayjs().endOf('month').format('YYYY-MM-DD')
});

const { t } = useI18n()
useHead({
  title: t('seo_title_month'),
  meta: [
    { name: 'description', content: t('seo_description_month') }
  ]
})
const toast = useToast()
const events = postList.value.map((post: PostWithAllData) => {
  return {
    post,
    id: post.id,
    title: post.content.slice(0, 50),
    date: post.scheduledAt,
    extendedProps: {
      post
    }
  }
})

const newPostModalRef = ref<InstanceType<typeof NewCalendarPostModal> | null>(null);

const HandleDateClicked = (event: DateClickArg) => {
  // Check if the date is in the pass show toast
  if (dayjs(event.dateStr).isBefore(dayjs().add(-1, 'day'))) {
    toast.add({
      title: 'Date disabled',
      description: `Please select a date in the future`,
      color: 'error',
    })
    return;
  }
  // Open new post modal and pass the date to the modal
  const date = new Date(event.dateStr);
  newPostModalRef.value?.openModal(date);

}

const updatePostModalRef = ref<InstanceType<typeof UpdatePostModal> | null>(null);

const HandleEventClicked = (event: EventClickArg) => {
  toast.add({
    title: 'event Clicked',
    description: ` Date clicked: ${event.event.title}`,
    color: 'success'
  })

  if (event.event.extendedProps?.post) {
    updatePostModalRef.value?.openModal(event.event.extendedProps.post);
  }
}
</script>
<template>
  <div class="container mx-auto py-6 space-y-6">
    <SchedulerPageHeader />
    <ScheduleCalendar :events="events" @date-clicked="HandleDateClicked" @event-clicked="HandleEventClicked" />
    <UpdatePostModal ref="updatePostModalRef" />
    <NewCalendarPostModal ref="newPostModalRef" />
  </div>
</template>

<style></style>

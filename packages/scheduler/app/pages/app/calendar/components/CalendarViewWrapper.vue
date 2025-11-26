<!--  Translation file -->
<i18n src="../calendar.json"></i18n>
<script lang="ts" setup>
import type { DateClickArg } from '@fullcalendar/interaction/index.js';
import SchedulerPageHeader from './SchedulerPageHeader.vue';
import type { EventClickArg } from '@fullcalendar/core/index.js';
import { usePostManager } from '../../posts/composables/UsePostManager';
import UpdatePostModal from '../../posts/components/UpdatePostModal.vue';
import NewCalendarPostModal from '../../posts/components/NewCalendarPostModal.vue';
import dayjs from 'dayjs';
import type { PostWithAllData } from '#layers/BaseDB/db/schema';

/**
 *
 * Component Description: Wrapper component for calendar views to abstract common logic.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

const props = defineProps<{
  activeView?: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';
  startDate?: string;
  endDate?: string;
  seoEndLabel: 'day' | 'week' | 'month' | 'all';
}>();

const { t } = useI18n()
useHead({
  title: t(`seo_title_${props.seoEndLabel}`),
  meta: [
    { name: 'description', content: t(`seo_description_${props.seoEndLabel}`) }
  ]
})

const toast = useToast()
const activeBusinessId = useState<string>('business:id');

const { getPosts, postList } = usePostManager();

// Fetch posts based on provided startDate and endDate
const HandleRefresh = async () => {
  await getPosts(activeBusinessId.value, {
    page: 1,
    limit: 100
  },
    {
      startDate: props.startDate,
      endDate: props.endDate
    }
  );
}

await HandleRefresh();

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
  const now = dayjs().format('YYYY-MM-DD');
  if (dayjs(event.date).isBefore(now)) {
    toast.add({
      title: `Date ${event.dateStr} disabled`,
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

  if (event.event.extendedProps?.post) {
    updatePostModalRef.value?.openModal(event.event.extendedProps.post);
  }
}
</script>
<template>
  <div class="container mx-auto py-6 space-y-6">
    <SchedulerPageHeader />
    <ScheduleCalendar :active-view="activeView" :events="events" @date-clicked="HandleDateClicked"
      @event-clicked="HandleEventClicked" />
    <UpdatePostModal ref="updatePostModalRef" @refresh="HandleRefresh" />
    <NewCalendarPostModal ref="newPostModalRef" @refresh="HandleRefresh" />
  </div>
</template>

<style></style>

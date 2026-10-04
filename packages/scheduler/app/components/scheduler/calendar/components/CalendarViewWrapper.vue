<!--  Translation file -->
<i18n src="#site/app/pages/app/calendar/calendar.json"></i18n>
<script lang="ts" setup>
import type { DateClickArg } from '@fullcalendar/interaction/index.js';
import SchedulerPageHeader from './SchedulerPageHeader.vue';
import PostFiltersBar from './PostFiltersBar.vue';
import type { EventClickArg } from '@fullcalendar/core/index.js';
import { usePostManager } from '#layers/BaseShared/app/composables/usePostManager';
import UpdatePostModal from '../../posts/components/UpdatePostModal.vue';
import NewCalendarPostModal from '../../posts/components/NewCalendarPostModal.vue';
import dayjs from 'dayjs';
import type { PostWithAllData } from '#layers/BaseDB/db/schema';
import type { PostFilters } from '#layers/BaseScheduler/server/utils/SchedulerTypes';

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
  showPlatformFilter?: boolean
  showPostFormatFilter?: boolean
}>();

const toast = useToast()
const activeBusinessId = useState<string>('business:id');

const { t, getPosts, postList } = usePostManager();
useHead({
  title: t(`seo_title_${props.seoEndLabel}`),
  meta: [
    { name: 'description', content: t(`seo_description_${props.seoEndLabel}`) }
  ]
})

// Fetch posts based on provided startDate and endDate
const startDate = ref(props.startDate);
const endDate = ref(props.endDate);

const handleFilterChange = async (filters: PostFilters & { page: number, limit: number }) => {
  await getPosts(
    activeBusinessId.value,
    { page: filters.page, limit: filters.limit },
    {
      status: filters.status,
      startDate: filters.startDate || startDate.value,
      endDate: filters.endDate || endDate.value,
      dateType: filters.dateType,
      postFormat: filters.postFormat,
      platforms: filters.platforms
    }
  )
}

const HandleRefresh = async () => {
  await getPosts(activeBusinessId.value, {
    page: 1,
    limit: 100
  },
    {
      startDate: startDate.value,
      endDate: endDate.value
    }
  );
}
HandleRefresh();

const events = computed(() => postList.value.map((post: PostWithAllData) => {
  return {
    post,
    id: post.id,
    title: post.content.slice(0, 50),
    date: post.scheduledAt,
    extendedProps: {
      post
    }
  }
}))

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
const handleDateChange = ({ start, end }: { start: string, end: string }) => {
  startDate.value = start;
  endDate.value = end;
}
</script>
<template>
  <div class=" p-4 lg:mx-auto lg:p-6">
    <SchedulerPageHeader>
      <template v-if="$slots['mic-recorder']" #mic-recorder="slotProps">
        <slot name="mic-recorder" v-bind="slotProps" />
      </template>
      <template v-if="$slots['template-variable']" #template-variable="slotProps">
        <slot name="template-variable" v-bind="slotProps" />
      </template>
      <template v-if="$slots['ai-assistant']" #ai-assistant="slotProps">
        <slot name="ai-assistant" v-bind="slotProps" />
      </template>
    </SchedulerPageHeader>
    <PostFiltersBar :show-platform-filter="showPlatformFilter" :show-post-format-filter="showPostFormatFilter"
      @filter-change="handleFilterChange" @refresh="HandleRefresh" />
    <ScheduleCalendar :active-view="activeView" :events="events" @date-clicked="HandleDateClicked"
      @event-clicked="HandleEventClicked" @time-frame-change="handleDateChange" />
    <UpdatePostModal ref="updatePostModalRef" @refresh="HandleRefresh">
      <template v-if="$slots['mic-recorder']" #mic-recorder="slotProps">
        <slot name="mic-recorder" v-bind="slotProps" />
      </template>
    </UpdatePostModal>
    <NewCalendarPostModal ref="newPostModalRef" @refresh="HandleRefresh">
      <template v-if="$slots['mic-recorder']" #mic-recorder="slotProps">
        <slot name="mic-recorder" v-bind="slotProps" />
      </template>
    </NewCalendarPostModal>
  </div>
</template>

<style></style>

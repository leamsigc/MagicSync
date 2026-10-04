<!--  Translation file -->
<i18n src="./posts.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Post previews
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import { ref } from 'vue';
import { usePostManager } from '#layers/BaseShared/app/composables/usePostManager';
import NewPostModal from '#layers/BaseScheduler/app/components/scheduler/posts/components/NewPostModal.vue';
import PostsGridView from '#layers/BaseScheduler/app/components/scheduler/posts/components/views/PostsGridView.vue';
import PostsBoardView from '#layers/BaseScheduler/app/components/scheduler/posts/components/views/PostsBoardView.vue';
import PostsTableView from '#layers/BaseScheduler/app/components/scheduler/posts/components/views/PostsTableView.vue';
import PostsFeedView from '#layers/BaseScheduler/app/components/scheduler/posts/components/views/PostsFeedView.vue';
import PostFiltersBar from "#layers/BaseScheduler/app/components/scheduler/calendar/components/PostFiltersBar.vue"
import type { PostFilters } from '#layers/BaseScheduler/server/utils/SchedulerTypes';
import dayjs from 'dayjs';
import MicRecorder from '#layers/BaseTools/app/components/MicRecorder.vue'
import PostAIAssistant from '#layers/BaseTemplate/app/components/PostAIAssistant.vue'
import TemplateVariablePopUp from '#layers/BaseTemplate/app/components/TemplateVariablePopUp.vue'

const activeBusinessId = useState<string>('business:id');
const { getPosts, postList, t } = usePostManager();
getPosts(activeBusinessId.value);

useHead({
  title: t('seo_title_all'),
  meta: [
    { name: 'description', content: t('seo_description_all') }
  ]
});

const currentView = ref<'Board' | 'Table' | 'Grid' | 'Feed'>('Grid');

// get filters from route

const startDate = ref(dayjs().startOf('month').format('YYYY-MM-DD'));
const endDate = ref(dayjs().endOf('month').format('YYYY-MM-DD'));
const handleFilterChange = async (filters: PostFilters & { page: number, limit: number }) => {
  startDate.value = filters.startDate || dayjs().startOf('month').format('YYYY-MM-DD');
  endDate.value = filters.endDate || dayjs().endOf('month').format('YYYY-MM-DD');
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
</script>

<template>
  <div class="mx-auto space-y-6">
    <BasePageHeader :title="t('title')" :description="t('description')">
      <template #actions>
        <div data-tour="create-new-post-step-0">
          <NewPostModal>
            <template #mic-recorder="{ onTranscript }">
              <MicRecorder @transcript="onTranscript" />
            </template>
            <template #template-variable="{ onAction }">
              <TemplateVariablePopUp @action="onAction" />
            </template>
            <template #ai-assistant="{ loading, onAction, onTemplateAction }">
              <PostAIAssistant :loading="loading" @action="onAction" @template-action="onTemplateAction" />
            </template>
          </NewPostModal>
        </div>
      </template>
    </BasePageHeader>
    <div class=" p-2 flex justify-between items-center ">
      <section class="flex gap-1" data-tour="posts-step-0">
        <PostFiltersBar @filter-change="handleFilterChange" @refresh="HandleRefresh" />
        <section data-tour="posts-step-1" class="flex gap-1">
          <UButton icon="i-lucide-grid-2x2" :variant="currentView === 'Grid' ? 'solid' : 'ghost'" size="sm"
            class="rounded-xl" @click="() => { currentView = 'Grid' }">
            Grid
          </UButton>
          <UButton icon="i-heroicons-bars-3-bottom-left" :variant="currentView === 'Feed' ? 'solid' : 'ghost'" size="sm"
            class="rounded-xl" @click="() => { currentView = 'Feed' }">
            Feed
          </UButton>
          <UButton icon="i-heroicons-squares-2x2" :variant="currentView === 'Board' ? 'solid' : 'ghost'" size="sm"
            class="rounded-xl" @click="() => { currentView = 'Board' }">
            Board
          </UButton>
          <UButton icon="i-heroicons-table-cells" :variant="currentView === 'Table' ? 'solid' : 'ghost'" size="sm"
            class="rounded-xl" @click="() => { currentView = 'Table' }">
            Table
          </UButton>
        </section>
      </section>

      <!-- <UMonthPicker v-model="monthDate" /> -->
    </div>

    <!-- List of all posts -->
    <PostsGridView v-if="currentView === 'Grid'" :posts="postList" />

    <PostsFeedView v-if="currentView === 'Feed'" :posts="postList" />

    <PostsBoardView v-if="currentView === 'Board'" :posts="postList" />

    <PostsTableView v-if="currentView === 'Table'" :posts="postList">
      <template #mic-recorder="{ onTranscript }">
        <MicRecorder @transcript="onTranscript" />
      </template>
    </PostsTableView>
  </div>
</template>
<style scoped></style>

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
import { ref, computed } from 'vue';
import { usePostManager } from './composables/UsePostManager';
import NewPostModal from './components/NewPostModal.vue';
import PostsGridView from './components/views/PostsGridView.vue';
import PostsBoardView from './components/views/PostsBoardView.vue';
import PostsTableView from './components/views/PostsTableView.vue';
import PostFiltersBar from "../calendar/components/PostFiltersBar.vue"
import type { PostFilters } from '#layers/BaseScheduler/server/utils/SchedulerTypes';
import dayjs from 'dayjs';

const activeBusinessId = useState<string>('business:id');
const { getPosts, postList, t } = usePostManager();
getPosts(activeBusinessId.value);

useHead({
  title: t('seo_title_all'),
  meta: [
    { name: 'description', content: t('seo_description_all') }
  ]
});

const currentView = ref<'Board' | 'Table' | 'Grid'>('Grid');

// get filters from route

const startDate = ref(dayjs().startOf('month').format('YYYY-MM-DD'));
const endDate = ref(dayjs().endOf('month').format('YYYY-MM-DD'));
const handleFilterChange = async (filters: PostFilters & { page: number, limit: number }) => {
  startDate.value = filters.startDate ||  dayjs().startOf('month').format('YYYY-MM-DD');
  endDate.value = filters.endDate ||  dayjs().endOf('month').format('YYYY-MM-DD');
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
        <NewPostModal />
      </template>
    </BasePageHeader>
    <div class=" p-2 flex justify-between items-center ">
      <section class="flex gap-1">
        <PostFiltersBar  @filter-change="handleFilterChange"
      @refresh="HandleRefresh"/>
        <section>
          <UButton icon="i-heroicons-squares-2x2" :variant="currentView === 'Board' ? 'solid' : 'ghost'" size="sm"
          @click="() => {currentView = 'Board'}" class="rounded-xl">Board</UButton>
          <UButton icon="i-heroicons-table-cells" :variant="currentView === 'Table' ? 'solid' : 'ghost'" size="sm"
          @click="() => {currentView = 'Table'}" class="rounded-xl">Table</UButton>
          <UButton icon="lucide:grid" :variant="currentView === 'Grid' ? 'solid' : 'ghost'" size="sm"
          @click="() => {currentView = 'Grid'}" class="rounded-xl">
          Grid
        </UButton>
      </section>
      </section>

      <!-- <UMonthPicker v-model="monthDate" /> -->
    </div>

    <!-- List of all posts -->
    <PostsGridView v-if="currentView === 'Grid'" :posts="postList" />

    <PostsBoardView v-if="currentView === 'Board'" :posts="postList" />

    <PostsTableView v-if="currentView === 'Table'" :posts="postList" />
  </div>
</template>
<style scoped></style>

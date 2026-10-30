<!--  Translation file -->
<i18n src="./posts.json"></i18n>

<script lang="ts" setup>
/**
 * Posts — one collection shell over five views.
 *
 * Grid, List, Table, Feed and Board read the same `postList` from
 * `usePostManager`; `BaseCollectionToolbar` adds search + the view switcher and
 * the existing `PostFiltersBar` keeps the server-side filters (status, platform,
 * format, dates, page size).
 */
import { usePostManager } from '#layers/BaseShared/app/composables/usePostManager'
import type { PostWithAllData } from '#layers/BaseDB/db/schema'
import type { CollectionViewOption } from '#layers/BaseUI/app/utils/collection'
import { useCollectionView } from '#layers/BaseUI/app/composables/useCollectionView'
import NewPostModal from '#layers/BaseScheduler/app/components/scheduler/posts/components/NewPostModal.vue'
import PostsGridView from '#layers/BaseScheduler/app/components/scheduler/posts/components/views/PostsGridView.vue'
import PostsListView from '#layers/BaseScheduler/app/components/scheduler/posts/components/views/PostsListView.vue'
import PostsBoardView from '#layers/BaseScheduler/app/components/scheduler/posts/components/views/PostsBoardView.vue'
import PostsTableView from '#layers/BaseScheduler/app/components/scheduler/posts/components/views/PostsTableView.vue'
import PostsFeedView from '#layers/BaseScheduler/app/components/scheduler/posts/components/views/PostsFeedView.vue'
import PostFiltersBar from '#layers/BaseScheduler/app/components/scheduler/calendar/components/PostFiltersBar.vue'
import type { PostFilters } from '#layers/BaseScheduler/server/utils/SchedulerTypes'
import dayjs from 'dayjs'
import MicRecorder from '#layers/BaseTools/app/components/MicRecorder.vue'
import PostAIAssistant from '#layers/BaseTemplate/app/components/PostAIAssistant.vue'
import TemplateVariablePopUp from '#layers/BaseTemplate/app/components/TemplateVariablePopUp.vue'

type PostsView = 'Feed' | 'Grid' | 'List' | 'Table' | 'Board'

const activeBusinessId = useState<string>('business:id')
const { getPosts, postList, t } = usePostManager()

// Same request the filter bar issues on mount (current month, default
// `scheduledAt`, 25 rows), so the two collapse into one in-flight request on
// client-side navigation instead of racing.
getPosts(activeBusinessId.value, { page: 1, limit: 25 }, {
  startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
  endDate: dayjs().endOf('month').format('YYYY-MM-DD'),
  dateType: 'scheduledAt',
})

useSeoMeta({
  title: t('seo_title_all'),
  description: t('seo_description_all'),
})

const startDate = ref(dayjs().startOf('month').format('YYYY-MM-DD'))
const endDate = ref(dayjs().endOf('month').format('YYYY-MM-DD'))

const {
  view,
  setView,
  search,
  setSearch,
  filtered,
} = useCollectionView<PostWithAllData>({
  key: 'app-posts',
  modes: ['Feed', 'Grid', 'List', 'Table', 'Board'] satisfies PostsView[],
  defaultView: 'Feed',
  rows: postList,
  searchFields: post => [
    post.content,
    post.user?.name,
    ...(post.platformPosts ?? []).map(platform => platform.platformPostId),
  ],
})

const viewOptions = computed<CollectionViewOption[]>(() => [
  { value: 'Grid', label: t('views.grid'), icon: 'i-lucide-grid-2x2' },
  { value: 'List', label: t('views.list'), icon: 'i-lucide-list' },
  { value: 'Table', label: t('views.table'), icon: 'i-lucide-table' },
  { value: 'Feed', label: t('views.feed'), icon: 'i-heroicons-bars-3-bottom-left' },
  { value: 'Board', label: t('views.board'), icon: 'i-heroicons-squares-2x2' },
])

const filteredPosts = computed(() => filtered.value)

function setPostsView(next: string) {
  setView(next as PostsView)
}

async function handleFilterChange(filters: PostFilters & { page: number, limit: number }) {
  startDate.value = filters.startDate || dayjs().startOf('month').format('YYYY-MM-DD')
  endDate.value = filters.endDate || dayjs().endOf('month').format('YYYY-MM-DD')
  await getPosts(
    activeBusinessId.value,
    { page: filters.page, limit: filters.limit },
    {
      status: filters.status,
      startDate: filters.startDate || startDate.value,
      endDate: filters.endDate || endDate.value,
      dateType: filters.dateType,
      postFormat: filters.postFormat,
      platforms: filters.platforms,
    },
  )
}

// Same as the calendar: the list is business-scoped, so reload it on switch.
watch(activeBusinessId, () => {
  getPosts(activeBusinessId.value, { page: 1, limit: 100 }, {
    startDate: startDate.value,
    endDate: endDate.value,
  })
})
</script>

<template>
  <BaseCollectionPage :title="t('title')" :description="t('description')">
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

    <template #toolbar>
      <div class="space-y-3">
        <BaseCollectionToolbar
          :search="search"
          :search-placeholder="t('searchPlaceholder')"
          :view="view"
          :views="viewOptions"
          @update:search="setSearch"
          @update:view="setPostsView"
        />
        <div data-tour="posts-step-0">
          <PostFiltersBar @filter-change="handleFilterChange" />
        </div>
      </div>
    </template>

    <section data-tour="posts-step-1">
      <BaseCollectionEmpty
        v-if="filteredPosts.length === 0"
        icon="i-lucide-file-text"
        :title="t('list.emptyTitle')"
        :hint="t('list.emptyHint')"
      />
      <PostsGridView v-else-if="view === 'Grid'" :posts="filteredPosts" />
      <PostsListView v-else-if="view === 'List'" :posts="filteredPosts" />
      <PostsTableView v-else-if="view === 'Table'" :posts="filteredPosts">
        <template #mic-recorder="{ onTranscript }">
          <MicRecorder @transcript="onTranscript" />
        </template>
      </PostsTableView>
      <PostsFeedView v-else-if="view === 'Feed'" :posts="filteredPosts" />
      <PostsBoardView v-else :posts="filteredPosts" />
    </section>
  </BaseCollectionPage>
</template>

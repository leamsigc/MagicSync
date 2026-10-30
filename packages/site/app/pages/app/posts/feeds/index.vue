<!--  Translation file -->
<i18n src="../posts.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Component Description: Post feeds page — the business-scoped post stream.
 *
 * The page keeps its paginated request and infinite scroll; only the surface
 * moved to the shared collection shell: one toolbar (search / status / sort /
 * view) and two declared views, List (the X-style feed cards) and Table.
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.2
 */
import { usePostManager } from '#layers/BaseShared/app/composables/usePostManager';
import type { PostWithAllData } from '#layers/BaseDB/db/schema';
import type { PaginatedResponse } from '#layers/BaseDB/server/services/types';
import type { CollectionTableColumn } from '#layers/BaseUI/app/utils/collection';
import { useCollectionView } from '#layers/BaseUI/app/composables/useCollectionView';
import { usePlatformIcons, type SocialMediaPlatform } from '#layers/BaseUI/app/composables/usePlatformIcons';
import TwitterPostEditor from '#layers/BaseScheduler/app/components/scheduler/posts/components/TwitterPostEditor.vue';
import PostFeedCard from '#layers/BaseScheduler/app/components/scheduler/posts/components/PostFeedCard.vue';
import MicRecorder from '#layers/BaseTools/app/components/MicRecorder.vue'
import PostAIAssistant from '#layers/BaseTemplate/app/components/PostAIAssistant.vue'
import TemplateVariablePopUp from '#layers/BaseTemplate/app/components/TemplateVariablePopUp.vue'
import dayjs from 'dayjs'

type FeedView = 'list' | 'table'
type FeedStatusTone = 'success' | 'warning' | 'error' | 'neutral'

const STATUS_LABEL_KEYS: Record<string, string> = {
  draft: 'feeds.filter.draft',
  pending: 'feeds.filter.pending',
  published: 'feeds.filter.published',
  failed: 'feeds.filter.failed',
}

const STATUS_TONES: Record<string, FeedStatusTone> = {
  draft: 'neutral',
  pending: 'warning',
  published: 'success',
  failed: 'error',
}

const activeBusinessId = useState<string>('business:id');
const { t } = usePostManager();
const router = useRouter();
const toast = useToast();
const { getPlatformIcon } = usePlatformIcons();
setPageLayout('auth-twitter-layout')

const currentPage = ref(1)
const totalPages = ref(1)
const posts = ref<PostWithAllData[]>([])
const isLoading = ref(false)
const sentinelRef = ref<HTMLDivElement | null>(null)
const hasMore = computed(() => currentPage.value < totalPages.value)
let observer: IntersectionObserver | null = null

const fetchPosts = async (page: number, append = false) => {
  if (isLoading.value) return

  isLoading.value = true

  try {
    const businessId = activeBusinessId.value
    const query = new URLSearchParams({
      businessId,
      page: page.toString(),
      limit: '10'
    })

    const response = await $fetch<PaginatedResponse<PostWithAllData>>(`/api/v1/posts?${query}`)

    // The request was built for a previous business: a switch happened while
    // it was in flight, so discard it instead of showing stale rows.
    if (businessId !== activeBusinessId.value) return

    if (response?.data) {
      if (append) {
        posts.value.push(...response.data)
      } else {
        posts.value = response.data
      }

      if (response.pagination) {
        totalPages.value = response.pagination.totalPages
        currentPage.value = response.pagination.page
      }
    }
  } catch (err) {
    log.error({ message: 'Failed to fetch posts', error: String(err) })
    toast.add({ title: t('feeds.loadError'), color: 'error' })
  } finally {
    isLoading.value = false

  }
}

const loadMore = async () => {
  if (!hasMore.value || isLoading.value) return
  await fetchPosts(currentPage.value + 1, true)
}

const {
  view,
  setView,
  search,
  setSearch,
  filters,
  setFilter,
  sort,
  setSort,
  filtered,
  hasActiveFilters,
  resetFilters,
} = useCollectionView<PostWithAllData>({
  key: 'app-posts-feeds',
  modes: ['list', 'table'] satisfies FeedView[],
  defaultView: 'list',
  rows: posts,
  searchFields: post => [
    post.content,
    post.user?.name,
    post.user?.firstName,
    ...(post.platformPosts ?? []).map(platform => platform.platformPostId),
  ],
  filterFns: {
    status: (post, value) => post.status === value,
  },
  sorters: {
    recent: (a, b) => new Date(b.scheduledAt ?? b.createdAt).getTime() - new Date(a.scheduledAt ?? a.createdAt).getTime(),
    oldest: (a, b) => new Date(a.scheduledAt ?? a.createdAt).getTime() - new Date(b.scheduledAt ?? b.createdAt).getTime(),
  },
  initialSort: 'recent',
})

const statusOptions = computed(() => [
  { value: 'all', label: t('feeds.filter.all') },
  { value: 'pending', label: t('feeds.filter.pending') },
  { value: 'published', label: t('feeds.filter.published') },
  { value: 'failed', label: t('feeds.filter.failed') },
  { value: 'draft', label: t('feeds.filter.draft') },
])

const sortOptions = computed(() => [
  { value: 'recent', label: t('feeds.sort.recent') },
  { value: 'oldest', label: t('feeds.sort.oldest') },
])

const viewOptions = computed(() => [
  { value: 'list', label: t('feeds.views.list'), icon: 'i-lucide-list' },
  { value: 'table', label: t('feeds.views.table'), icon: 'i-lucide-table' },
])

const toolbarFilters = computed(() => [
  {
    key: 'status',
    label: t('feeds.allStatuses'),
    value: filters.value.status || 'all',
    options: statusOptions.value,
    width: 'w-full sm:w-44',
  },
])

const toolbarSort = computed(() => ({ value: sort.value, options: sortOptions.value }))

const columns = computed<CollectionTableColumn[]>(() => [
  { key: 'content', label: t('feeds.columns.content') },
  { key: 'author', label: t('feeds.columns.author'), hideBelow: 'md' },
  { key: 'status', label: t('feeds.columns.status') },
  { key: 'platforms', label: t('feeds.columns.platforms'), hideBelow: 'lg' },
  { key: 'scheduled', label: t('feeds.columns.scheduled'), hideBelow: 'sm' },
])

const emptyTitle = computed(() =>
  hasActiveFilters.value ? t('feeds.emptyFiltered') : t('feeds.emptyNone')
)

const emptyHint = computed(() =>
  hasActiveFilters.value ? t('feeds.emptyFilteredHint') : t('feeds.emptyHint')
)

function statusTone(status?: string | null): FeedStatusTone {
  if (!status) return 'neutral'
  return STATUS_TONES[status] ?? 'neutral'
}

function statusLabel(status?: string | null): string {
  const key = status ? STATUS_LABEL_KEYS[status] : undefined
  return key ? t(key) : (status ?? '')
}

function formatDate(value?: Date | string | null): string {
  return value ? dayjs(value).format('MMM D, YYYY h:mm A') : ''
}

function platformIcon(id?: string | null): string {
  return getPlatformIcon((id || 'facebook') as SocialMediaPlatform)
}

function mediaCount(post: PostWithAllData): number {
  return post.assets?.length ?? 0
}

function feedRowKey(post: PostWithAllData): string {
  return post.id
}

function openPost(post: PostWithAllData) {
  router.push(`/app/posts/feeds/${post.id}`)
}

function handleRowAction(row: Record<string, any>) {
  openPost(row as PostWithAllData)
}

function handleViewChange(next: string) {
  setView(next)
}

function handleFilterChange(key: string, value: string) {
  setFilter(key, value)
}

function handleSentinel(entries: IntersectionObserverEntry[]) {
  for (const entry of entries) {
    if (entry.isIntersecting && hasMore.value && !isLoading.value) {
      void loadMore()
    }
  }
}

function startObserver() {
  if (!sentinelRef.value) return
  observer = new IntersectionObserver(handleSentinel, { rootMargin: '100px' })
  observer.observe(sentinelRef.value)
}

useHead({
  title: t('seo_title_all'),
  meta: [
    { name: 'description', content: t('seo_description_all') }
  ]
});

onMounted(async () => {
  await fetchPosts(1)
  // The sentinel only exists once `hasMore` is known, so wait for the flush.
  await nextTick()
  startObserver()
})

onUnmounted(() => {
  observer?.disconnect()
})

const handleRefresh = async () => {
  posts.value = []
  currentPage.value = 1
  totalPages.value = 1
  await fetchPosts(1)
}

// Business-scoped feed: restart pagination on switch; in-flight responses for
// the previous business are discarded inside fetchPosts.
watch(activeBusinessId, () => {
  handleRefresh()
})
</script>

<template>
  <BaseCollectionPage :title="t('feeds.title')" :description="t('feeds.description')">
    <template #actions>
      <UButton
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="isLoading"
        :label="t('feeds.refresh')"
        @click="handleRefresh"
      />
    </template>

    <template #toolbar>
      <BaseCollectionToolbar
        :search="search"
        :search-placeholder="t('feeds.search')"
        :filters="toolbarFilters"
        :sort="toolbarSort"
        :view="view"
        :views="viewOptions"
        :busy="isLoading"
        @update:search="setSearch"
        @update:sort="setSort"
        @update:view="handleViewChange"
        @update:filter="handleFilterChange"
      />
    </template>

    <TwitterPostEditor @refresh="handleRefresh">
      <template #mic-recorder="{ onTranscript }">
        <MicRecorder @transcript="onTranscript" />
      </template>
      <template #template-variable="{ onAction }">
        <TemplateVariablePopUp @action="onAction" />
      </template>
      <template #ai-assistant="{ loading, onAction, onTemplateAction }">
        <PostAIAssistant :loading="loading" @action="onAction" @template-action="onTemplateAction" />
      </template>
    </TwitterPostEditor>

    <div class="mt-6">
      <BaseCollectionList
        v-if="view === 'list'"
        :items="filtered"
        :row-key="feedRowKey"
        :loading="isLoading && posts.length === 0"
        :empty-title="emptyTitle"
        :empty-hint="emptyHint"
        empty-icon="i-heroicons-newspaper"
      >
        <template #item="{ item }">
          <div class="min-w-0 flex-1">
            <PostFeedCard :post="item" />
          </div>
        </template>
        <template #empty>
          <UButton v-if="hasActiveFilters" variant="ghost" @click="resetFilters">
            {{ t('feeds.clearFilters') }}
          </UButton>
        </template>
      </BaseCollectionList>

      <BaseDataTable
        v-else
        :rows="filtered"
        :columns="columns"
        :row-key="feedRowKey"
        :loading="isLoading && posts.length === 0"
        :empty-title="emptyTitle"
        :empty-hint="emptyHint"
        empty-icon="i-heroicons-newspaper"
        min-width="56rem"
      >
        <template #cell-content="{ row }">
          <div class="max-w-md">
            <p class="line-clamp-2 text-sm text-highlighted">{{ row.content }}</p>
            <p v-if="mediaCount(row) > 0" class="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <UIcon name="i-lucide-image" class="size-3.5" />
              {{ mediaCount(row) }}
            </p>
          </div>
        </template>
        <template #cell-author="{ row }">
          <div class="flex items-center gap-2">
            <UAvatar :src="row.user?.image || undefined" :alt="row.user?.name || ''" size="3xs" />
            <span class="truncate text-sm">{{ row.user?.name || t('feeds.unknownUser') }}</span>
          </div>
        </template>
        <template #cell-status="{ row }">
          <UBadge :color="statusTone(row.status)" variant="subtle" size="sm">
            {{ statusLabel(row.status) }}
          </UBadge>
        </template>
        <template #cell-platforms="{ row }">
          <div v-if="row.platformPosts?.length" class="flex flex-wrap items-center gap-1">
            <span
              v-for="platform in row.platformPosts"
              :key="platform.id"
              class="inline-flex size-6 items-center justify-center rounded-md bg-elevated"
            >
              <UIcon :name="platformIcon(platform.platformPostId)" class="size-4" />
            </span>
          </div>
          <span v-else class="text-muted">—</span>
        </template>
        <template #cell-scheduled="{ row }">
          <span class="whitespace-nowrap text-sm text-muted">{{ formatDate(row.scheduledAt || row.createdAt) }}</span>
        </template>
        <template #row-actions="{ row }">
          <UButton
            icon="i-lucide-arrow-right"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="t('feeds.open')"
            @click="handleRowAction(row)"
          />
        </template>
        <template #empty>
          <UButton v-if="hasActiveFilters" variant="ghost" @click="resetFilters">
            {{ t('feeds.clearFilters') }}
          </UButton>
        </template>
      </BaseDataTable>
    </div>

    <div v-if="isLoading && posts.length > 0" class="flex justify-center py-6">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
    </div>

    <!-- Sentinel for infinite scroll -->
    <div v-if="hasMore" ref="sentinelRef" class="h-10" />

    <p v-if="!hasMore && posts.length > 0" class="py-6 text-center text-sm text-muted">
      {{ t('feeds.noMorePosts') }}
    </p>
  </BaseCollectionPage>
</template>
<style scoped></style>

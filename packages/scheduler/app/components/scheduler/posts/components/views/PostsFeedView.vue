<!--  Translation file -->
<i18n src="#site/app/pages/app/posts/posts.json"></i18n>
<script lang="ts" setup>
/**
 *
 * Component Description: Inbox-style master-detail Feed view of all posts.
 * The left pane lists posts with All / Pending / Published / Failed status
 * tabs; the right pane renders the selected post's full detail (Post,
 * Details, Comments, Stats) inline. On small screens the split collapses to
 * the list only and tapping a row opens the detail route.
 *
 * @author Reflect-Media <reflect.media GmbH>
 * @version 0.0.3
 */
import type { PostWithAllData } from '#layers/BaseDB/db/posts/posts';
import { usePlatformIcons, type SocialMediaPlatform } from '#layers/BaseUI/app/composables/usePlatformIcons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import PostDetailPane from '../PostDetailPane.vue';

dayjs.extend(relativeTime);

type FeedStatusFilter = 'all' | 'pending' | 'published' | 'failed'

const props = defineProps<{
  posts: PostWithAllData[];
}>();

const FEED_TABS: { value: FeedStatusFilter, label: string }[] = [
  { value: 'all', label: 'feeds.filter.all' },
  { value: 'pending', label: 'feeds.filter.pending' },
  { value: 'published', label: 'feeds.filter.published' },
  { value: 'failed', label: 'feeds.filter.failed' },
]

const STATUS_DOT_CLASSES: Record<FeedStatusFilter, string> = {
  all: 'bg-accented',
  pending: 'bg-warning',
  published: 'bg-success',
  failed: 'bg-error',
}

// Local scope: resolves the <i18n> block above. Template $t alone falls
// back to global messages (which lack feeds.*) — same pattern as PostStatsView.
const { t } = useI18n();
const { getPlatformIcon } = usePlatformIcons();
const isCompact = useMediaQuery('(max-width: 1023px)');

const activeFilter = ref<FeedStatusFilter>('all');
const selectedPost = ref<PostWithAllData | null>(null);

const filteredPosts = computed(() => {
  if (activeFilter.value === 'all') return props.posts
  return props.posts.filter(post => post.status === activeFilter.value)
});

const statusCounts = computed<Record<FeedStatusFilter, number>>(() => ({
  all: props.posts.length,
  pending: props.posts.filter(post => post.status === 'pending').length,
  published: props.posts.filter(post => post.status === 'published').length,
  failed: props.posts.filter(post => post.status === 'failed').length,
}));

const selectedId = computed(() => selectedPost.value?.id ?? null);
const openTo = computed(() => (selectedPost.value ? `/app/posts/feeds/${selectedPost.value.id}` : undefined));

// Keep a valid selection: when the active filter hides the current post (or the
// business switch replaces the list), fall back to the first visible row.
watch(filteredPosts, (list) => {
  const stillPresent = list.some(post => post.id === selectedPost.value?.id)
  if (!stillPresent) {
    selectedPost.value = list[0] ?? null
  }
}, { immediate: true });

const authorName = (post: PostWithAllData): string => post.user?.name || t('feeds.unknownUser');
const authorHandle = (post: PostWithAllData): string => (post.user?.firstName ? `@${post.user.firstName}` : '');
const platformIcon = (id?: string | null): string => getPlatformIcon((id || 'facebook') as SocialMediaPlatform);
const statusDotClass = (status: string): string => STATUS_DOT_CLASSES[status as FeedStatusFilter] || STATUS_DOT_CLASSES.all;

const timeAgo = (post: PostWithAllData): string =>
  dayjs(post.scheduledAt || post.publishedAt || post.createdAt).fromNow();

const selectFilter = (filter: FeedStatusFilter) => {
  activeFilter.value = filter;
};

const selectPost = (post: PostWithAllData) => {
  selectedPost.value = post;
  if (isCompact.value) {
    navigateTo(`/app/posts/feeds/${post.id}`);
  }
};
</script>

<template>
  <div class="mt-4 grid w-full gap-4 lg:h-[calc(100dvh-8rem)] lg:grid-cols-[26rem_minmax(0,1fr)]">
    <!-- Left pane: status tabs + post list -->
    <section
      class="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-default bg-elevated/30 lg:h-full">
      <nav class="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-default px-2 py-1.5">
        <button v-for="tab in FEED_TABS" :key="tab.value" type="button"
          class="flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium transition-colors"
          :class="activeFilter === tab.value
            ? 'bg-accented text-highlighted'
            : 'text-muted hover:bg-accented/50 hover:text-highlighted'"
          @click="selectFilter(tab.value)">
          {{ t(tab.label) }}
          <span class="rounded-full bg-default px-1.5 text-xs tabular-nums text-dimmed">{{ statusCounts[tab.value] }}</span>
        </button>
      </nav>

      <div v-if="filteredPosts.length" class="min-h-0 flex-1 divide-y divide-default overflow-y-auto">
        <button v-for="post in filteredPosts" :key="post.id" type="button"
          class="flex w-full gap-3 px-3 py-3 text-left transition-colors"
          :class="selectedId === post.id ? 'bg-accented/70' : 'hover:bg-accented/40'" @click="selectPost(post)">
          <span class="mt-1 shrink-0">
            <span class="block size-2 rounded-full" :class="statusDotClass(post.status)" />
          </span>
          <UAvatar :src="post.user?.image || undefined" :alt="post.user?.name || 'User'" size="sm" class="shrink-0" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <p class="truncate text-sm font-semibold text-highlighted">{{ authorName(post) }}</p>
              <time class="shrink-0 text-xs text-dimmed" :datetime="post.scheduledAt || post.createdAt">
                {{ timeAgo(post) }}
              </time>
            </div>
            <p class="mt-0.5 line-clamp-2 text-sm text-muted">{{ post.content }}</p>
            <div class="mt-1.5 flex items-center gap-2 text-xs text-dimmed">
              <UIcon v-for="platform in post.platformPosts" :key="platform.id"
                :name="platformIcon(platform.platformPostId)" class="size-3.5" />
              <span v-if="!post.platformPosts?.length" class="capitalize">{{ post.postFormat || 'post' }}</span>
              <span v-if="authorHandle(post)" class="truncate">{{ authorHandle(post) }}</span>
            </div>
          </div>
        </button>
      </div>

      <div v-else class="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <span class="flex size-12 items-center justify-center rounded-full bg-elevated">
          <UIcon :name="props.posts.length ? 'i-lucide-filter-x' : 'i-lucide-inbox'" class="size-6 text-dimmed" />
        </span>
        <div>
          <p class="font-medium text-highlighted">
            {{ props.posts.length ? t('feeds.emptyFiltered') : t('feeds.emptyNone') }}
          </p>
          <p class="mt-1 text-sm text-muted">
            {{ props.posts.length ? t('feeds.emptyFilteredHint') : t('feeds.emptyHint') }}
          </p>
        </div>
      </div>
    </section>

    <!-- Right pane: full detail of the selected post -->
    <section
      class="hidden min-h-0 overflow-hidden rounded-2xl border border-default lg:block lg:h-full lg:overflow-y-auto">
      <PostDetailPane v-if="selectedPost" :post="selectedPost" :open-to="openTo" />
      <div v-else class="flex h-full flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <span class="flex size-12 items-center justify-center rounded-full bg-elevated">
          <UIcon name="i-lucide-mouse-pointer-click" class="size-6 text-dimmed" />
        </span>
        <div>
          <p class="font-medium text-highlighted">{{ t('feeds.selectTitle') }}</p>
          <p class="mt-1 text-sm text-muted">{{ t('feeds.selectHint') }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped></style>

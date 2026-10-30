<!-- Translation file -->
<i18n src="#site/app/pages/app/posts/feeds/feeds.json"></i18n>

<script lang="ts" setup>
/**
 *
 * Component Description: Shared post detail surface.
 * Renders the Post / Details / Comments / Stats tabs for one post so both the
 * `/app/posts/feeds/[id]` route and the Feed view's master-detail right pane
 * show the exact same content.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import type { PostWithAllData } from '#layers/BaseDB/db/posts/posts';
import { usePlatformIcons, type SocialMediaPlatform } from '#layers/BaseUI/app/composables/usePlatformIcons';
import { publishedLinkFor } from '#layers/BaseShared/utils/published-post-links';
import dayjs from 'dayjs';
import PostCommentsView from './views/PostCommentsView.vue';
import PostStatsView from './views/PostStatsView.vue';

type DetailTab = 'post' | 'details' | 'comments' | 'stats'
type StatusTone = 'success' | 'warning' | 'error' | 'neutral'

const props = withDefaults(defineProps<{
  post: PostWithAllData | null
  loading?: boolean
  showBack?: boolean
  /** Message to show when the post could not be loaded. */
  error?: string
  /** When set, the header offers a link to the full post route. */
  openTo?: string
}>(), {
  loading: false,
  showBack: false,
  error: '',
  openTo: undefined,
})

const emit = defineEmits<{ back: [], retry: [] }>()

const { t } = useI18n()
const { getPlatformIcon } = usePlatformIcons()

const TABS: { value: DetailTab, label: string }[] = [
  { value: 'post', label: 'feeds.tabs.post' },
  { value: 'details', label: 'feeds.tabs.details' },
  { value: 'comments', label: 'feeds.tabs.comments' },
  { value: 'stats', label: 'feeds.tabs.stats' },
]

const STATUS_LABEL_KEYS: Record<string, string> = {
  draft: 'postDetail.statuses.draft',
  pending: 'postDetail.statuses.pending',
  published: 'postDetail.statuses.published',
  failed: 'postDetail.statuses.failed',
}

const STATUS_DOT_CLASSES: Record<StatusTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  neutral: 'bg-accented',
}

const activeTab = ref<DetailTab>('post')
const statsTabActive = ref(false)
const showRawData = ref(false)

const postData = computed(() => props.post)
const mediaAssets = computed(() => postData.value?.assets ?? [])
const shortId = computed(() => postData.value?.id?.slice(0, 8) ?? '')
const publishedLinks = computed(() => platformStatuses.value.filter(platform => !!platform.url))

const publishedCount = computed(() =>
  (postData.value?.platformPosts ?? []).filter(platform => platform.status === 'published').length
)

const platformStatuses = computed(() =>
  (postData.value?.platformPosts ?? []).map(platform => ({
    key: `${platform.platformPostId}-${platform.socialAccountId}`,
    platform: platform.platformPostId || platform.socialAccountId,
    status: platform.status,
    publishedAt: platform.publishedAt,
    url: publishedLinkFor(platform)?.url ?? '',
  }))
)

const comments = computed<string[]>(() => {
  const source = postData.value?.platformContent
  if (!source || typeof source !== 'object') return []
  const raw = (source as Record<string, unknown>).comment
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === 'string')
  return typeof raw === 'string' ? [raw] : []
})

const statusTone = (status?: string | null): StatusTone => {
  if (status === 'published') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'pending') return 'warning'
  return 'neutral'
}

const statusLabel = (status?: string | null): string => {
  const key = status ? STATUS_LABEL_KEYS[status] : undefined
  return key ? t(key) : (status ?? '')
}

const statusDotClass = computed(() => STATUS_DOT_CLASSES[statusTone(postData.value?.status)])

const platformIcon = (id?: string | null): string => getPlatformIcon((id || 'facebook') as SocialMediaPlatform)

const formatDate = (value?: Date | string | null): string =>
  value ? dayjs(value).format('h:mm A · MMM D, YYYY') : ''

const formattedDate = computed(() => formatDate(postData.value?.createdAt))
const scheduledDate = computed(() => formatDate(postData.value?.scheduledAt))

const selectTab = (tab: DetailTab) => {
  activeTab.value = tab
  if (tab === 'stats') {
    statsTabActive.value = true
  }
}

const toggleRawData = () => {
  showRawData.value = !showRawData.value
}

const onBack = () => {
  emit('back')
}

const onRetry = () => {
  emit('retry')
}
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <!-- Header: breadcrumb + tabs -->
    <header class="sticky top-0 z-10 border-b border-default bg-default/80 backdrop-blur">
      <div class="flex items-center gap-2 px-4 py-3">
        <UButton v-if="showBack" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm"
          :aria-label="t('postDetail.back')" @click="onBack" />
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <span class="size-2 shrink-0 rounded-full" :class="statusDotClass" />
          <p class="truncate text-sm font-medium text-highlighted">
            {{ postData?.user?.name || t('postDetail.title') }}
          </p>
          <span v-if="shortId" class="shrink-0 font-mono text-xs text-dimmed">#{{ shortId }}</span>
        </div>
        <UButton v-if="openTo" :to="openTo" icon="i-lucide-external-link" trailing color="neutral" variant="ghost"
          size="sm" :label="t('postDetail.openPost')" />
      </div>

      <nav v-if="postData" class="flex gap-1 overflow-x-auto px-2">
        <button v-for="tab in TABS" :key="tab.value" type="button"
          class="flex items-center gap-1 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors"
          :class="activeTab === tab.value
            ? 'border-primary text-primary'
            : 'border-transparent text-muted hover:text-highlighted'"
          @click="selectTab(tab.value)">
          {{ t(tab.label) }}
          <span v-if="tab.value === 'comments' && publishedCount"
            class="rounded-full bg-elevated px-1.5 text-xs text-muted">{{ publishedCount }}</span>
        </button>
      </nav>
    </header>

    <!-- Error -->
    <div v-if="error && !postData" class="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <span class="flex size-12 items-center justify-center rounded-full bg-error/10">
        <UIcon name="i-lucide-triangle-alert" class="size-6 text-error" />
      </span>
      <p class="text-muted">{{ error }}</p>
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="outline" size="sm" :label="t('postDetail.retry')"
        @click="onRetry" />
    </div>

    <!-- Loading / empty -->
    <div v-else-if="loading || !postData" class="flex items-center justify-center py-20">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-dimmed" />
    </div>

    <template v-else>
      <!-- Tab: Post -->
      <section v-if="activeTab === 'post'" v-motion-fade :duration="200" class="p-4 sm:p-6">
        <div class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <UBadge :color="statusTone(postData.status)" variant="subtle" size="sm">
            {{ statusLabel(postData.status) }}
          </UBadge>
          <span class="flex items-center gap-2 text-muted">
            <UAvatar :src="postData.user?.image || undefined" :alt="postData.user?.name || ''" size="3xs" />
            {{ postData.user?.name }}
          </span>
          <span class="flex items-center gap-1 text-muted">
            <UIcon name="i-lucide-layout-template" class="size-4" />
            <span class="capitalize">{{ postData.postFormat || 'post' }}</span>
          </span>
          <span v-if="formattedDate" class="flex items-center gap-1 text-muted">
            <UIcon name="i-lucide-calendar" class="size-4" />
            {{ formattedDate }}
          </span>
        </div>

        <p v-if="postData.content" class="whitespace-pre-wrap break-words text-xl leading-snug font-semibold text-highlighted">
          {{ postData.content }}
        </p>
        <p v-else class="text-muted italic">{{ t('postDetail.noContent') }}</p>

        <div v-if="publishedLinks.length" class="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-elevated/60 p-3">
          <span class="text-xs font-medium text-muted">{{ t('postDetail.publishedOn') }}</span>
          <UButton
            v-for="link in publishedLinks"
            :key="link.key"
            :to="link.url"
            target="_blank"
            size="xs"
            variant="soft"
            color="neutral"
            icon="i-lucide-external-link"
          >
            {{ link.platform }}
          </UButton>
        </div>

        <div v-if="mediaAssets.length > 0" class="mt-4 overflow-hidden rounded-2xl">
          <div class="grid grid-cols-1 gap-px bg-border" :class="{ 'sm:grid-cols-2': mediaAssets.length > 1 }">
            <template v-for="(asset, index) in mediaAssets" :key="asset.id || index">
              <img v-if="asset.mimeType?.startsWith('image/')" :src="asset.url" :alt="asset.filename || ''"
                class="max-h-96 w-full bg-elevated object-cover" loading="lazy" />
              <video v-else-if="asset.mimeType?.startsWith('video/')" :src="asset.url" controls
                class="max-h-96 w-full bg-elevated"></video>
            </template>
          </div>
        </div>

        <div class="mt-6 border-y border-default py-3">
          <div class="flex gap-6">
            <div class="flex items-center gap-1">
              <span class="font-bold tabular-nums text-highlighted">{{ platformStatuses.length }}</span>
              <span class="text-muted text-sm">{{ t('postDetail.stats.platforms') }}</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="font-bold tabular-nums text-highlighted">{{ mediaAssets.length }}</span>
              <span class="text-muted text-sm">{{ t('postDetail.stats.media') }}</span>
            </div>
          </div>
        </div>

        <div v-if="comments.length" class="mt-6">
          <h3 class="mb-3 text-xs font-semibold tracking-wide text-dimmed uppercase">
            {{ t('postDetail.conversation') }}
          </h3>
          <div class="space-y-3">
            <div v-for="(comment, index) in comments" :key="index"
              class="flex gap-3 rounded-xl bg-elevated/60 p-3">
              <UAvatar :src="postData.user?.image || undefined" :alt="postData.user?.name || ''" size="2xs"
                class="mt-0.5 shrink-0" />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-highlighted">{{ postData.user?.name }}</p>
                <p class="whitespace-pre-wrap break-words text-sm text-default">{{ comment }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Tab: Details -->
      <section v-else-if="activeTab === 'details'" v-motion-fade :duration="200" class="p-4 sm:p-6">
        <div v-if="platformStatuses.length > 0" class="mb-6">
          <h3 class="mb-3 font-bold text-highlighted">{{ t('postDetail.platformStatus') }}</h3>
          <div class="space-y-3">
            <div v-for="platform in platformStatuses" :key="platform.key"
              class="flex items-center justify-between rounded-xl bg-elevated/60 p-3">
              <div class="flex items-center gap-3">
                <UIcon :name="platformIcon(platform.platform)" class="size-5 text-muted" />
                <span class="font-medium capitalize text-highlighted">{{ platform.platform }}</span>
              </div>
              <div class="flex items-center gap-2">
                <UButton
                  v-if="platform.url"
                  :to="platform.url"
                  target="_blank"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-external-link"
                  :label="t('postDetail.openPublished')"
                />
                <UBadge :color="statusTone(platform.status)" variant="subtle" size="sm">
                  {{ statusLabel(platform.status) }}
                </UBadge>
                <span v-if="platform.publishedAt" class="text-sm text-muted">
                  {{ dayjs(platform.publishedAt).format('MMM D') }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 class="mb-3 font-bold text-highlighted">{{ t('postDetail.details') }}</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between gap-3">
              <span class="text-muted">{{ t('postDetail.fields.postId') }}</span>
              <span class="truncate font-mono text-default">{{ postData.id }}</span>
            </div>
            <div class="flex justify-between gap-3">
              <span class="text-muted">{{ t('postDetail.fields.format') }}</span>
              <span class="capitalize text-default">{{ postData.postFormat || 'post' }}</span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-muted">{{ t('postDetail.fields.status') }}</span>
              <UBadge :color="statusTone(postData.status)" variant="subtle" size="sm">
                {{ statusLabel(postData.status) }}
              </UBadge>
            </div>
            <div v-if="postData.publishedAt" class="flex justify-between gap-3">
              <span class="text-muted">{{ t('postDetail.fields.published') }}</span>
              <span class="text-default">{{ dayjs(postData.publishedAt).format('MMM D, YYYY h:mm A') }}</span>
            </div>
            <div v-if="postData.scheduledAt" class="flex justify-between gap-3">
              <span class="text-muted">{{ t('postDetail.fields.scheduled') }}</span>
              <span class="text-default">{{ dayjs(postData.scheduledAt).format('MMM D, YYYY h:mm A') }}</span>
            </div>
            <div v-if="postData.lastError" class="flex justify-between gap-3">
              <span class="text-muted">{{ t('postDetail.fields.error') }}</span>
              <span class="max-w-[60%] text-right text-error">{{ postData.lastError }}</span>
            </div>
          </div>
        </div>

        <div class="mt-6 border-t border-default pt-4">
          <UButton :icon="showRawData ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" color="neutral"
            variant="ghost" size="sm" class="w-full justify-between text-muted hover:text-highlighted"
            @click="toggleRawData">
            {{ t('postDetail.viewRawData') }}
          </UButton>
          <div v-if="showRawData" v-motion-fade :duration="200" class="mt-4 overflow-x-auto rounded-lg bg-elevated p-4">
            <pre class="font-mono text-xs break-all whitespace-pre-wrap text-default">{{ JSON.stringify(postData, null, 2) }}</pre>
          </div>
        </div>
      </section>

      <!-- Tab: Comments -->
      <section v-else-if="activeTab === 'comments'" v-motion-fade :duration="200" class="p-4 sm:p-6">
        <PostCommentsView :post="postData" />
      </section>

      <!-- Tab: Stats -->
      <section v-else v-motion-fade :duration="200" class="p-4 sm:p-6">
        <PostStatsView :post="postData" :auto-load="statsTabActive" />
      </section>
    </template>
  </div>
</template>

<style scoped></style>

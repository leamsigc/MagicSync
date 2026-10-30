<i18n src="#site/app/pages/app/posts/posts.json"></i18n>
<script lang="ts" setup>
/**
 * Compact list view for the posts page — the "List" half of the shared
 * collection shell. Rows open the feed detail, and every published platform is
 * exposed as a direct link (the board view does the same).
 */
import type { PostWithAllData } from '#layers/BaseDB/db/posts/posts'
import { usePlatformIcons, type SocialMediaPlatform } from '#layers/BaseUI/app/composables/usePlatformIcons'
import { publishedLinksFor } from '#layers/BaseShared/utils/published-post-links'
import dayjs from 'dayjs'

const props = defineProps<{
  posts: PostWithAllData[]
}>()

const { t } = useI18n()
const router = useRouter()
const { getPlatformIcon } = usePlatformIcons()

const rows = computed(() => props.posts)

function rowKey(post: PostWithAllData): string {
  return post.id
}

function openPost(id: string) {
  router.push(`/app/posts/feeds/${id}`)
}

function statusColor(status?: string | null): 'success' | 'warning' | 'error' | 'neutral' {
  if (status === 'published') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'failed') return 'error'
  return 'neutral'
}

function statusLabel(status?: string | null): string {
  if (!status) return ''
  const key = `postDetail.statuses.${status}`
  const label = t(key)
  return label === key ? status : label
}

function platformIcon(id?: string | null): string {
  return getPlatformIcon((id || 'facebook') as SocialMediaPlatform)
}

function publishedLinks(post: PostWithAllData) {
  return publishedLinksFor(post)
}

function formattedDate(post: PostWithAllData): string {
  const value = post.scheduledAt || post.publishedAt || post.createdAt
  return value ? dayjs(value).format('MMM D, YYYY HH:mm') : ''
}
</script>

<template>
  <BaseCollectionList
    :items="rows"
    :row-key="rowKey"
    :empty-title="t('list.emptyTitle')"
    :empty-hint="t('list.emptyHint')"
    empty-icon="i-lucide-file-text"
  >
    <template #item="{ item: post }">
      <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-elevated">
        <UIcon :name="platformIcon(post.platformPosts?.[0]?.platformPostId)" class="size-4" />
      </span>

      <button type="button" class="min-w-0 flex-1 text-left" @click="() => openPost(post.id)">
        <p class="truncate text-sm font-medium text-highlighted">{{ post.content }}</p>
        <p class="truncate text-xs text-muted">{{ formattedDate(post) }}</p>
      </button>

      <div class="hidden items-center gap-1 md:flex">
        <UBadge v-for="platform in post.platformPosts" :key="platform.id" :color="statusColor(platform.status)" variant="subtle" size="xs">
          {{ platform.platformPostId || platform.socialAccountId }}
        </UBadge>
      </div>

      <UBadge :color="statusColor(post.status)" variant="subtle" size="sm" class="shrink-0">
        {{ statusLabel(post.status) }}
      </UBadge>

      <div class="flex shrink-0 items-center gap-1">
        <UButton
          v-for="link in publishedLinks(post)"
          :key="link.id"
          :to="link.url"
          target="_blank"
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-external-link"
          :aria-label="t('openPublished')"
          :title="`${t('openPublished')} — ${link.platform}`"
        />
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-arrow-right"
          :aria-label="t('details')"
          @click="() => openPost(post.id)"
        />
      </div>
    </template>
  </BaseCollectionList>
</template>

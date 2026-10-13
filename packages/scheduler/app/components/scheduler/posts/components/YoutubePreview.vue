<!--  Translation file -->
<i18n src="./YoutubePreview.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: YouTube upload preview.
 *
 * An upload card is the channel, the title and the description: the spec's
 * `absolute-short` timestamp and the settings row's real `title` lead, the
 * media block stays empty (a video URL is not on the post row, and the
 * platform's `maxImages` is 0), and the rail carries like/comment/share/save.
 * The old card's invented "Likes / Comments / Views" row is gone — only the
 * comment count the row carries is rendered, and only when it is non-zero.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { Asset, PostCreateBase } from '#layers/BaseDB/db/schema'
import type { SocialMediaPlatformConfigurations } from '../../../../composables/usePlatformConfiguration'
import type { YouTubeSettings } from '#layers/BaseShared/shared/platformSettings'
import { usePreviewPost } from '#layers/BaseScheduler/app/composables/usePlatformPreview'
import PostPreviewShell from '../previews/PostPreviewShell.vue'
import PostPreviewMedia from '../previews/PostPreviewMedia.vue'
import PostPreviewActions from '../previews/PostPreviewActions.vue'
import PostPreviewContent from '../previews/PostPreviewContent.vue'
import PostPreviewComments from '../previews/PostPreviewComments.vue'

const props = defineProps<{
  postContent: string
  mediaAssets: Asset[]
  platform: keyof SocialMediaPlatformConfigurations | 'default'
  post: PostCreateBase
}>()

const { t } = useI18n()

const preview = usePreviewPost(props)

const postFormat = computed(() => props.post.postFormat ?? 'post')

const settings = computed(() => props.post.platformSettings?.[props.platform] as YouTubeSettings | undefined)

const videoTitle = computed(() => settings.value?.title ?? '')

const commentsHeading = computed(() => {
  const count = preview.value.commentCount

  return count > 0 ? t('commentsHeading', { count }) : ''
})
</script>

<template>
  <PostPreviewShell :platform :post="preview.post" :spec="preview.spec">
    <div class="mt-3 space-y-1">
      <h3 v-if="videoTitle" class="text-sm font-semibold text-highlighted">{{ videoTitle }}</h3>
      <span
        v-if="settings?.postType === 'short'"
        class="inline-block rounded-sm bg-accented px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted"
      >
        {{ t('shortBadge') }}
      </span>
      <PostPreviewContent :content="preview.content" :platform />
    </div>

    <template #media>
      <PostPreviewMedia
        :assets="preview.assets"
        :platform
        :spec="preview.spec"
        :format="postFormat"
      />
    </template>

    <template #actions>
      <PostPreviewActions :spec="preview.spec" :platform />
    </template>

    <template #comments="{ maxComments }">
      <PostPreviewComments
        :comments="preview.comments"
        :max-comments
        :heading="commentsHeading"
        :placeholder="t('addComment')"
      />
    </template>
  </PostPreviewShell>
</template>

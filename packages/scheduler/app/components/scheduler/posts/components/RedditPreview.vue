<!--  Translation file -->
<i18n src="./RedditPreview.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: Reddit post preview.
 *
 * A Reddit card is its community plus its votes: the subreddit header reads
 * the row's `RedditSettings.subreddit`, the vote pair and the share/save row
 * come from the spec's action list, and the comment count is rendered only
 * when the row actually carries comments. No score is shown anywhere — a posts
 * row has no vote total, so the arrows stay orange-less labels rather than
 * inventing one.
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
import type { RedditSettings } from '#layers/BaseShared/shared/platformSettings'
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

const settings = computed(() => props.post.platformSettings?.[props.platform] as RedditSettings | undefined)

const subredditLabel = computed(() => {
  const name = settings.value?.subreddit?.value

  return name ? t('subreddit', { name }) : ''
})
</script>

<template>
  <PostPreviewShell :platform :post="preview.post" :spec="preview.spec">
    <PostPreviewContent :content="preview.content" :platform />

    <template #media>
      <PostPreviewMedia
        :assets="preview.assets"
        :platform
        :spec="preview.spec"
        :format="postFormat"
      />
    </template>

    <template #extra>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <span
          v-if="subredditLabel"
          v-motion-fade-visible-once
          :duration="200"
          class="rounded-full bg-accented px-2 py-0.5 text-xs font-semibold text-muted"
        >
          {{ subredditLabel }}
        </span>
        <span v-if="preview.commentCount > 0" class="text-xs text-dimmed">
          {{ t('commentCount', { count: preview.commentCount }) }}
        </span>
      </div>
    </template>

    <template #actions>
      <PostPreviewActions :spec="preview.spec" :platform />
    </template>

    <template #comments="{ maxComments }">
      <PostPreviewComments
        :comments="preview.comments"
        :max-comments
        :placeholder="t('addComment')"
      />
    </template>
  </PostPreviewShell>
</template>

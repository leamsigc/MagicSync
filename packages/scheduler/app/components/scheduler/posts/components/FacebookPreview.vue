<!--  Translation file -->
<i18n src="./FacebookPreview.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: Facebook page post preview.
 *
 * Renders through the shared shell/media/actions/content stack, so the header,
 * media grid, action rail and comment thread are all spec-driven. The only
 * Facebook-specific chrome is the engagement summary row, and it shows the one
 * count the row actually carries — `post.comment.length` — or is omitted
 * entirely when that is zero. The literal `17K` reactions and `7.7K` shares
 * this card used to print are gone: neither number exists on any post row.
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
      <div
        v-if="preview.commentCount > 0"
        v-motion-fade-visible-once
        :duration="200"
        class="mt-3 flex items-center gap-1.5 text-xs text-dimmed"
      >
        <Icon name="i-heroicons-chat-bubble-oval-left" class="size-3.5 shrink-0" aria-hidden="true" />
        <span>{{ t('commentCount', { count: preview.commentCount }) }}</span>
      </div>
    </template>

    <template #actions>
      <PostPreviewActions :spec="preview.spec" :platform />
    </template>

    <template #comments="{ maxComments }">
      <PostPreviewComments
        :comments="preview.comments"
        :max-comments
        :heading="t('commentsHeading')"
        :placeholder="t('addComment')"
      />
    </template>
  </PostPreviewShell>
</template>

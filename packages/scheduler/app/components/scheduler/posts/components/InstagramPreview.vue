<!--  Translation file -->
<i18n src="./InstagramPreview.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: Instagram feed post preview.
 *
 * Composes the shared stack in the Instagram order — media first, then the
 * caption with the bold account byline, then the four-button rail and the
 * thread — because that ordering, not the Like/Comment/Share row, is what
 * separates it from the generic feed card it used to be cloned with. The
 * carousel, the rail and the thread all come from the spec.
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
    <template #media>
      <PostPreviewMedia
        :assets="preview.assets"
        :platform
        :spec="preview.spec"
        :format="postFormat"
      />
    </template>

    <template #extra="{ displayName }">
      <p v-if="displayName" class="mt-3 text-sm font-semibold text-highlighted">{{ displayName }}</p>
      <PostPreviewContent :content="preview.content" :platform />
      <p v-if="preview.commentCount > 0" class="mt-2 text-xs text-dimmed">
        {{ t('viewComments', { count: preview.commentCount }) }}
      </p>
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

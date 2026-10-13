<!--  Translation file -->
<i18n src="./BlueskyPreview.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: Bluesky post preview.
 *
 * Composes the shared stack with the spec's four-image grid and the
 * reply/repost/heart/share rail. The only Bluesky-specific chrome is the
 * content warning, rendered from the row's `contentWarning` setting when one
 * is actually set — a preview never claims a warning the row does not carry.
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
import type { BlueskySettings } from '#layers/BaseShared/shared/platformSettings'
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

const settings = computed(() => props.post.platformSettings?.[props.platform] as BlueskySettings | undefined)

const contentWarning = computed(() => settings.value?.contentWarning?.trim() ?? '')
</script>

<template>
  <PostPreviewShell :platform :post="preview.post" :spec="preview.spec">
    <PostPreviewContent :content="preview.content" :platform />

    <div
      v-if="contentWarning"
      v-motion-fade-visible-once
      :duration="200"
      class="mt-2 flex items-center gap-1.5 rounded-lg bg-accented px-3 py-2 text-xs text-muted"
    >
      <Icon name="i-heroicons-exclamation-triangle" class="size-3.5 shrink-0" aria-hidden="true" />
      <span>{{ t('contentWarning', { text: contentWarning }) }}</span>
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
        :placeholder="t('addComment')"
      />
    </template>
  </PostPreviewShell>
</template>

<!--  Translation file -->
<i18n src="./PinterestPreview.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: Pinterest pin preview.
 *
 * Image-first: the tall 2:3 pin leads the card, the caption and the board the
 * row actually names follow, and the save/share rail closes it. The old card
 * showed the caption above a never-rendered image and called the rail
 * "Save / Comment" with nothing behind it; now the media, the board chip and
 * the comment count all read from the row.
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
import type { PinterestSettings } from '#layers/BaseShared/shared/platformSettings'
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

const settings = computed(() => props.post.platformSettings?.[props.platform] as PinterestSettings | undefined)

const boardName = computed(() => settings.value?.board?.trim() ?? '')
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

    <template #extra>
      <PostPreviewContent :content="preview.content" :platform />

      <div class="mt-2 flex flex-wrap items-center gap-2">
        <span
          v-if="boardName"
          class="inline-flex items-center gap-1 rounded-full bg-accented px-2 py-0.5 text-xs text-muted"
        >
          <Icon name="i-heroicons-square-3-stack-3d" class="size-3.5 shrink-0" aria-hidden="true" />
          {{ boardName }}
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

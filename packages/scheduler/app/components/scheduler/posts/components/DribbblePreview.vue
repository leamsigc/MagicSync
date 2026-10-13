<!--  Translation file -->
<i18n src="./DribbblePreview.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: Dribbble shot preview.
 *
 * Image-first: the single 4:3 shot leads the card, the title and the tags the
 * row's `DribbbleSettings` carry follow it, and the heart/save rail closes it.
 * Like and view counts are not rendered — a Dribbble settings row names a shot,
 * it does not carry its statistics.
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
import type { DribbbleSettings } from '#layers/BaseShared/shared/platformSettings'
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

const settings = computed(() => props.post.platformSettings?.[props.platform] as DribbbleSettings | undefined)

const shotTitle = computed(() => settings.value?.title?.trim() ?? '')

const shotTags = computed(() => settings.value?.tags ?? [])
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
      <h3 v-if="shotTitle" class="mt-3 text-sm font-semibold text-highlighted">{{ shotTitle }}</h3>
      <PostPreviewContent :content="preview.content" :platform />

      <div v-if="shotTags.length" class="mt-2 flex flex-wrap gap-1.5">
        <span
          v-for="tag in shotTags"
          :key="tag"
          class="rounded-full bg-accented px-2 py-0.5 text-xs text-muted"
        >
          {{ tag }}
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

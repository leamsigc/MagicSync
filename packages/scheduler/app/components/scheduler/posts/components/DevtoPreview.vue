<!--  Translation file -->
<i18n src="./DevtoPreview.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: dev.to article preview.
 *
 * An article card: the 16:9 cover, the title the row's `DevToSettings` carry,
 * the reading time derived from the article body, and the tag chips the same
 * settings row names. No reaction counts — the dev.to heart and unicorn are
 * affordances in the rail, and a post row carries neither tally.
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
import type { DevToSettings } from '#layers/BaseShared/shared/platformSettings'
import { readingMinutesFor, usePreviewPost } from '#layers/BaseScheduler/app/composables/usePlatformPreview'
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

const settings = computed(() => props.post.platformSettings?.[props.platform] as DevToSettings | undefined)

const articleTitle = computed(() => settings.value?.title?.trim() ?? '')

const articleTags = computed(() => settings.value?.tags ?? [])

const readingMinutes = computed(() => readingMinutesFor(preview.value.content))
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
      <h3 v-if="articleTitle" class="mt-3 text-sm font-semibold text-highlighted">{{ articleTitle }}</h3>

      <div class="mt-1 flex items-center gap-1.5 text-xs text-dimmed">
        <Icon name="i-heroicons-clock" class="size-3.5 shrink-0" aria-hidden="true" />
        <span>{{ t('readingTime', { count: readingMinutes }) }}</span>
      </div>

      <PostPreviewContent :content="preview.content" :platform />

      <div v-if="articleTags.length" class="mt-2 flex flex-wrap gap-1.5">
        <span
          v-for="tag in articleTags"
          :key="tag.value"
          class="rounded-full bg-accented px-2 py-0.5 text-xs text-muted"
        >
          {{ tag.label }}
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

<!--  Translation file -->
<i18n src="./DiscordPreview.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: Discord message preview.
 *
 * A Discord post is a message: the shell's header is the author line, the
 * caption is the message body, the spec's grid lays out the attachments, and
 * the bar carries the react/reply/share set. When the platform supports link
 * previews and the message contains a URL, the embed renders the URL's own
 * host and address — the two things a Discord embed shows that the row really
 * contains. With no URL in the body there is no embed, not a fabricated one.
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
import { linkPreviewFor, usePreviewPost } from '#layers/BaseScheduler/app/composables/usePlatformPreview'
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

const linkPreview = computed(() => {
  if (!preview.value.spec.linkPreview) {
    return { url: '', host: '' }
  }

  return linkPreviewFor(preview.value.content)
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
      <div
        v-if="linkPreview.url"
        v-motion-fade-visible-once
        :duration="200"
        class="mt-3 flex items-center gap-2 border-s-2 border-primary bg-accented px-3 py-2"
      >
        <Icon name="i-heroicons-link" class="size-4 shrink-0 text-dimmed" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold text-highlighted">{{ linkPreview.host }}</p>
          <p class="truncate text-xs text-dimmed">{{ linkPreview.url }}</p>
        </div>
        <span class="sr-only">{{ t('embedLabel') }}</span>
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

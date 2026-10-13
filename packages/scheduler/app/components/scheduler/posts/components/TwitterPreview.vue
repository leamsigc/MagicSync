<!--  Translation file -->
<i18n src="./TwitterPreview.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: Twitter/X post preview.
 *
 * The header, timestamp and action rail are the shell's and the spec's; the
 * only Twitter-specific chrome is the audience chip, which reads the row's
 * `who_can_reply` setting instead of the hardcoded
 * "Accounts @mehdirhasan follows or mentioned can reply" line this card used
 * to print. The GitHub avatar, the `300.2K` reposts and the `1000.6K` views
 * are gone — the row carries an avatar, a handle and a comment count, and the
 * card shows exactly that.
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
import type { TwitterSettings } from '#layers/BaseShared/shared/platformSettings'
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

const settings = computed(() => props.post.platformSettings?.[props.platform] as TwitterSettings | undefined)

/** `who_can_reply` value to locale key — a table, so no branch tree. */
const AUDIENCE_KEYS: Record<string, string> = {
  everyone: 'audienceEveryone',
  following: 'audienceFollowing',
  mentionedUsers: 'audienceMentionedUsers',
  subscribers: 'audienceSubscribers',
  verified: 'audienceVerified',
}

const audienceLabel = computed(() => {
  const audience = settings.value?.who_can_reply
  const key = audience ? AUDIENCE_KEYS[audience] : undefined

  return key ? t(key) : ''
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
        v-if="audienceLabel"
        v-motion-fade-visible-once
        :duration="200"
        class="mt-3 flex items-center gap-1.5 text-xs text-dimmed"
      >
        <Icon name="i-heroicons-globe-alt" class="size-3.5 shrink-0" aria-hidden="true" />
        <span>{{ audienceLabel }}</span>
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

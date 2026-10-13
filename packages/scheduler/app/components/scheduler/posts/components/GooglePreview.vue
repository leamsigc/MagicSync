<!--  Translation file -->
<i18n src="./GooglePreview.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: Google Business Profile post preview.
 *
 * Renders the GBP card rather than the generic "Google Post" card it used to
 * be: the business as author, exactly one photo (the platform's `maxImages`
 * is 1, so the media component drops the rest with a `+N` badge), and the
 * real call-to-action button and Offer/Event chip the row's
 * `GoogleBusinessSettings` carry. When the settings row is absent — a post
 * drafted without GBP options — both are omitted instead of guessed.
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
import type { GoogleBusinessSettings } from '#layers/BaseShared/shared/platformSettings'
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

const settings = computed(
  () => props.post.platformSettings?.[props.platform] as GoogleBusinessSettings | undefined
)

/** `topicType` value to locale key. `STANDARD` maps to nothing on purpose. */
const TOPIC_KEYS: Record<string, string> = {
  EVENT: 'topicEvent',
  OFFER: 'topicOffer',
}

/** `callToActionType` value to locale key. */
const CTA_KEYS: Record<string, string> = {
  BOOK: 'ctaBook',
  ORDER: 'ctaOrder',
  SHOP: 'ctaShop',
  LEARN_MORE: 'ctaLearnMore',
  SIGN_UP: 'ctaSignUp',
  CALL: 'ctaCall',
}

const topicLabel = computed(() => {
  const topic = settings.value?.topicType
  const key = topic ? TOPIC_KEYS[topic] : undefined

  return key ? t(key) : ''
})

const ctaLabel = computed(() => {
  const cta = settings.value?.callToActionType
  const key = cta ? CTA_KEYS[cta] : undefined

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
        v-if="topicLabel || ctaLabel"
        v-motion-fade-visible-once
        :duration="200"
        class="mt-3 flex flex-wrap items-center gap-2"
      >
        <span
          v-if="topicLabel"
          class="rounded-sm bg-accented px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted"
        >
          {{ topicLabel }}
        </span>
        <span
          v-if="ctaLabel"
          class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          {{ ctaLabel }}
        </span>
      </div>
    </template>

    <template #actions>
      <PostPreviewActions :spec="preview.spec" :platform />
    </template>
  </PostPreviewShell>
</template>

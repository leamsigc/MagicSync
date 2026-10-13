<!--  Translation file -->
<i18n src="./InstagramStandalonePreview.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: Instagram legacy Basic Display preview.
 *
 * Forwards to `InstagramPreview` on purpose: the legacy Basic Display surface
 * draws the same feed card, and the spec already encodes the differences —
 * `supportsComments` is false, so the shell drops the comment thread, and
 * `verifiedBadge` is false, so no badge is possible. Duplicating a second
 * Instagram template would be the drift the registry exists to prevent.
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
import InstagramPreview from './InstagramPreview.vue'

defineProps<{
  postContent: string
  mediaAssets: Asset[]
  platform: keyof SocialMediaPlatformConfigurations | 'default'
  post: PostCreateBase
}>()

const { t } = useI18n()
</script>

<template>
  <section :aria-label="t('cardAria')">
    <InstagramPreview :post-content :media-assets :platform :post />
  </section>
</template>

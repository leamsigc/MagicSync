<!--  Translation file -->
<i18n src="./XPreview.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: X post preview.
 *
 * Forwards to `TwitterPreview`: the platform configurations for `x` and
 * `twitter` are the same table entry — same character limit, same media cap,
 * same preview spec — so the card is the card. The registry keeps `x` on its
 * own renderer so the two keys can diverge later without a second template
 * today.
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
import TwitterPreview from './TwitterPreview.vue'

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
    <TwitterPreview :post-content :media-assets :platform :post />
  </section>
</template>

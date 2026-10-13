<!--  Translation file -->
<i18n src="./LinkedInPagePreview.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: LinkedIn organization page preview.
 *
 * Forwards to `LinkedinPreview`, which already draws the whole card from the
 * spec — `linkedin-page` differs from `linkedin` only in `nameSource`, so the
 * same component renders the page as the author instead of the profile. The
 * wrapper exists so the registry maps the key to its own renderer and a later
 * wave can diverge the card without touching the profile version.
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
import LinkedinPreview from './LinkedinPreview.vue'

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
    <LinkedinPreview :post-content :media-assets :platform :post />
  </section>
</template>

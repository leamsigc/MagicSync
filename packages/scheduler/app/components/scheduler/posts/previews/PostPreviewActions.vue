<!--  Translation file -->
<i18n src="./PostPreviewActions.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: the action bar of a platform preview.
 *
 * Reads the whole bar off the spec, so the twelve old previews' twelve
 * hand-written `<span>Like</span> <span>Comment</span>` rows collapse into one
 * `v-for` over the platform's real action set.
 *
 * No counts are rendered, in any mode. An unpublished post has earned no
 * engagement and a published post's engagement is not on the row this preview
 * receives, so the bar is labels and icons only — the honest shape of a card
 * whose counts are simply not known.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { PlatformPreviewSpec } from './platformPreviewSpecs'

defineProps<{
  /** The platform's declarative spec. */
  spec: PlatformPreviewSpec
  /** Platform key the bar belongs to, for the accessible label. */
  platform: string
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="mt-3 flex flex-wrap items-center justify-around gap-x-3 gap-y-2 border-t border-default pt-3"
    role="list"
    :aria-label="t('actionsLabel', { platform })"
  >
    <span
      v-for="action in spec.actions"
      :key="action.key"
      role="listitem"
      class="flex items-center gap-1.5 text-xs font-medium text-muted"
    >
      <Icon :name="action.icon" class="size-4 shrink-0" aria-hidden="true" />
      <span>{{ t(action.key) }}</span>
    </span>
  </div>
</template>

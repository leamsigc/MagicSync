<!--  Translation file -->
<i18n src="./PostPreviewMedia.json"></i18n>
<script setup lang="ts">
/**
 * Component Description: the media block of a platform preview.
 *
 * Every decision is a lookup table keyed off the spec, so no renderer needs an
 * `if` tree to decide what to draw: the asset count picks a bucket, the bucket
 * picks a layout, the layout picks its classes, and the platform's own
 * `maxImages` decides what is allowed on the card at all.
 *
 * The cap is the point. A platform that cannot carry four images never previews
 * four — the extras are dropped silently and the dropped count renders as a
 * `+N` badge, which is what the real platforms do.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 *
 * @todo [ ] Test the component
 * @todo [ ] Integration test.
 * @todo [✔] Update the typescript.
 */
import type { Asset } from '#layers/BaseDB/db/schema'
import type { PostFormat } from '#layers/BaseShared/shared/platformConstants'
import type { MediaLayout, PlatformPreviewSpec } from './platformPreviewSpecs'
import { maxImagesFor } from '#layers/BaseScheduler/app/composables/usePlatformPreview'

const props = defineProps<{
  /** Resolved assets for the post, already uncapped. */
  assets: Asset[]
  /** Platform key, whose `maxImages` caps what may render. */
  platform: string
  /** The platform's declarative spec. */
  spec: PlatformPreviewSpec
  /** The post's format; video formats are always rendered full-bleed. */
  format: PostFormat
}>()

const { t } = useI18n()

/** Platform-agnostic aspect ratios, as classes a runtime string can pick. */
const ASPECT_CLASSES: Record<string, string> = {
  '1:1': 'aspect-square',
  '4:3': 'aspect-[4/3]',
  '4:5': 'aspect-[4/5]',
  '2:3': 'aspect-[2/3]',
  '9:16': 'aspect-[9/16]',
  '16:9': 'aspect-video',
}

/** Reels, Shorts and Stories are always full-bleed, whatever the platform's feed ratio is. */
const VERTICAL_FORMATS: Partial<Record<PostFormat, string>> = {
  reel: 'aspect-[9/16]',
  short: 'aspect-[9/16]',
  story: 'aspect-[9/16]',
}

/** Asset-count bucket → spec field, so the count never hits a condition. */
const LAYOUT_KEY_BY_COUNT: Record<number, keyof PlatformPreviewSpec['mediaLayouts']> = {
  0: 'one',
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'fourPlus',
}

/** Layout → container classes. `grid-4` is a 2x2, which is what a four-image feed card looks like. */
const CONTAINER_CLASSES: Record<MediaLayout, string> = {
  'none': 'hidden',
  'single': 'grid grid-cols-1 gap-1',
  'grid-2': 'grid grid-cols-2 gap-1',
  'grid-3': 'grid grid-cols-3 gap-1',
  'grid-4': 'grid grid-cols-2 gap-1',
  'carousel': 'flex snap-x snap-mandatory gap-1 overflow-x-auto',
  'video': 'grid grid-cols-1 gap-1',
}

/** Layout → per-item classes. A carousel item owns the whole width. */
const ITEM_CLASSES: Record<MediaLayout, string> = {
  'none': '',
  'single': 'min-w-0',
  'grid-2': 'min-w-0',
  'grid-3': 'min-w-0',
  'grid-4': 'min-w-0',
  'carousel': 'min-w-full shrink-0 snap-center',
  'video': 'min-w-0',
}

const maxImages = computed(() => maxImagesFor(props.platform))

const visibleAssets = computed<Asset[]>(() => {
  const max = maxImages.value

  return max > 0 ? props.assets.slice(0, max) : []
})

const droppedCount = computed(() => props.assets.length - visibleAssets.value.length)

const countBucket = computed(() => {
  const count = visibleAssets.value.length

  return count === 0 ? 0 : Math.min(count, 4)
})

const layout = computed<MediaLayout>(() => {
  const key = LAYOUT_KEY_BY_COUNT[countBucket.value] ?? 'one'

  return countBucket.value === 0 ? 'none' : props.spec.mediaLayouts[key]
})

const containerClass = computed(() => CONTAINER_CLASSES[layout.value])

const itemClass = computed(() => ITEM_CLASSES[layout.value])

const aspectClass = computed(() => VERTICAL_FORMATS[props.format]
  ?? ASPECT_CLASSES[props.spec.singleAspect ?? '']
  ?? 'aspect-square')

const isVideoAsset = (asset: Asset): boolean => asset.mimeType?.startsWith('video/') ?? false
</script>

<template>
  <div class="relative mt-3">
    <div v-if="layout === 'none'" class="flex flex-col items-center gap-2 rounded-lg border border-dashed border-default bg-accented p-6 text-center">
      <UIcon name="i-heroicons-photo" class="size-6 text-dimmed" aria-hidden="true" />
      <span class="text-xs text-muted">{{ t('empty') }}</span>
    </div>

    <div v-else :class="containerClass" :aria-label="t('galleryLabel')">
      <div
        v-for="asset in visibleAssets"
        :key="asset.id"
        :class="itemClass"
        class="relative overflow-hidden rounded-lg bg-accented"
      >
        <video
          v-if="isVideoAsset(asset)"
          :src="asset.url"
          :aria-label="t('mediaAlt')"
          class="h-full w-full object-cover"
          :class="aspectClass"
          controls
          playsinline
          preload="metadata"
        />
        <img
          v-else
          :src="asset.url"
          :alt="t('mediaAlt')"
          class="h-full w-full object-cover"
          :class="aspectClass"
          loading="lazy"
        />
      </div>
    </div>

    <span
      v-if="droppedCount > 0"
      class="absolute end-2 top-2 rounded-full bg-default/90 px-2 py-0.5 text-xs font-semibold tabular-nums text-highlighted shadow-sm"
    >
      {{ t('more', { count: droppedCount }) }}
    </span>
  </div>
</template>

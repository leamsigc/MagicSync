<i18n src="#site/app/pages/tools/carousel-creator/carousel-creator.json"></i18n>
<script lang="ts" setup>
import OgMediaPicker from '../../og-image-generator/OgMediaPicker.vue'
import { useCarouselDeck } from '#layers/BaseUI/app/utils/composables/useCarouselDeck'
import type { BackgroundLayer, ImageLayer, HtmlLayer } from '#layers/BaseUI/app/utils/layers/types'
import { findSlideTemplate } from '../../../../../../ui/app/utils/slideTemplates'

const {
  currentSlide,
  selectedLayer,
  updateLayer,
  addLayer,
} = useCarouselDeck()

const { t } = useI18n()

const bgLayer = computed<BackgroundLayer | null>(() => {
  const layers = currentSlide.value.layers
  if (!layers) return null
  const bg = layers.find(l => l.type === 'background')
  return bg?.type === 'background' ? bg : null
})

const selectedImageLayer = computed<ImageLayer | null>(() => {
  const l = selectedLayer.value
  return l?.type === 'image' ? l as ImageLayer : null
})

const selectedHtmlLayer = computed<HtmlLayer | null>(() => {
  const l = selectedLayer.value
  if (l?.type !== 'html' || !l.bindings) return null
  const tpl = findSlideTemplate(l.bindings.templateKey)
  if (tpl?.kind !== 'html' || !tpl.bindings.includes('images')) return null
  return l
})

const htmlImages = computed(() => {
  const h = selectedHtmlLayer.value
  if (!h?.bindings) return []
  const raw = h.bindings.data.images
  if (Array.isArray(raw)) return raw as string[]
  if (typeof raw === 'string') return raw.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
  return []
})

function updateHtmlImage(index: number, url: string): void {
  const h = selectedHtmlLayer.value
  if (!h?.bindings) return
  const current = [...htmlImages.value]
  // ensure length
  while (current.length <= index) current.push('')
  if (!url) {
    current.splice(index, 1)
  } else {
    current[index] = url
  }
  const filtered = current.filter(Boolean)
  const data = { ...h.bindings.data, images: filtered.length ? filtered : undefined }
  updateLayer(h.id, { bindings: { templateKey: h.bindings.templateKey, data } })
}

const hasImage = computed(() => bgLayer.value?.fill.kind === 'image' && !!bgLayer.value.fill.src)
const imageSrc = computed({
  get: () => bgLayer.value?.fill.kind === 'image' ? bgLayer.value.fill.src : '',
  set: (url: string) => {
    if (!bgLayer.value) return
    updateLayer(bgLayer.value.id, {
      fill: url ? { kind: 'image', src: url, fit: bgLayer.value.fill.kind === 'image' ? bgLayer.value.fill.fit : 'cover', dim: bgLayer.value.fill.kind === 'image' ? bgLayer.value.fill.dim : 0 } : { kind: 'color', color: '#0f0e0d' },
    })
  },
})

const dim = computed(() => bgLayer.value?.fill.kind === 'image' ? bgLayer.value.fill.dim : 0)

function updateDim(value: number): void {
  if (!bgLayer.value || bgLayer.value.fill.kind !== 'image') return
  updateLayer(bgLayer.value.id, { fill: { ...bgLayer.value.fill, dim: value } })
}

function removeImage(): void {
  if (!bgLayer.value) return
  updateLayer(bgLayer.value.id, { fill: { kind: 'color', color: '#0f0e0d' } })
}

function addImageLayer(): void {
  addLayer({
    type: 'image',
    name: 'Image',
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x: 200, y: 300, w: 680, h: 680, rotate: 0 },
    src: '',
    fit: 'cover',
    radius: 24,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

function handleSelectedImageChange(url: string): void {
  const l = selectedImageLayer.value
  if (!l) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateLayer(l.id, { src: url } as any)
}

function handleSelectedFitChange(v: string | null): void {
  if (!selectedImageLayer.value) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateLayer(selectedImageLayer.value.id, { fit: (v ?? 'cover') as any })
}

function handleSelectedRadiusChange(v: number | undefined): void {
  if (!selectedImageLayer.value) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateLayer(selectedImageLayer.value.id, { radius: v ?? 0 } as any)
}

function handleBgFitChange(v: string | null): void {
  if (!bgLayer.value) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateLayer(bgLayer.value.id, { fill: { ...bgLayer.value.fill, fit: (v ?? 'cover') as any } })
}
</script>

<template>
  <div class="space-y-4" data-testid="media-panel">
    <!-- Selected image layer -->
    <div v-if="selectedImageLayer" class="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p class="text-xs font-semibold uppercase tracking-wider text-primary">{{ t('media.selectedImage') }}</p>
      <OgMediaPicker :model-value="selectedImageLayer.src" :label="t('media.image')" @update:model-value="handleSelectedImageChange" />
      <div class="grid grid-cols-2 gap-2">
        <UFormField :label="t('style.fit')" size="xs">
          <USelect :model-value="selectedImageLayer.fit"
            :items="[{ label: 'Cover', value: 'cover' }, { label: 'Contain', value: 'contain' }, { label: 'Fill', value: 'fill' }]"
            value-key="value" size="sm" class="w-full" @update:model-value="handleSelectedFitChange" />
        </UFormField>
        <UFormField :label="`${t('style.radius')} (${selectedImageLayer.radius ?? 0}px)`" size="xs">
          <USlider :model-value="selectedImageLayer.radius ?? 0" :min="0" :max="200" @update:model-value="handleSelectedRadiusChange" />
        </UFormField>
      </div>
    </div>

    <!-- HTML template images -->
    <div v-if="selectedHtmlLayer" class="space-y-3 rounded-lg border border-default bg-muted p-3">
      <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('media.templateImages') }}</p>
      <div v-for="(img, idx) in htmlImages" :key="idx" class="flex items-center gap-2">
        <img :src="img" alt="" class="h-10 w-10 rounded object-cover border border-default bg-muted" />
        <span class="flex-1 truncate text-xs text-muted">{{ img.slice(0, 40) }}</span>
        <UButton size="2xs" variant="ghost" color="error" icon="i-lucide-x" @click="() => updateHtmlImage(idx, '')" />
      </div>
      <OgMediaPicker :model-value="''" :label="t('media.addPhoto')" @update:model-value="(url: string) => updateHtmlImage(htmlImages.length, url)" />
      <p class="text-[10px] text-muted">{{ t('media.templateImagesHint') }}</p>
    </div>

    <!-- Background image -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('media.backgroundImage') }}</p>
        <UButton size="2xs" variant="soft" color="primary" icon="i-lucide-image-plus" :label="t('media.addImageLayer')" @click="addImageLayer" />
      </div>
      <OgMediaPicker v-model="imageSrc" :label="t('media.image')" />
      <template v-if="hasImage && bgLayer?.fill.kind === 'image'">
        <UAlert icon="i-lucide-info" color="neutral" variant="subtle" :description="t('media.perSlideHint')" />
        <UFormField :label="t('style.fit')" size="xs">
          <USelect :model-value="bgLayer.fill.fit"
            :items="[{ label: 'Cover', value: 'cover' }, { label: 'Contain', value: 'contain' }, { label: 'Fill', value: 'fill' }]"
            value-key="value" size="sm" class="w-full" data-testid="media-fit"
            @update:model-value="handleBgFitChange" />
        </UFormField>
        <UFormField :label="`${t('media.dim')} (${Math.round(dim * 100)}%)`" size="xs">
          <USlider :model-value="dim" :min="0" :max="0.9" :step="0.05" data-testid="media-dim"
            @update:model-value="(v: number | undefined) => updateDim(v ?? 0)" />
        </UFormField>
        <UButton size="xs" variant="ghost" color="error" icon="i-lucide-x" :label="t('media.removeImage')"
          data-testid="btn-media-remove-image" @click="removeImage" />
      </template>
    </div>

    <p class="text-[10px] text-muted leading-relaxed">{{ t('media.layersHint') }}</p>
  </div>
</template>
<i18n src="../carousel-creator.json"></i18n>
<script lang="ts" setup>
import OgMediaPicker from '../../og-image-generator/components/OgMediaPicker.vue'
import { useCarouselDeck } from '../composables/useCarouselDeck'

const {
  currentSlide,
  updateSlideData,
} = useCarouselDeck()

const { t } = useI18n()

const MAX_GRID_IMAGES = 4

const isGrid = computed(() => currentSlide.value.templateKey === 'photo-grid')
const isPolaroid = computed(() => currentSlide.value.templateKey === 'polaroid')
const images = computed(() => {
  const raw = currentSlide.value.data.images
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) return raw.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
  return []
})

const pendingGridUrl = ref('')
watch(pendingGridUrl, (url) => {
  if (!url) return
  if (images.value.length < MAX_GRID_IMAGES) {
    updateSlideData({ images: [...images.value, url] })
  }
  pendingGridUrl.value = ''
})

function removeImage(idx: number): void {
  updateSlideData({ images: images.value.filter((_, i) => i !== idx) }
  )
}

const bgUrl = computed({
  get: () => currentSlide.value.bgImage?.url ?? '',
  set: (url: string) => {
    if (!url) {
      currentSlide.value.bgImage = null
      return
    }
    currentSlide.value.bgImage = {
      url,
      dim: currentSlide.value.bgImage?.dim ?? 0.25,
      shadow: currentSlide.value.bgImage?.shadow ?? { x: 0, y: 18, blur: 45, opacity: 0.45 },
    }
  },
})

const shadow = computed(() => currentSlide.value.bgImage?.shadow ?? { x: 0, y: 18, blur: 45, opacity: 0.45 })
const dim = computed(() => currentSlide.value.bgImage?.dim ?? 0.25)

function updateShadow(patch: Partial<typeof shadow.value>): void {
  if (!currentSlide.value.bgImage) return
  currentSlide.value.bgImage = {
    ...currentSlide.value.bgImage,
    shadow: { ...shadow.value, ...patch },
  }
}

function updateDim(value: number): void {
  if (!currentSlide.value.bgImage) return
  currentSlide.value.bgImage = { ...currentSlide.value.bgImage, dim: value }
}
</script>

<template>
  <div class="space-y-4" data-testid="media-panel">
    <div v-if="isGrid || isPolaroid" class="space-y-3" data-testid="grid-images">
      <div class="flex items-center justify-between">
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('media.gallery') }}</p>
        <UBadge v-if="isGrid" variant="outline" color="neutral" size="xs">{{ images.length }}/{{ MAX_GRID_IMAGES }}</UBadge>
      </div>
      <p class="text-[11px] text-muted leading-relaxed">
        {{ isGrid ? t('media.photosHint') : t('media.polaroidHint') }}
      </p>
      <p v-if="isGrid && images.length >= MAX_GRID_IMAGES" class="text-[11px] text-warning">{{ t('media.maxPhotos') }}</p>
      <OgMediaPicker v-else v-model="pendingGridUrl" :label="t('media.addPhoto')" />
      <div v-if="images.length" class="grid grid-cols-4 gap-2">
        <div
          v-for="(img, idx) in images"
          :key="`${idx}-${img}`"
          class="group relative aspect-square overflow-hidden rounded-md border border-default bg-muted"
        >
          <img :src="img" alt="" class="h-full w-full object-cover pointer-events-none">
          <button
            type="button"
            class="absolute top-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-highlighted opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
            :data-testid="`btn-remove-image-${idx}`"
            :aria-label="t('media.removePhoto')"
            @click="() => removeImage(idx)"
          >
            <UIcon name="i-lucide-x" class="h-3 w-3" />
          </button>
          <span class="absolute bottom-0.5 left-0.5 text-[9px] font-mono px-1 rounded bg-black/70 text-highlighted">{{ idx + 1 }}</span>
        </div>
      </div>
    </div>

    <USeparator v-if="isGrid || isPolaroid" />

    <OgMediaPicker v-model="bgUrl" :label="t('media.image')" />

    <template v-if="bgUrl">
      <UAlert
        icon="i-lucide-info"
        color="neutral"
        variant="subtle"
        :description="t('media.perSlideHint')"
      />

      <USeparator />

      <div class="space-y-3">
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">
          {{ t('media.shadow') }}
        </p>
        <div class="grid grid-cols-2 gap-x-4 gap-y-2">
          <UFormField :label="t('media.shadowX')" size="xs">
            <UInputNumber
              :model-value="shadow.x"
              size="xs"
              class="w-full"
              @update:model-value="(v: number | undefined) => updateShadow({ x: v ?? 0 })"
            />
          </UFormField>
          <UFormField :label="t('media.shadowY')" size="xs">
            <UInputNumber
              :model-value="shadow.y"
              size="xs"
              class="w-full"
              @update:model-value="(v: number | undefined) => updateShadow({ y: v ?? 0 })"
            />
          </UFormField>
        </div>
        <UFormField :label="`${t('media.shadowBlur')} (${shadow.blur}px)`" size="xs">
          <USlider
            :model-value="shadow.blur"
            :min="0"
            :max="120"
            @update:model-value="(v: number | undefined) => updateShadow({ blur: v ?? 0 })"
          />
        </UFormField>
        <UFormField :label="`${t('media.shadowOpacity')} (${Math.round(shadow.opacity * 100)}%)`" size="xs">
          <USlider
            :model-value="shadow.opacity"
            :min="0"
            :max="1"
            :step="0.05"
            @update:model-value="(v: number | undefined) => updateShadow({ opacity: v ?? 0 })"
          />
        </UFormField>
      </div>

      <USeparator />

      <UFormField :label="`${t('media.dim')} (${Math.round(dim * 100)}%)`" size="xs">
        <USlider
          :model-value="dim"
          :min="0"
          :max="0.9"
          :step="0.05"
          @update:model-value="(v: number | undefined) => updateDim(v ?? 0)"
        />
      </UFormField>
    </template>
  </div>
</template>

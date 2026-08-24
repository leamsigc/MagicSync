<i18n src="../carousel-creator.json"></i18n>
<script lang="ts" setup>
import OgMediaPicker from '../../og-image-generator/components/OgMediaPicker.vue'
import { useCarouselDeck } from '../composables/useCarouselDeck'

const {
  currentSlide,
} = useCarouselDeck()

const { t } = useI18n()

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
        <p class="text-xs font-semibold uppercase tracking-wider text-neutral-400">
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

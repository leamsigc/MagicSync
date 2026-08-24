<i18n src="../carousel-creator.json"></i18n>
<script lang="ts" setup>
import { useCarouselDeck } from '../composables/useCarouselDeck'

const {
  slides,
  downloadSlide,
  downloadAllSlides,
  exporting,
  exportProgress,
} = useCarouselDeck()

const { t } = useI18n()

function getStage(): HTMLElement {
  return document.getElementById('carousel-export-stage')!
}
</script>

<template>
  <div class="space-y-2" data-testid="export-panel">
    <UButton
      block
      icon="i-lucide-download"
      :loading="exporting"
      :label="exportProgress ? `${t('export.downloadAll')} ${exportProgress}` : `${t('export.downloadAll')} (${slides.length})`"
      data-testid="btn-download-all"
      @click="() => downloadAllSlides(getStage())"
    />
    <p v-if="exportProgress" class="text-[11px] font-mono text-center text-neutral-400" data-testid="download-progress">{{ exportProgress }}</p>

    <USeparator class="my-2" />

    <p class="text-xs font-semibold uppercase tracking-wider text-neutral-400">
      {{ t('export.individual') }}
    </p>
    <div class="grid grid-cols-5 gap-1.5">
      <UButton
        v-for="(slide, index) in slides"
        :key="slide.id"
        size="xs"
        variant="subtle"
        color="neutral"
        :data-testid="`btn-download-slide`"
        :aria-label="`${t('slide.download')} ${index + 1}`"
        @click="() => downloadSlide(getStage(), index)"
      >
        {{ String(index + 1).padStart(2, '0') }}
      </UButton>
    </div>

    <p class="text-[11px] text-neutral-500 leading-relaxed">
      {{ t('export.hint') }}
    </p>
  </div>
</template>

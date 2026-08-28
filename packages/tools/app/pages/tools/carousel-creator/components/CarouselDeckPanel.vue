<i18n src="../carousel-creator.json"></i18n>
<script lang="ts" setup>
import OgMediaPicker from '../../og-image-generator/components/OgMediaPicker.vue'
import { useCarouselDeck } from '../composables/useCarouselDeck'

const {
  flow,
  handle,
  slides,
} = useCarouselDeck()

const { t } = useI18n()

const modeItems = computed(() => [
  { label: t('flow.off'), value: 'off' },
  { label: t('flow.pan'), value: 'pan' },
  { label: t('flow.plane'), value: 'plane' },
])

const panCountItems = computed(() => [2, 3, 4].map(n => ({ label: String(n), value: n })))

const needsImage = computed(() => flow.value.mode !== 'off')
const imageLabel = computed(() => flow.value.mode === 'pan' ? t('flow.image') : t('flow.planeImage'))
const modeHint = computed(() => {
  if (flow.value.mode === 'pan') return t('flow.panHint')
  if (flow.value.mode === 'plane') return t('flow.planeHint')
  return t('flow.offHint')
})
const panClamped = computed(() => Math.min(Math.max(flow.value.panCount, 2), 4, Math.max(slides.value.length - 1, 0)))
</script>

<template>
  <div class="space-y-5" data-testid="deck-panel">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('deck.brand') }}</p>
      <UFormField :label="t('deck.handle')" size="xs">
        <UInput v-model="handle" :placeholder="t('deck.handlePlaceholder')" size="sm" class="w-full"
          data-testid="field-handle" />
      </UFormField>
      <p class="text-[10px] text-muted leading-relaxed">{{ t('deck.handleHint') }}</p>
    </section>

    <USeparator />

    <section class="space-y-2" data-testid="flow-panel">
      <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('flow.label') }}</p>
      <div class="grid grid-cols-3 gap-1.5" data-testid="flow-modes">
        <UButton v-for="item in modeItems" :key="item.value" size="sm" variant="soft" color="neutral" block
          :data-testid="`flow-mode-${item.value}`" :data-active="flow.mode === item.value"
          :class="flow.mode === item.value ? 'ring-1 ring-primary bg-primary/10 text-primary' : 'text-muted'"
          @click="() => flow.mode = item.value as typeof flow.mode">
          {{ item.label }}
        </UButton>
      </div>
      <p class="text-[10px] text-muted leading-relaxed">{{ modeHint }}</p>

      <template v-if="needsImage">
        <div v-if="flow.mode === 'pan'" class="grid grid-cols-2 gap-2 items-end">
          <UFormField :label="t('flow.panRun')" size="xs">
            <USelect v-model="flow.panCount" :items="panCountItems" value-key="value" size="sm" class="w-full"
              data-testid="flow-pan-count" />
          </UFormField>
          <p class="text-[10px] text-muted pb-1.5">
            {{ t('flow.panSlides', { count: panClamped }) }}
          </p>
        </div>

        <OgMediaPicker v-model="flow.image" :label="imageLabel" />

        <div v-if="flow.mode === 'plane'" class="grid grid-cols-2 gap-2">
          <label class="space-y-1">
            <span class="text-[10px] uppercase tracking-wide text-muted">{{ t('flow.from') }}</span>
            <input v-model="flow.gradientFrom" type="color" data-testid="flow-gradient-from"
              class="h-8 w-full cursor-pointer rounded border border-default bg-transparent">
          </label>
          <label class="space-y-1">
            <span class="text-[10px] uppercase tracking-wide text-muted">{{ t('flow.to') }}</span>
            <input v-model="flow.gradientTo" type="color" data-testid="flow-gradient-to"
              class="h-8 w-full cursor-pointer rounded border border-default bg-transparent">
          </label>
        </div>

        <UFormField :label="`${t('flow.dim')} (${Math.round(flow.dim * 100)}%)`" size="xs">
          <USlider v-model="flow.dim" :min="0" :max="0.8" :step="0.05" />
        </UFormField>
      </template>
    </section>
  </div>
</template>

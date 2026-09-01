<i18n src="../carousel-creator.json"></i18n>
<script lang="ts" setup>
import OgMediaPicker from '../../og-image-generator/components/OgMediaPicker.vue'
import { useCarouselDeck } from '../composables/useCarouselDeck'
import { PALETTES } from '../templates'

const props = defineProps<{ fonts: string[] }>()

const {
  flow,
  handle,
  slides,
  palette,
  applyPalette,
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

function applyPreset(preset: typeof PALETTES[number]): void {
  applyPalette({ bg: preset.bg, text: preset.text, accent: preset.accent })
}

function onPaletteInput(field: 'bg' | 'text' | 'accent', value: string): void {
  applyPalette({ ...palette.value, [field]: value })
}
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

    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('style.palette') }}</p>
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="preset in PALETTES"
          :key="preset.name"
          type="button"
          class="rounded-lg border border-default p-1.5 hover:border-primary/60 transition-colors"
          :title="preset.name"
          :aria-label="preset.name"
          :data-testid="`palette-preset-${preset.name.toLowerCase()}`"
          @click="() => applyPreset(preset)"
        >
          <span class="flex h-8 overflow-hidden rounded-md">
            <span class="flex-1" :style="{ background: preset.bg }" />
            <span class="flex-1" :style="{ background: preset.accent }" />
          </span>
        </button>
      </div>
      <div class="grid grid-cols-3 gap-2">
        <label class="space-y-1">
          <span class="text-[10px] uppercase tracking-wide text-muted">{{ t('palette.bg') }}</span>
          <input
            type="color"
            :value="palette.bg"
            data-testid="palette-bg"
            class="h-8 w-full cursor-pointer rounded border border-default bg-transparent"
            @change="(e: Event) => onPaletteInput('bg', (e.target as HTMLInputElement).value)"
          >
        </label>
        <label class="space-y-1">
          <span class="text-[10px] uppercase tracking-wide text-muted">{{ t('palette.text') }}</span>
          <input
            type="color"
            :value="palette.text"
            data-testid="palette-text"
            class="h-8 w-full cursor-pointer rounded border border-default bg-transparent"
            @change="(e: Event) => onPaletteInput('text', (e.target as HTMLInputElement).value)"
          >
        </label>
        <label class="space-y-1">
          <span class="text-[10px] uppercase tracking-wide text-muted">{{ t('palette.accent') }}</span>
          <input
            type="color"
            :value="palette.accent"
            data-testid="palette-accent"
            class="h-8 w-full cursor-pointer rounded border border-default bg-transparent"
            @change="(e: Event) => onPaletteInput('accent', (e.target as HTMLInputElement).value)"
          >
        </label>
      </div>
      <UFormField :label="t('style.font')" size="xs">
        <USelect
          :model-value="palette.font ?? null"
          :items="props.fonts"
          placeholder="Default"
          class="w-full"
          data-testid="font-select"
          :aria-label="t('style.font')"
          @update:model-value="(v: string | null) => applyPalette({ ...palette.value, font: v ?? undefined })"
        />
      </UFormField>
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
      <p class="text-[10px] text-muted leading-relaxed">{{ t('flow.layersNote') }}</p>

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
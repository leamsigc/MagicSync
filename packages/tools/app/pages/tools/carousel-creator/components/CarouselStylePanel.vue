<i18n src="../carousel-creator.json"></i18n>
<script lang="ts" setup>
import { CAROUSEL_PATTERNS } from '../patterns'
import { CAROUSEL_TEMPLATES, PALETTES } from '../templates'
import { useCarouselDeck } from '../composables/useCarouselDeck'

const props = defineProps<{ fonts: string[] }>()

const {
  currentSlide,
  currentIndex,
  slides,
  palette,
  slideHtml,
  applyPalette,
  updateSlideData,
  applyTemplateToCurrent,
} = useCarouselDeck()

const { t } = useI18n()

function applyPreset(preset: typeof PALETTES[number]): void {
  applyPalette({ bg: preset.bg, text: preset.text, accent: preset.accent })
}

function onPaletteInput(field: 'bg' | 'text' | 'accent', e: Event): void {
  const value = (e.target as HTMLInputElement).value
  applyPalette({ ...palette.value, [field]: value })
}

const showKicker = computed(() => ['title-kicker', 'tips-list', 'full-photo'].includes(currentSlide.value.templateKey))
const showBody = computed(() => ['title-kicker', 'qa', 'cta', 'stat-highlight', 'photo-left', 'full-photo'].includes(currentSlide.value.templateKey))
const showItems = computed(() => ['tips-list', 'steps', 'checklist', 'comparison', 'myth-fact'].includes(currentSlide.value.templateKey))
const showQuote = computed(() => currentSlide.value.templateKey === 'quote')
const showStat = computed(() => currentSlide.value.templateKey === 'stat-highlight')
const showCta = computed(() => currentSlide.value.templateKey === 'cta')

const itemsText = computed({
  get: () => Array.isArray(currentSlide.value.data.items) ? currentSlide.value.data.items.join('\n') : typeof currentSlide.value.data.items === 'string' ? currentSlide.value.data.items : '',
  set: (value: string) => updateSlideData({ items: value.split('\n').filter(line => line.trim()) }),
})

const PHOTO_TEMPLATES = new Set(['photo-left', 'full-photo'])

function previewFor(templateKey: string): string {
  return slideHtml({ ...currentSlide.value, templateKey }, currentIndex.value, slides.value.length)
}
</script>

<template>
  <div class="space-y-5">
    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('style.layout') }}</p>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="tpl in CAROUSEL_TEMPLATES"
          :key="tpl.key"
          type="button"
          :data-testid="`layout-card-${tpl.key}`"
          :data-active="currentSlide.templateKey === tpl.key"
          class="group relative rounded-lg overflow-hidden border text-left transition-colors"
          :class="currentSlide.templateKey === tpl.key ? 'border-primary ring-2 ring-primary/50' : 'border-default hover:border-primary/50'"
          :title="tpl.description"
          :aria-label="`${t('style.layout')}: ${tpl.title}`"
          @click="() => applyTemplateToCurrent(tpl.key)"
        >
          <span class="block relative aspect-[4/5] bg-muted overflow-hidden">
            <span
              class="absolute top-0 left-0 origin-top-left pointer-events-none block"
              :style="{ width: '1080px', height: '1350px', transform: 'scale(0.125)' }"
              v-html="previewFor(tpl.key)"
            />
          </span>
          <span class="flex items-center justify-between gap-1 px-2 py-1.5">
            <span class="text-[11px] font-medium text-default truncate">{{ tpl.title }}</span>
            <span
              v-if="PHOTO_TEMPLATES.has(tpl.key)"
              class="shrink-0 text-[9px] uppercase tracking-wide px-1 rounded bg-primary/15 text-primary"
            >{{ t('style.photo') }}</span>
          </span>
        </button>
      </div>
    </section>

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
            @change="(e: Event) => onPaletteInput('bg', e)"
          >
        </label>
        <label class="space-y-1">
          <span class="text-[10px] uppercase tracking-wide text-muted">{{ t('palette.text') }}</span>
          <input
            type="color"
            :value="palette.text"
            data-testid="palette-text"
            class="h-8 w-full cursor-pointer rounded border border-default bg-transparent"
            @change="(e: Event) => onPaletteInput('text', e)"
          >
        </label>
        <label class="space-y-1">
          <span class="text-[10px] uppercase tracking-wide text-muted">{{ t('palette.accent') }}</span>
          <input
            type="color"
            :value="palette.accent"
            data-testid="palette-accent"
            class="h-8 w-full cursor-pointer rounded border border-default bg-transparent"
            @change="(e: Event) => onPaletteInput('accent', e)"
          >
        </label>
      </div>
    </section>

    <USeparator />

    <section class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('style.content') }}</p>
      <UFormField v-if="showKicker" :label="t('fields.kicker')" size="xs">
        <UInput
          :model-value="currentSlide.data.kicker ?? ''"
          size="sm"
          class="w-full"
          data-testid="field-kicker"
          @update:model-value="(v: string) => updateSlideData({ kicker: v })"
        />
      </UFormField>
      <UFormField :label="t('fields.headline')" size="xs">
        <UTextarea
          :model-value="currentSlide.data.headline"
          :rows="2"
          :maxlength="120"
          size="sm"
          class="w-full"
          data-testid="field-headline"
          @update:model-value="(v: string) => updateSlideData({ headline: v })"
        />
      </UFormField>
      <UFormField v-if="showBody" :label="t('fields.body')" size="xs">
        <UTextarea
          :model-value="currentSlide.data.body ?? ''"
          :rows="3"
          :maxlength="280"
          size="sm"
          class="w-full"
          data-testid="field-body"
          @update:model-value="(v: string) => updateSlideData({ body: v })"
        />
      </UFormField>
      <UFormField v-if="showItems" :label="t('fields.items')" size="xs">
        <UTextarea
          :model-value="itemsText"
          :rows="5"
          size="sm"
          class="w-full font-mono"
          data-testid="field-items"
          @update:model-value="(v: string) => itemsText = v"
        />
        <p class="text-[10px] text-muted mt-1">{{ t('fields.itemsHint') }}</p>
      </UFormField>
      <template v-if="showQuote">
        <UFormField :label="t('fields.quote')" size="xs">
          <UTextarea
            :model-value="currentSlide.data.quote ?? ''"
            :rows="3"
            :maxlength="220"
            size="sm"
            class="w-full"
            @update:model-value="(v: string) => updateSlideData({ quote: v })"
          />
        </UFormField>
        <UFormField :label="t('fields.author')" size="xs">
          <UInput
            :model-value="currentSlide.data.author ?? ''"
            size="sm"
            class="w-full"
            @update:model-value="(v: string) => updateSlideData({ author: v })"
          />
        </UFormField>
      </template>
      <template v-if="showStat">
        <UFormField :label="t('fields.stat')" size="xs">
          <UInput
            :model-value="currentSlide.data.stat ?? ''"
            size="sm"
            class="w-full"
            @update:model-value="(v: string) => updateSlideData({ stat: v })"
          />
        </UFormField>
        <UFormField :label="t('fields.statLabel')" size="xs">
          <UInput
            :model-value="currentSlide.data.statLabel ?? ''"
            size="sm"
            class="w-full"
            @update:model-value="(v: string) => updateSlideData({ statLabel: v })"
          />
        </UFormField>
      </template>
      <UFormField v-if="showCta" :label="t('fields.cta')" size="xs">
        <UInput
          :model-value="currentSlide.data.cta ?? ''"
          size="sm"
          class="w-full"
          @update:model-value="(v: string) => updateSlideData({ cta: v })"
        />
      </UFormField>
    </section>

    <USeparator />

    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('style.pattern') }}</p>
      <div class="grid grid-cols-5 gap-1.5" data-testid="pattern-grid">
        <button
          v-for="pattern in CAROUSEL_PATTERNS"
          :key="pattern.key"
          type="button"
          :data-testid="`pattern-${pattern.key}`"
          :data-active="currentSlide.pattern === pattern.key"
          class="relative aspect-square rounded-md border overflow-hidden transition-transform hover:scale-105"
          :class="currentSlide.pattern === pattern.key ? 'ring-2 ring-primary border-transparent' : 'border-default'"
          :title="pattern.key"
          :aria-label="`${t('style.pattern')}: ${pattern.key}`"
          @click="() => currentSlide.pattern = pattern.key"
        >
          <span
            class="absolute inset-0"
            :style="{
              backgroundImage: pattern.key === 'none' ? 'none' : pattern.css(currentSlide.patternColor),
              backgroundSize: pattern.key === 'checker' ? '10px 10px' : pattern.key === 'halftone' ? '6px 6px' : pattern.key === 'dots' ? '8px 8px' : pattern.key === 'dots-dense' ? '5px 5px' : pattern.key === 'grid' ? '12px 12px' : pattern.key === 'grid-fine' ? '7px 7px' : pattern.key === 'blueprint' ? '14px 14px, 14px 14px, 4px 4px, 4px 4px' : pattern.key === 'confetti' ? '14px 14px, 10px 10px, 12px 12px' : 'auto',
              backgroundPosition: pattern.key === 'confetti' ? '0 0, 5px 7px, 9px 3px' : '0 0',
              backgroundColor: palette.bg,
              opacity: 0.5,
            }"
          />
        </button>
      </div>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 text-xs text-muted">
          {{ t('style.patternColor') }}
          <input
            v-model="currentSlide.patternColor"
            type="color"
            data-testid="pattern-color"
            class="h-7 w-10 cursor-pointer rounded border border-default bg-transparent"
          >
        </label>
        <label class="flex items-center gap-2 text-xs text-muted flex-1">
          {{ t('style.patternOpacity') }}
          <USlider
            v-model="currentSlide.patternOpacity"
            :min="0.02"
            :max="0.4"
            :step="0.01"
            class="flex-1"
          />
        </label>
      </div>
      <UFormField :label="t('style.borderRadius')" size="xs">
        <USlider
          v-model="currentSlide.borderRadius"
          :min="0"
          :max="40"
          :step="1"
        />
      </UFormField>
    </section>

    <USeparator />

    <section class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('style.font') }}</p>
      <USelect
        :model-value="palette.font ?? null"
        :items="props.fonts"
        placeholder="Default"
        class="w-full"
        data-testid="font-select"
        :aria-label="t('style.font')"
        @update:model-value="(v: string | null) => applyPalette({ ...palette.value, font: v ?? undefined })"
      />
      <p class="text-[10px] text-muted">{{ t('style.fontHint') }}</p>
    </section>

    <p class="sr-only">{{ props.fonts.length }} fonts available</p>
  </div>
</template>

<i18n src="../carousel-creator.json"></i18n>
<script lang="ts" setup>
import DialKnob from './DialKnob.vue'
import { CAROUSEL_PATTERNS } from '../patterns'
import { CAROUSEL_TEMPLATES, PALETTES } from '../templates'
import { useCarouselDeck, FRAME_PRESETS, type DeckFrame } from '../composables/useCarouselDeck'

defineProps<{
  mode: 'deck' | 'ai'
  guides: boolean
  exporting: boolean
  exportProgress: string
}>()

const emit = defineEmits<{
  'update:mode': [value: 'deck' | 'ai']
  'update:guides': [value: boolean]
  'download': []
  'download-all': []
  'save-all': []
  'use-in-post': []
}>()

const { t } = useI18n()

const {
  currentSlide,
  currentIndex,
  slides,
  flow,
  frame,
  fx,
  applyPalette,
  applyTemplateToCurrent,
  insertSlideAt,
} = useCarouselDeck()

const canAddMore = computed(() => slides.value.length < 10)
const addPageOpen = ref(false)

function handleAddPageWithTemplate(key: string): void {
  insertSlideAt(currentIndex.value + 1, key)
  addPageOpen.value = false
}
function handleAddBlankPage(): void {
  insertSlideAt(currentIndex.value + 1, currentSlide.value.templateKey)
  addPageOpen.value = false
}

function randomizePattern(): void {
  const pattern = CAROUSEL_PATTERNS[Math.floor(Math.random() * CAROUSEL_PATTERNS.length)]!
  currentSlide.value.pattern = pattern.key
}

const modeItems = [
  { label: t('dock.deck'), value: 'deck' as const },
  { label: t('ai.label'), value: 'ai' as const },
]

const patternOpacityPercent = computed({
  get: () => Math.round(currentSlide.value.patternOpacity * 100),
  set: (value: number) => {
    currentSlide.value.patternOpacity = Math.min(0.4, Math.max(0.02, value / 100))
  },
})

const aspectLabel = computed(() => {
  const ratio = frame.value.w / frame.value.h
  return ratio === 1 ? '1:1' : '4:5'
})

function cycleFrame(): void {
  frame.value = frame.value.h === FRAME_PRESETS.portrait.h
    ? { ...FRAME_PRESETS.square }
    : { ...FRAME_PRESETS.portrait }
}

const FLOW_ICONS: Record<string, string> = {
  off: 'i-lucide-square-dashed',
  plane: 'i-lucide-blend',
  pan: 'i-lucide-move-horizontal',
}

function cycleFlow(): void {
  const order: Array<'off' | 'plane' | 'pan'> = ['off', 'plane', 'pan']
  const next = order[(order.indexOf(flow.value.mode) + 1) % order.length]!
  flow.value.mode = next
}

function cyclePattern(): void {
  const index = CAROUSEL_PATTERNS.findIndex(p => p.key === currentSlide.value.pattern)
  const next = CAROUSEL_PATTERNS[(index + 1) % CAROUSEL_PATTERNS.length]!
  currentSlide.value.pattern = next.key
}

function applyFrame(preset: DeckFrame): void {
  frame.value = { ...preset }
}
</script>

<template>
  <div
    class="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-neutral-700/60 bg-neutral-900/90 backdrop-blur-md p-1.5 shadow-2xl"
    data-testid="control-bar"
  >
    <!-- Mode segment -->
    <div class="flex items-center rounded-full border border-neutral-700/60 bg-neutral-800/70 p-0.5" data-testid="bar-mode">
      <button
        v-for="item in modeItems"
        :key="item.value"
        type="button"
        :data-active="mode === item.value"
        class="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
        :class="mode === item.value ? 'bg-neutral-200 text-neutral-900' : 'text-neutral-400 hover:text-neutral-200'"
        :aria-pressed="mode === item.value"
        @click="() => emit('update:mode', item.value)"
      >
        {{ item.label }}
      </button>
    </div>

    <!-- Scrubbable dials -->
    <div class="flex items-center gap-1.5">
      <DialKnob
        v-model="fx.rotate"
        :label="t('bar.dialRotate')"
        :min="-45"
        :max="45"
        :step="5"
        unit="°"
      />
      <DialKnob
        v-model="fx.zoom"
        :label="t('bar.dialZoom')"
        :min="60"
        :max="140"
        :step="5"
        unit="%"
        :default-value="100"
      />
      <DialKnob
        v-model="patternOpacityPercent"
        :label="t('bar.dialPattern')"
        :min="2"
        :max="40"
        :step="1"
        unit="%"
        :default-value="8"
      />
    </div>

    <span class="h-8 w-px bg-neutral-700/60" aria-hidden="true" />

    <UPopover v-model:open="addPageOpen">
      <UTooltip :text="t('slide.addPage')">
        <UButton
          icon="i-lucide-file-plus"
          variant="soft"
          color="primary"
          size="sm"
          class="rounded-xl"
          :disabled="!canAddMore"
          :aria-label="t('slide.addPage')"
          data-testid="bar-add-page"
        />
      </UTooltip>
      <template #content>
        <div class="w-72 p-2 space-y-2">
          <p class="text-xs font-semibold text-neutral-300 px-1">{{ t('templates.chooseLayout') }}</p>
          <p class="text-[11px] text-neutral-500 px-1">{{ t('templates.chooseLayoutHint') }}</p>
          <div class="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            <button
              type="button"
              data-testid="bar-template-blank"
              class="rounded-lg border border-dashed border-neutral-700 hover:border-primary/60 hover:bg-neutral-800 p-2 text-left flex flex-col gap-1 items-center justify-center min-h-[64px]"
              @click="handleAddBlankPage"
            >
              <Icon name="i-lucide-file-plus" class="w-5 h-5 text-neutral-400" />
              <span class="text-[11px] font-medium text-neutral-300">{{ t('templates.blankPage') }}</span>
            </button>
            <button
              v-for="tpl in CAROUSEL_TEMPLATES"
              :key="tpl.key"
              :data-testid="`bar-template-${tpl.key}`"
              type="button"
              class="rounded-lg border border-neutral-700/60 hover:border-primary/50 hover:bg-neutral-800 p-2 text-left"
              @click="() => handleAddPageWithTemplate(tpl.key)"
            >
              <span class="block text-xs font-medium text-white truncate">{{ tpl.title }}</span>
              <span class="block text-[10px] text-neutral-500 line-clamp-2 leading-tight">{{ tpl.description }}</span>
            </button>
          </div>
        </div>
      </template>
    </UPopover>

    <span class="h-8 w-px bg-neutral-700/60" aria-hidden="true" />

    <!-- Quick-access cluster -->
    <div class="flex items-center gap-0.5">
      <UPopover>
        <UTooltip :text="t('style.layout')">
          <UButton
            icon="i-lucide-layout-template"
            variant="ghost"
            color="neutral"
            size="sm"
            class="rounded-xl"
            :aria-label="t('style.layout')"
            data-testid="bar-layout"
          />
        </UTooltip>
        <template #content>
          <div class="w-56 space-y-1 p-1">
            <button
              v-for="tpl in CAROUSEL_TEMPLATES"
              :key="tpl.key"
              type="button"
              :data-testid="`bar-layout-${tpl.key}`"
              :data-active="currentSlide.templateKey === tpl.key"
              class="w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors"
              :class="currentSlide.templateKey === tpl.key ? 'bg-primary/10 text-primary' : 'text-neutral-300 hover:bg-neutral-800'"
              @click="() => applyTemplateToCurrent(tpl.key)"
            >
              {{ tpl.title }}
            </button>
          </div>
        </template>
      </UPopover>

      <UPopover>
        <UTooltip :text="t('style.palette')">
          <UButton
            icon="i-lucide-palette"
            variant="ghost"
            color="neutral"
            size="sm"
            class="rounded-xl"
            :aria-label="t('style.palette')"
          />
        </UTooltip>
        <template #content>
          <div class="grid grid-cols-4 gap-1.5 p-1.5">
            <button
              v-for="preset in PALETTES"
              :key="preset.name"
              type="button"
              class="h-8 w-10 overflow-hidden rounded-md border border-neutral-700 transition-transform hover:scale-105"
              :title="preset.name"
              :aria-label="preset.name"
              @click="() => applyPalette({ bg: preset.bg, text: preset.text, accent: preset.accent })"
            >
              <span class="flex h-full">
                <span class="flex-1" :style="{ background: preset.bg }" />
                <span class="flex-1" :style="{ background: preset.accent }" />
              </span>
            </button>
          </div>
        </template>
      </UPopover>

      <UTooltip :text="t('randomize')">
        <UButton
          icon="i-lucide-dices"
          variant="ghost"
          color="neutral"
          size="sm"
          class="rounded-xl"
          :aria-label="t('randomize')"
          data-testid="bar-randomize"
          @click="randomizePattern"
        />
      </UTooltip>

      <UTooltip :text="t('style.pattern')">
        <UButton
          icon="i-lucide-grid-3x3"
          variant="ghost"
          color="neutral"
          size="sm"
          class="rounded-xl"
          :aria-label="t('style.pattern')"
          data-testid="bar-pattern"
          @click="cyclePattern"
        />
      </UTooltip>

      <UTooltip :text="t('bar.guides')">
        <UButton
          icon="i-lucide-grid-2x2"
          variant="ghost"
          color="neutral"
          size="sm"
          class="rounded-xl"
          :data-active="guides"
          :class="guides ? 'text-primary bg-primary/10' : ''"
          :aria-label="t('bar.guides')"
          :aria-pressed="guides"
          data-testid="bar-guides"
          @click="() => emit('update:guides', !guides)"
        />
      </UTooltip>

      <UTooltip :text="`${t('bar.aspect')}: ${aspectLabel}`">
        <UButton
          :label="aspectLabel"
          variant="ghost"
          color="neutral"
          size="sm"
          class="rounded-xl font-mono text-[11px]"
          :aria-label="`${t('bar.aspect')}: ${aspectLabel}`"
          data-testid="bar-aspect"
          @click="cycleFrame"
        />
      </UTooltip>

      <UTooltip :text="t('flow.label')">
        <UButton
          :icon="FLOW_ICONS[flow.mode]"
          variant="ghost"
          color="neutral"
          size="sm"
          class="rounded-xl"
          :data-active="flow.mode !== 'off'"
          :class="flow.mode !== 'off' ? 'text-primary bg-primary/10' : ''"
          :aria-label="t('flow.label')"
          data-testid="bar-flow"
          @click="cycleFlow"
        />
      </UTooltip>

      <UPopover>
        <UTooltip :text="t('bar.frame')">
          <UButton
            icon="i-lucide-frame"
            variant="ghost"
            color="neutral"
            size="sm"
            class="rounded-xl"
            :aria-label="t('bar.frame')"
            data-testid="bar-frame"
          />
        </UTooltip>
        <template #content>
          <div class="space-y-1 p-1">
            <button
              v-for="preset in FRAME_PRESETS"
              :key="preset.key"
              type="button"
              :data-testid="`bar-frame-${preset.key}`"
              :data-active="frame.h === preset.h"
              class="w-full rounded-md px-2 py-1.5 text-left text-xs font-mono transition-colors"
              :class="frame.h === preset.h ? 'bg-primary/10 text-primary' : 'text-neutral-300 hover:bg-neutral-800'"
              @click="() => applyFrame(preset)"
            >
              {{ preset.key === 'portrait' ? '4:5 · 1080×1350' : '1:1 · 1080×1080' }}
            </button>
          </div>
        </template>
      </UPopover>
    </div>

    <span class="h-8 w-px bg-neutral-700/60" aria-hidden="true" />

    <!-- Export actions -->
    <div class="flex items-center gap-1">
      <UTooltip :text="t('export.downloadCurrent')">
        <UButton
          icon="i-lucide-image-down"
          variant="ghost"
          color="neutral"
          size="sm"
          class="rounded-xl"
          :loading="exporting"
          :aria-label="t('export.downloadCurrent')"
          data-testid="pill-download"
          @click="emit('download')"
        />
      </UTooltip>
      <UTooltip :text="t('export.downloadAll')">
        <UButton
          icon="i-lucide-images"
          variant="ghost"
          color="neutral"
          size="sm"
          class="rounded-xl"
          :loading="exporting"
          :aria-label="t('export.downloadAll')"
          data-testid="pill-download-all"
          @click="emit('download-all')"
        />
      </UTooltip>
      <UTooltip :text="t('actions.saveAll')">
        <UButton
          icon="i-lucide-save"
          variant="ghost"
          color="neutral"
          size="sm"
          class="rounded-xl"
          :aria-label="t('actions.saveAll')"
          data-testid="pill-save-all"
          @click="emit('save-all')"
        />
      </UTooltip>
      <button
        type="button"
        class="rounded-full bg-yellow-400 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-950 transition-colors hover:bg-yellow-300 disabled:opacity-50"
        data-testid="pill-use-in-post"
        @click="emit('use-in-post')"
      >
        {{ t('actions.useInPost') }}
      </button>
    </div>
  </div>
</template>

<i18n src="#site/app/pages/tools/carousel-creator/carousel-creator.json"></i18n>
<script lang="ts" setup>
import OgMediaPicker from '../../og-image-generator/OgMediaPicker.vue'
import { useCarouselDeck } from '#layers/BaseUI/app/utils/composables/useCarouselDeck'
import { CAROUSEL_PATTERNS, PATTERN_SIZES } from '#layers/BaseUI/app/utils/patterns'
import { CAROUSEL_FONT_OPTIONS } from '#layers/BaseUI/app/utils/carouselTemplates'
import { FRAMES, OVERLAYS, EFFECTS } from '#layers/BaseUI/app/utils/designAssets'
import type { BackgroundLayer, EffectLayer, FrameLayer, GradientSpec, HtmlLayer, ImageLayer, OverlayLayer, PatternLayer, ShapeLayer, SlideLayer, TextLayer } from '#layers/BaseUI/app/utils/layers/types'
import { findSlideTemplate } from '../../../../../../ui/app/utils/slideTemplates'

const {
  selectedLayer,
  updateLayer,
  updateLayerTransform,
  selectLayer,
  removeLayer,
  addLayer,
} = useCarouselDeck()

const { t } = useI18n()

const FONT_OPTIONS = CAROUSEL_FONT_OPTIONS

const SHAPE_OPTIONS = [
  { label: 'Rectangle', value: 'rect' },
  { label: 'Circle', value: 'circle' },
  { label: 'Line', value: 'line' },
  { label: 'Arrow', value: 'arrow' },
  { label: 'Star', value: 'star' },
  { label: 'Triangle', value: 'triangle' },
  { label: 'Heart', value: 'heart' },
  { label: 'Diamond', value: 'diamond' },
] as const

const GRADIENT_KINDS = [
  { label: 'Linear', value: 'linear' },
  { label: 'Radial', value: 'radial' },
  { label: 'Conic', value: 'conic' },
] as const

const ALIGN_OPTIONS = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
] as const

const layer = computed<SlideLayer | null>(() => selectedLayer.value)

// ── Common transform ──────────────────────────────────────────────────────

const tr = computed(() => layer.value?.transform)

function patchTransform(patch: Partial<NonNullable<typeof tr.value>>): void {
  if (!layer.value) return
  updateLayerTransform(layer.value.id, patch)
}

function patchLayer(patch: Partial<SlideLayer>): void {
  if (!layer.value) return
  updateLayer(layer.value.id, patch)
}

// ── Background ────────────────────────────────────────────────────────────

const bg = computed(() => layer.value?.type === 'background' ? layer.value as BackgroundLayer : null)

function setBgFill(fill: BackgroundLayer['fill']): void {
  if (!bg.value) return
  patchLayer({ fill })
}

function bgFillKind(): BackgroundLayer['fill']['kind'] {
  return bg.value?.fill.kind ?? 'color'
}

// ── Text ──────────────────────────────────────────────────────────────────

const text = computed(() => layer.value?.type === 'text' ? layer.value as TextLayer : null)
const textGradient = computed(() => text.value?.gradient ?? null)

function patchText(patch: Partial<TextLayer>): void {
  if (!text.value) return
  patchLayer(patch)
}

// ── Gradient editor ───────────────────────────────────────────────────────

const editingGradient = computed<GradientSpec | null>(() => {
  if (text.value?.gradient) return text.value.gradient
  if (bg.value?.fill.kind === 'gradient') return bg.value.fill.gradient
  if (layer.value?.type === 'shape' && typeof (layer.value as ShapeLayer).fill !== 'string') {
    return (layer.value as ShapeLayer).fill as GradientSpec
  }
  return null
})

function setGradient(g: GradientSpec): void {
  if (!layer.value) return
  if (text.value) { patchText({ gradient: g }); return }
  if (bg.value) { setBgFill({ kind: 'gradient', gradient: g }); return }
  if (layer.value.type === 'shape') { patchLayer({ fill: g }); return }
}

function updateStop(index: number, patch: Partial<GradientSpec['stops'][number]>): void {
  const g = editingGradient.value
  if (!g) return
  const stops = g.stops.map((s, i) => i === index ? { ...s, ...patch } : s)
  setGradient({ ...g, stops })
}

function addStop(): void {
  const g = editingGradient.value
  if (!g) return
  const pos = Math.min(100, Math.max(0, (g.stops[g.stops.length - 1]?.pos ?? 100) - 5))
  setGradient({ ...g, stops: [...g.stops, { color: g.stops[g.stops.length - 1]?.color ?? '#ffffff', pos }] })
}

function removeStop(index: number): void {
  const g = editingGradient.value
  if (!g || g.stops.length <= 2) return
  setGradient({ ...g, stops: g.stops.filter((_, i) => i !== index) })
}

// ── Pattern / overlay / frame / effect grids ──────────────────────────────

function patternThumb(key: string, color: string): Record<string, string> {
  if (key === 'none') return { backgroundImage: 'none' }
  const def = CAROUSEL_PATTERNS.find(p => p.key === key)!
  const size = PATTERN_SIZES[key] ?? 'auto'
  const scaled = size !== 'auto' ? size.split(', ').map(s => s.split(' ').map(n => `${Math.round(parseFloat(n) / 2.5)}px`).join(' ')).join(', ') : 'auto'
  return { backgroundImage: def.css(color), backgroundSize: scaled, opacity: '0.55' }
}

// ── Html bindings ─────────────────────────────────────────────────────────

const BINDING_META: Record<string, { label: string, textarea: boolean }> = {
  kicker: { label: 'Kicker', textarea: false },
  headline: { label: 'Headline', textarea: false },
  body: { label: 'Body', textarea: true },
  quote: { label: 'Quote', textarea: true },
  author: { label: 'Author', textarea: false },
  stat: { label: 'Big number', textarea: false },
  statLabel: { label: 'Stat label', textarea: false },
  cta: { label: 'Button text', textarea: false },
  items: { label: 'Items (one per line)', textarea: true },
  images: { label: 'Image URLs (one per line)', textarea: true },
}

const htmlLayer = computed(() => layer.value?.type === 'html' ? layer.value as HtmlLayer : null)

function htmlBindings(): { keys: string[] } | null {
  const h = htmlLayer.value
  if (!h?.bindings?.templateKey) return null
  const template = findSlideTemplate(h.bindings.templateKey)
  if (template?.kind !== 'html') return null
  return { keys: template.bindings }
}

function patchBinding(key: string, value: string): void {
  const h = htmlLayer.value
  if (!h?.bindings) return
  const data = { ...h.bindings.data }
  if (key === 'items' || key === 'images') {
    const list = value.split('\n').map(s => s.trim()).filter(Boolean)
    if (list.length) data[key] = list
    else data[key] = undefined
  } else {
    data[key] = value
  }
  patchLayer({ bindings: { templateKey: h.bindings.templateKey, data } })
}

function bindingValue(key: string): string {
  const h = htmlLayer.value
  const raw = h?.bindings?.data?.[key]
  if (Array.isArray(raw)) return (raw as string[]).join('\n')
  return typeof raw === 'string' ? raw : ''
}

// ── Design layer appliers ─────────────────────────────────────────────────

const patternLayer = computed(() => layer.value?.type === 'pattern' ? layer.value as PatternLayer : null)
const overlayLayer = computed(() => layer.value?.type === 'overlay' ? layer.value as OverlayLayer : null)
const frameLayer = computed(() => layer.value?.type === 'frame' ? layer.value as FrameLayer : null)
const effectLayer = computed(() => layer.value?.type === 'effect' ? layer.value as EffectLayer : null)
const imageLayer = computed(() => layer.value?.type === 'image' ? layer.value as ImageLayer : null)
const shapeLayer = computed(() => layer.value?.type === 'shape' ? layer.value as ShapeLayer : null)

const TYPE_LABELS: Record<string, string> = {
  background: 'Background', text: 'Text', image: 'Image', shape: 'Shape',
  html: 'HTML', pattern: 'Pattern', overlay: 'Overlay', frame: 'Frame', effect: 'Effect',
}
</script>

<template>
  <div class="space-y-4" data-testid="layer-style-panel">
    <!-- Empty state -->
    <div v-if="!layer" class="rounded-lg border border-dashed border-neutral-600 p-4 text-center space-y-2"
      data-testid="layer-style-empty">
      <UIcon name="i-lucide-mouse-pointer-2" class="mx-auto size-5 opacity-60" />
      <p class="text-xs text-muted">{{ t('style.selectLayer') }}</p>
      <UButton size="xs" variant="soft" color="primary" icon="i-lucide-plus" :label="t('layers.addText')"
        data-testid="btn-empty-add-text"
        @click="() => { addLayer(); }" />
    </div>

    <template v-else>
      <!-- Common header -->
      <div class="flex items-center gap-2">
        <UInput :model-value="layer.name" size="xs" class="flex-1" :data-testid="`layer-name-${layer.id}`"
          :aria-label="'Layer name'" @update:model-value="(v: string) => patchLayer({ name: v })" />
        <span class="text-[10px] uppercase tracking-wide text-muted">{{ TYPE_LABELS[layer.type] }}</span>
      </div>

      <!-- Common transform -->
      <section class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('style.position') }}</p>
        <div class="grid grid-cols-2 gap-2">
          <UFormField :label="t('style.x')" size="xs">
            <UInputNumber :model-value="tr?.x ?? 0" size="xs" class="w-full"
              @update:model-value="(v: number | undefined) => patchTransform({ x: v ?? 0 })" />
          </UFormField>
          <UFormField :label="t('style.y')" size="xs">
            <UInputNumber :model-value="tr?.y ?? 0" size="xs" class="w-full"
              @update:model-value="(v: number | undefined) => patchTransform({ y: v ?? 0 })" />
          </UFormField>
          <UFormField :label="t('style.w')" size="xs">
            <UInputNumber :model-value="tr?.w ?? 0" size="xs" class="w-full"
              @update:model-value="(v: number | undefined) => patchTransform({ w: v ?? 0 })" />
          </UFormField>
          <UFormField :label="t('style.h')" size="xs">
            <UInputNumber :model-value="tr?.h ?? 0" size="xs" class="w-full"
              @update:model-value="(v: number | undefined) => patchTransform({ h: v ?? 0 })" />
          </UFormField>
        </div>
        <UFormField :label="`${t('style.rotate')} (${tr?.rotate ?? 0}°)`" size="xs">
          <USlider :model-value="tr?.rotate ?? 0" :min="-180" :max="180" :step="1"
            @update:model-value="(v: number | undefined) => patchTransform({ rotate: v ?? 0 })" />
        </UFormField>
        <UFormField :label="`${t('style.opacity')} (${Math.round((layer.opacity ?? 1) * 100)}%)`" size="xs">
          <USlider :model-value="layer.opacity ?? 1" :min="0" :max="1" :step="0.01"
            @update:model-value="(v: number | undefined) => patchLayer({ opacity: v ?? 1 })" />
        </UFormField>
      </section>

      <USeparator />

      <!-- Background -->
      <section v-if="bg" class="space-y-3">
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('design.backdrop') }}</p>
        <div class="grid grid-cols-3 gap-1.5">
          <UButton size="xs" variant="soft" color="neutral" :class="bgFillKind() === 'color' ? 'ring-1 ring-primary' : ''"
            :label="t('style.solid')" data-testid="bg-fill-color"
            @click="() => setBgFill({ kind: 'color', color: bg.fill.kind === 'color' ? bg.fill.color : '#0f0e0d' })" />
          <UButton size="xs" variant="soft" color="neutral" :class="bgFillKind() === 'gradient' ? 'ring-1 ring-primary' : ''"
            :label="t('style.gradient')" data-testid="bg-fill-gradient"
            @click="() => setBgFill({ kind: 'gradient', gradient: bg.fill.kind === 'gradient' ? bg.fill.gradient : { kind: 'linear', angle: 135, stops: [{ color: '#f97316', pos: 0 }, { color: '#0f0e0d', pos: 100 }] } })" />
          <UButton size="xs" variant="soft" color="neutral" :class="bgFillKind() === 'image' ? 'ring-1 ring-primary' : ''"
            :label="t('style.image')" data-testid="bg-fill-image"
            @click="() => setBgFill({ kind: 'image', src: bg.fill.kind === 'image' ? bg.fill.src : '', fit: 'cover', dim: 0 })" />
        </div>

        <template v-if="bgFillKind() === 'color' && bg.fill.kind === 'color'">
          <label class="flex items-center gap-2 text-xs text-muted">
            {{ t('style.color') }}
            <input v-model="bg.fill.color" type="color" class="h-7 w-10 cursor-pointer rounded border border-default bg-transparent"
              data-testid="bg-color" />
          </label>
        </template>

        <template v-else-if="bgFillKind() === 'image' && bg.fill.kind === 'image'">
          <OgMediaPicker v-model="bg.fill.src" :label="t('media.image')" />
          <UFormField :label="t('style.fit')" size="xs">
            <USelect :model-value="bg.fill.fit" :items="[{ label: 'Cover', value: 'cover' }, { label: 'Contain', value: 'contain' }, { label: 'Fill', value: 'fill' }]"
              value-key="value" size="sm" class="w-full"
              @update:model-value="(v: string | null) => { if (bg && v) setBgFill({ ...bg.fill, fit: v as any }) }" />
          </UFormField>
          <UFormField :label="`${t('media.dim')} (${Math.round(bg.fill.dim * 100)}%)`" size="xs">
            <USlider :model-value="bg.fill.dim" :min="0" :max="0.9" :step="0.05"
              @update:model-value="(v: number | undefined) => { if (bg) setBgFill({ ...bg.fill, dim: v ?? 0 }) }" />
          </UFormField>
          <UAlert v-if="bg.fill.slice" icon="i-lucide-scissors" color="neutral" variant="subtle"
            :title="t('fromImage.sliceBadge')" />
        </template>
      </section>

      <!-- Text -->
      <section v-else-if="text" class="space-y-3">
        <UFormField :label="t('style.content')" size="xs">
          <UTextarea :model-value="text.content" :rows="4" class="w-full" data-testid="text-content"
            @update:model-value="(v: string) => patchText({ content: v })" />
        </UFormField>
        <div class="grid grid-cols-2 gap-2">
          <UFormField :label="t('style.font')" size="xs">
            <USelect :model-value="text.font" :items="FONT_OPTIONS" size="sm" class="w-full"
              @update:model-value="(v: string | null) => patchText({ font: v ?? 'Arial' })" />
          </UFormField>
          <UFormField :label="t('style.size')" size="xs">
            <UInputNumber :model-value="text.fontSize" :min="8" :max="400" size="xs" class="w-full"
              @update:model-value="(v: number | undefined) => patchText({ fontSize: v ?? 40 })" />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <UFormField :label="t('style.weight')" size="xs">
            <USelect :model-value="String(text.fontWeight)"
              :items="['400', '500', '600', '700', '800', '900'].map(w => ({ label: w, value: w }))"
              value-key="value" size="sm" class="w-full"
              @update:model-value="(v: string | null) => patchText({ fontWeight: Number(v ?? 400) })" />
          </UFormField>
          <UFormField :label="t('style.align')" size="xs">
            <USelect :model-value="text.align" :items="ALIGN_OPTIONS" value-key="value" size="sm" class="w-full"
              @update:model-value="(v: string | null) => patchText({ align: (v ?? 'left') as any })" />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <UFormField :label="t('style.lineHeight')" size="xs">
            <UInputNumber :model-value="text.lineHeight" :min="0.8" :max="2.5" :step="0.05" size="xs" class="w-full"
              @update:model-value="(v: number | undefined) => patchText({ lineHeight: v ?? 1.2 })" />
          </UFormField>
          <UFormField :label="t('style.letterSpacing')" size="xs">
            <UInputNumber :model-value="text.letterSpacing" :min="-5" :max="30" size="xs" class="w-full"
              @update:model-value="(v: number | undefined) => patchText({ letterSpacing: v ?? 0 })" />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <label class="space-y-1">
            <span class="text-[10px] uppercase tracking-wide text-muted">{{ t('style.color') }}</span>
            <input v-model="text.color" type="color" class="h-8 w-full cursor-pointer rounded border border-default bg-transparent"
              data-testid="text-color" />
          </label>
          <label class="space-y-1">
            <span class="text-[10px] uppercase tracking-wide text-muted">{{ t('style.bg') }}</span>
            <input :value="text.bg ?? '#00000000'" type="color" class="h-8 w-full cursor-pointer rounded border border-default bg-transparent"
              @change="(e: Event) => patchText({ bg: (e.target as HTMLInputElement).value })" />
          </label>
        </div>

        <USeparator />
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('style.gradientText') }}</p>
          <USwitch :model-value="!!textGradient" data-testid="text-gradient-toggle"
            @update:model-value="(v: boolean) => patchText({ gradient: v ? { kind: 'linear', angle: 90, stops: [{ color: text.color, pos: 0 }, { color: '#ffffff', pos: 100 }] } : undefined })" />
        </div>
      </section>

      <!-- Image -->
      <section v-else-if="imageLayer" class="space-y-3">
        <OgMediaPicker v-model="imageLayer.src" :label="t('media.image')" />
        <UFormField :label="t('style.fit')" size="xs">
          <USelect :model-value="imageLayer.fit"
            :items="[{ label: 'Cover', value: 'cover' }, { label: 'Contain', value: 'contain' }, { label: 'Fill', value: 'fill' }]"
            value-key="value" size="sm" class="w-full"
            @update:model-value="(v: string | null) => patchLayer({ fit: (v ?? 'cover') as any })" />
        </UFormField>
        <UFormField :label="`${t('style.radius')} (${imageLayer.radius ?? 0}px)`" size="xs">
          <USlider :model-value="imageLayer.radius ?? 0" :min="0" :max="200"
            @update:model-value="(v: number | undefined) => patchLayer({ radius: v ?? 0 })" />
        </UFormField>
        <div class="grid grid-cols-2 gap-2">
          <UFormField :label="t('style.borderW')" size="xs">
            <UInputNumber :model-value="imageLayer.border?.width ?? 0" :min="0" :max="50" size="xs" class="w-full"
              @update:model-value="(v: number | undefined) => patchLayer({ border: { width: v ?? 0, color: imageLayer.border?.color ?? '#ffffff', radius: imageLayer.border?.radius ?? 0 } })" />
          </UFormField>
          <label class="space-y-1">
            <span class="text-[10px] uppercase tracking-wide text-muted">{{ t('style.borderC') }}</span>
            <input :value="imageLayer.border?.color ?? '#ffffff'" type="color"
              class="h-8 w-full cursor-pointer rounded border border-default bg-transparent"
              @change="(e: Event) => patchLayer({ border: { width: imageLayer.border?.width ?? 0, color: (e.target as HTMLInputElement).value, radius: imageLayer.border?.radius ?? 0 } })" />
          </label>
        </div>
      </section>

      <!-- Shape -->
      <section v-else-if="shapeLayer" class="space-y-3">
        <UFormField :label="t('style.shape')" size="xs">
          <USelect :model-value="shapeLayer.shape" :items="SHAPE_OPTIONS" value-key="value" size="sm" class="w-full"
            @update:model-value="(v: string | null) => patchLayer({ shape: (v ?? 'rect') as any })" />
        </UFormField>
        <label class="flex items-center gap-2 text-xs text-muted">
          {{ t('style.fill') }}
          <input :value="typeof shapeLayer.fill === 'string' ? shapeLayer.fill : '#f97316'" type="color"
            class="h-7 w-10 cursor-pointer rounded border border-default bg-transparent"
            @change="(e: Event) => patchLayer({ fill: (e.target as HTMLInputElement).value })" />
        </label>
        <div class="grid grid-cols-2 gap-2">
          <UFormField :label="t('style.strokeW')" size="xs">
            <UInputNumber :model-value="shapeLayer.stroke?.width ?? 0" :min="0" :max="30" size="xs" class="w-full"
              @update:model-value="(v: number | undefined) => patchLayer({ stroke: { color: shapeLayer.stroke?.color ?? '#ffffff', width: v ?? 0 } })" />
          </UFormField>
          <UFormField :label="t('style.strokeC')" size="xs">
            <UInput :model-value="shapeLayer.stroke?.color ?? '#ffffff'" size="xs" class="w-full"
              @update:model-value="(v: string) => patchLayer({ stroke: { color: v, width: shapeLayer.stroke?.width ?? 0 } })" />
          </UFormField>
        </div>
        <UFormField v-if="shapeLayer.shape === 'rect'" :label="`${t('style.radius')} (${shapeLayer.radius ?? 0}px)`" size="xs">
          <USlider :model-value="shapeLayer.radius ?? 0" :min="0" :max="200"
            @update:model-value="(v: number | undefined) => patchLayer({ radius: v ?? 0 })" />
        </UFormField>
      </section>

      <!-- HTML -->
      <section v-else-if="htmlLayer" class="space-y-3">
        <template v-if="htmlBindings()">
          <template v-for="key in htmlBindings()!.keys" :key="key">
            <UFormField :label="BINDING_META[key]?.label ?? key" size="xs">
              <UTextarea v-if="BINDING_META[key]?.textarea" :model-value="bindingValue(key)" :rows="key === 'items' ? 4 : 3"
                class="w-full" :data-testid="`bindings-${key}`" @update:model-value="(v: string) => patchBinding(key, v)" />
              <UInput v-else :model-value="bindingValue(key)" class="w-full" :data-testid="`bindings-${key}`"
                @update:model-value="(v: string) => patchBinding(key, v)" />
            </UFormField>
          </template>
          <p class="text-[10px] text-muted">{{ t('style.bindingsHint') }}</p>
        </template>
        <template v-else>
          <UFormField :label="t('style.html')" size="xs">
            <UTextarea :model-value="htmlLayer.html ?? ''" :rows="8" class="w-full font-mono text-xs"
              data-testid="html-editor" @update:model-value="(v: string) => patchLayer({ html: v })" />
          </UFormField>
        </template>
      </section>

      <!-- Pattern -->
      <section v-else-if="patternLayer" class="space-y-3">
        <div class="grid grid-cols-6 gap-1.5" data-testid="pattern-style-grid">
          <button v-for="p in CAROUSEL_PATTERNS" :key="p.key" type="button"
            :data-testid="`pattern-style-${p.key}`" :data-active="patternLayer.key === p.key"
            class="relative aspect-square rounded-md border overflow-hidden transition-transform hover:scale-105"
            :class="patternLayer.key === p.key ? 'ring-2 ring-primary border-transparent' : 'border-default'"
            :title="p.key" @click="() => patchLayer({ key: p.key })">
            <span class="absolute inset-0" :style="patternThumb(p.key, patternLayer.color)" />
          </button>
        </div>
        <label class="flex items-center gap-2 text-xs text-muted">
          {{ t('style.patternColor') }}
          <input v-model="patternLayer.color" type="color" data-testid="pattern-style-color"
            class="h-7 w-10 cursor-pointer rounded border border-default bg-transparent" />
        </label>
        <UFormField :label="`${t('style.patternOpacity')} (${Math.round(patternLayer.opacity * 100)}%)`" size="xs">
          <USlider :model-value="patternLayer.opacity" :min="0.02" :max="0.5" :step="0.01"
            @update:model-value="(v: number | undefined) => patchLayer({ opacity: v ?? 0.08 })" />
        </UFormField>
      </section>

      <!-- Overlay -->
      <section v-else-if="overlayLayer" class="space-y-3">
        <div class="grid grid-cols-3 gap-1.5" data-testid="overlay-style-grid">
          <button v-for="o in OVERLAYS" :key="o.key" type="button"
            :data-testid="`overlay-style-${o.key}`" :data-active="overlayLayer.key === o.key"
            class="relative aspect-[4/3] rounded-md border overflow-hidden"
            :class="overlayLayer.key === o.key ? 'ring-2 ring-primary border-transparent' : 'border-default'"
            :title="o.label" @click="() => patchLayer({ key: o.key })">
            <span class="absolute inset-0 bg-muted" :style="o.thumb ? { background: o.css('#000000') } : {}" />
          </button>
        </div>
        <UFormField :label="`${t('style.opacity')} (${Math.round(overlayLayer.opacity * 100)}%)`" size="xs">
          <USlider :model-value="overlayLayer.opacity" :min="0" :max="1" :step="0.05"
            @update:model-value="(v: number | undefined) => patchLayer({ opacity: v ?? 1 })" />
        </UFormField>
      </section>

      <!-- Frame -->
      <section v-else-if="frameLayer" class="space-y-3">
        <div class="grid grid-cols-3 gap-1.5" data-testid="frame-style-grid">
          <button v-for="f in FRAMES" :key="f.key" type="button"
            :data-testid="`frame-style-${f.key}`" :data-active="frameLayer.key === f.key"
            class="relative aspect-[4/3] rounded-md border overflow-hidden"
            :class="frameLayer.key === f.key ? 'ring-2 ring-primary border-transparent' : 'border-default'"
            :title="f.label" @click="() => patchLayer({ key: f.key })">
            <span class="absolute inset-0" :style="f.thumb ? { border: '6px solid rgba(255,255,255,0.8)', ...(f.key === 'gradient-ring' ? { background: 'linear-gradient(135deg,#f97316,#ec4899)' } : {}) } : {}" />
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <label class="space-y-1">
            <span class="text-[10px] uppercase tracking-wide text-muted">{{ t('style.color') }}</span>
            <input v-model="frameLayer.color" type="color" data-testid="frame-style-color"
              class="h-8 w-full cursor-pointer rounded border border-default bg-transparent" />
          </label>
          <UFormField :label="t('style.thickness')" size="xs">
            <UInputNumber :model-value="frameLayer.thickness ?? 12" :min="1" :max="80" size="xs" class="w-full"
              @update:model-value="(v: number | undefined) => patchLayer({ thickness: v ?? 12 })" />
          </UFormField>
        </div>
      </section>

      <!-- Effect -->
      <section v-else-if="effectLayer" class="space-y-3">
        <div class="grid grid-cols-3 gap-1.5" data-testid="effect-style-grid">
          <button v-for="ef in EFFECTS" :key="ef.key" type="button"
            :data-testid="`effect-style-${ef.key}`" :data-active="effectLayer.key === ef.key"
            class="relative aspect-[4/3] rounded-md border overflow-hidden"
            :class="effectLayer.key === ef.key ? 'ring-2 ring-primary border-transparent' : 'border-default'"
            :title="ef.label" @click="() => patchLayer({ key: ef.key })">
            <span class="absolute inset-0 bg-gradient-to-br from-orange-400 to-rose-500"
              :style="ef.filter ? { filter: ef.filter } : {}" />
          </button>
        </div>
      </section>

      <!-- Gradient editor (shared) -->
      <section v-if="editingGradient && (bg || text)" class="space-y-2">
        <USeparator />
        <p class="text-xs font-semibold uppercase tracking-wider text-muted">{{ t('style.gradient') }}</p>
        <div class="grid grid-cols-2 gap-2">
          <UFormField :label="t('style.kind')" size="xs">
            <USelect :model-value="editingGradient.kind" :items="GRADIENT_KINDS" value-key="value" size="sm" class="w-full"
              @update:model-value="(v: string | null) => setGradient({ ...editingGradient, kind: (v ?? 'linear') as any })" />
          </UFormField>
          <UFormField :label="`${t('style.angle')} (${editingGradient.angle}°)`" size="xs">
            <USlider :model-value="editingGradient.angle" :min="0" :max="360" :step="1"
              @update:model-value="(v: number | undefined) => setGradient({ ...editingGradient, angle: v ?? 0 })" />
          </UFormField>
        </div>
        <div class="space-y-1.5">
          <div v-for="(stop, idx) in editingGradient.stops" :key="idx" class="flex items-center gap-2">
            <input :value="stop.color" type="color" class="h-7 w-10 cursor-pointer rounded border border-default bg-transparent"
              @input="(e: Event) => updateStop(idx, { color: (e.target as HTMLInputElement).value })" />
            <USlider :model-value="stop.pos" :min="0" :max="100" class="flex-1"
              @update:model-value="(v: number | undefined) => updateStop(idx, { pos: v ?? 0 })" />
            <span class="w-8 text-[10px] font-mono text-muted">{{ stop.pos }}%</span>
            <UButton size="2xs" variant="ghost" color="neutral" icon="i-lucide-x" :disabled="editingGradient.stops.length <= 2"
              @click="() => removeStop(idx)" />
          </div>
          <UButton size="xs" variant="soft" color="neutral" icon="i-lucide-plus" :label="t('style.addStop')"
            data-testid="gradient-add-stop" @click="addStop" />
        </div>
      </section>

      <div class="flex items-center gap-2 pt-1">
        <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-eye"
          :label="layer.visible ? t('style.hide') : t('style.show')" data-testid="btn-style-visibility"
          @click="() => patchLayer({ visible: !layer.visible })" />
        <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-lock"
          :label="layer.locked ? t('style.unlock') : t('style.lock')" data-testid="btn-style-lock"
          @click="() => patchLayer({ locked: !layer.locked })" />
        <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" :label="t('slide.delete')"
          data-testid="btn-style-delete" @click="() => { removeLayer(layer.id); selectLayer(null) }" />
      </div>
    </template>
  </div>
</template>
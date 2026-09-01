<i18n src="../carousel-creator.json"></i18n>
<script lang="ts" setup>
import { useCarouselDeck } from '../composables/useCarouselDeck'
import { CAROUSEL_SLIDE_TEMPLATES, type SlideTemplate, replaceTokens } from '../slideTemplates'
import { renderSlideLayers } from '../layers/render'
import { instantiateLayers, FRAME_W } from '../layers/types'
import { BACKDROP_GRADIENTS, BACKDROP_TEXTURES, FRAMES, OVERLAYS, EFFECTS, type BackdropPreset } from '../designAssets'
import { CAROUSEL_PATTERNS } from '../patterns'
import { PALETTES, type SlideData } from '../templates'
import type { SlideLayer } from '../layers/types'

const { t } = useI18n()
const toast = useToast()

const {
  currentSlide,
  palette,
  frame,
  applyTemplateToCurrent,
  setDesignLayer,
  removeLayer,
} = useCarouselDeck()

const activeTab = ref<'templates' | 'backdrops' | 'frames' | 'overlays' | 'effects' | 'patterns'>('templates')

const TAB_ITEMS = computed(() => [
  { label: t('design.tabs.templates'), value: 'templates', icon: 'i-lucide-layout-grid' },
  { label: t('design.tabs.backdrops'), value: 'backdrops', icon: 'i-lucide-wallpaper' },
  { label: t('design.tabs.frames'), value: 'frames', icon: 'i-lucide-frame' },
  { label: t('design.tabs.overlays'), value: 'overlays', icon: 'i-lucide-layers' },
  { label: t('design.tabs.effects'), value: 'effects', icon: 'i-lucide-wand-2' },
  { label: t('design.tabs.patterns'), value: 'patterns', icon: 'i-lucide-grid-3x3' },
])

// ── Previews ──────────────────────────────────────────────────────────────

const SAMPLE_DATA: SlideData = {
  kicker: 'KICKER',
  headline: 'Headline',
  body: 'Supporting line.',
  items: ['One', 'Two', 'Three'],
  quote: 'A great quote.',
  author: 'Author',
  stat: '87%',
  statLabel: 'of people',
  cta: 'Get started',
}

function previewHtml(tpl: SlideTemplate): string {
  if (tpl.kind === 'html') {
    const content = tpl.renderContent(SAMPLE_DATA, {
      bg: palette.value.bg,
      text: palette.value.text,
      accent: palette.value.accent,
      patternColor: palette.value.accent,
      font: palette.value.font,
    }, 0, 1)
    return `<div style="width:1080px;height:1350px;background:${palette.value.bg};overflow:hidden">${content}</div>`
  }
  const layers = instantiateLayers(replaceTokens(tpl.layers, palette.value))
  return renderSlideLayers(layers, frame.value, palette.value, { index: 0, total: 1 })
}

// ── Apply ─────────────────────────────────────────────────────────────────

const confirmApply = ref(false)
const pendingTemplate = ref<SlideTemplate | null>(null)

function handleTemplateClick(tpl: SlideTemplate): void {
  const hasCustom = (currentSlide.value.layers?.length ?? 0) > 2
  if (hasCustom) {
    pendingTemplate.value = tpl
    confirmApply.value = true
    return
  }
  doApply(tpl)
}

function doApply(tpl: SlideTemplate): void {
  applyTemplateToCurrent(tpl.key)
  toast.add({ title: t('templates.applied'), description: t('templates.appliedDesc', { title: tpl.title }), color: 'success' })
}

function confirmApplyTemplate(): void {
  if (!pendingTemplate.value) return
  doApply(pendingTemplate.value)
  pendingTemplate.value = null
  confirmApply.value = false
}

function frameH(): number {
  return currentSlide.value.layers?.[0]?.transform.h ?? frame.value.h
}

function removeType(type: SlideLayer['type']): void {
  const layers = currentSlide.value.layers
  if (!layers) return
  const idx = layers.findIndex(l => l.type === type)
  if (idx !== -1) removeLayer(layers[idx]!.id)
}

function applyBackdrop(build: () => SlideLayer): void {
  const layer = setDesignLayer('background', () => build() as Parameters<typeof setDesignLayer>[1])
  if (layer) toast.add({ title: t('design.applied'), description: t('design.backdrop'), color: 'success' })
}

function applyBackdropColor(color: string): void {
  applyBackdrop(() => ({
    name: 'Background',
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x: 0, y: 0, w: FRAME_W, h: frameH(), rotate: 0 },
    fill: { kind: 'color', color },
  }))
}

function applyBackdropGradient(spec: { gradient: NonNullable<BackdropPreset['gradient']> }): void {
  applyBackdrop(() => ({
    name: 'Background',
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x: 0, y: 0, w: FRAME_W, h: frameH(), rotate: 0 },
    fill: { kind: 'gradient', gradient: spec.gradient },
  }))
}

function applyBackdropPreset(preset: BackdropPreset): void {
  if (preset.gradient) {
    applyBackdropGradient({ gradient: preset.gradient })
  } else if (preset.image) {
    applyBackdrop(() => ({
      name: 'Background',
      visible: true,
      locked: false,
      opacity: 1,
      transform: { x: 0, y: 0, w: FRAME_W, h: frameH(), rotate: 0 },
      fill: { kind: 'image', src: preset.image as string, fit: 'fill', dim: 0 },
    }))
  }
}

function applyFrame(key: string): void {
  if (key === 'none') { removeType('frame'); return }
  setDesignLayer('frame', () => ({
    key,
    name: 'Frame',
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x: 0, y: 0, w: FRAME_W, h: frameH(), rotate: 0 },
    color: '#ffffff',
    color2: '#f97316',
    thickness: 12,
  }))
}

function applyOverlay(key: string): void {
  if (key === 'none') { removeType('overlay'); return }
  setDesignLayer('overlay', () => ({
    key,
    name: 'Overlay',
    visible: true,
    locked: false,
    opacity: 0.8,
    transform: { x: 0, y: 0, w: FRAME_W, h: frameH(), rotate: 0 },
  }))
}

function applyEffect(key: string): void {
  if (key === 'none') { removeType('effect'); return }
  setDesignLayer('effect', () => ({
    key,
    name: 'Effect',
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x: 0, y: 0, w: FRAME_W, h: frameH(), rotate: 0 },
  }))
}

function applyPattern(key: string): void {
  if (key === 'none') { removeType('pattern'); return }
  setDesignLayer('pattern', () => ({
    key,
    name: 'Pattern',
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x: 0, y: 0, w: FRAME_W, h: frameH(), rotate: 0 },
    color: palette.value.text,
    opacity: 0.08,
  }))
}

function isFrameActive(key: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const has = currentSlide.value.layers?.some(l => l.type === 'frame' && (l as any).key === key) ?? false
  if (key === 'none') return !currentSlide.value.layers?.some(l => l.type === 'frame')
  return has
}
function isOverlayActive(key: string): boolean {
  if (key === 'none') return !currentSlide.value.layers?.some(l => l.type === 'overlay')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return currentSlide.value.layers?.some(l => l.type === 'overlay' && (l as any).key === key) ?? false
}
function isEffectActive(key: string): boolean {
  if (key === 'none') return !currentSlide.value.layers?.some(l => l.type === 'effect')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return currentSlide.value.layers?.some(l => l.type === 'effect' && (l as any).key === key) ?? false
}
function isPatternActive(key: string): boolean {
  if (key === 'none') return !currentSlide.value.layers?.some(l => l.type === 'pattern')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return currentSlide.value.layers?.some(l => l.type === 'pattern' && (l as any).key === key) ?? false
}

function patternThumb(key: string, color: string): Record<string, string> {
  if (key === 'none') return { backgroundImage: 'none' }
  const def = CAROUSEL_PATTERNS.find(p => p.key === key)!
  return { backgroundImage: def.css(color), backgroundSize: '10px 10px', opacity: '0.55' }
}

// ── Custom slide templates ───────────────────────────────────────────────
const CUSTOM_SLIDE_TEMPLATES_KEY = 'carousel-custom-slide-templates'
const customSlideTemplates = ref<SlideTemplate[]>([])
const showCreateTemplateModal = ref(false)
const createTemplateName = ref('')
const createTemplateDesc = ref('')

if (import.meta.client) {
  try {
    const raw = localStorage.getItem(CUSTOM_SLIDE_TEMPLATES_KEY)
    if (raw) customSlideTemplates.value = JSON.parse(raw) as SlideTemplate[]
  } catch { void 0 }
}

function persistCustomSlideTemplates(): void {
  if (!import.meta.client) return
  try {
    localStorage.setItem(CUSTOM_SLIDE_TEMPLATES_KEY, JSON.stringify(customSlideTemplates.value.slice(0, 30)))
  } catch { void 0 }
}

const allSlideTemplates = computed<SlideTemplate[]>(() => [
  ...customSlideTemplates.value,
  ...CAROUSEL_SLIDE_TEMPLATES,
])

function saveCurrentSlideAsTemplate(): void {
  if (!createTemplateName.value.trim()) {
    toast.add({ title: t('design.templateNameRequired'), color: 'warning' })
    return
  }
  const key = createTemplateName.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `custom-${Date.now().toString(36)}`
  if ([...CAROUSEL_SLIDE_TEMPLATES, ...customSlideTemplates.value].some(t => t.key === key)) {
    toast.add({ title: t('design.templateExists'), color: 'warning' })
    return
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layers = currentSlide.value.layers ? JSON.parse(JSON.stringify(currentSlide.value.layers)).map((l: any) => { const { id, ...rest } = l; return rest }) : []
  const tpl: SlideTemplate = {
    kind: 'layers',
    key,
    title: createTemplateName.value.trim(),
    description: createTemplateDesc.value.trim() || 'Custom template',
    category: 'content',
    layers,
  } as SlideTemplate
  customSlideTemplates.value.unshift(tpl)
  persistCustomSlideTemplates()
  showCreateTemplateModal.value = false
  createTemplateName.value = ''
  createTemplateDesc.value = ''
  toast.add({ title: t('design.templateSaved'), description: t('design.templateSavedDesc', { title: tpl.title }), color: 'success' })
}

function removeCustomSlideTemplate(key: string): void {
  customSlideTemplates.value = customSlideTemplates.value.filter(t => t.key !== key)
  persistCustomSlideTemplates()
  toast.add({ title: t('design.templateRemoved'), color: 'neutral' })
}
</script>

<template>
  <div class="space-y-3" data-testid="design-tabs">
    <div class="grid grid-cols-3 gap-1" role="tablist" data-testid="design-tab-bar"
      :aria-label="t('design.label')">
      <button v-for="item in TAB_ITEMS" :key="item.value" type="button" role="tab"
        :data-state="activeTab === item.value ? 'active' : 'inactive'"
        :aria-selected="activeTab === item.value"
        class="flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors"
        :class="activeTab === item.value ? 'bg-primary text-primary-foreground' : 'text-muted hover:bg-muted hover:text-default'"
        :data-testid="`design-tab-${item.value}`"
        @click="() => activeTab = item.value as typeof activeTab">
        <UIcon :name="item.icon" class="size-3.5" />
        <span class="leading-tight text-center">{{ item.label }}</span>
      </button>
    </div>

    <!-- Templates -->
    <div v-if="activeTab === 'templates'" class="space-y-2" data-testid="design-templates">
      <p class="text-[11px] text-muted leading-relaxed">{{ t('design.templatesHint') }}</p>
      <div class="flex gap-1.5">
        <UButton size="xs" color="primary" variant="soft" icon="i-lucide-plus" :label="t('design.createTemplate')" data-testid="btn-create-template" @click="() => showCreateTemplateModal = true" />
        <UButton v-if="customSlideTemplates.length" size="xs" color="neutral" variant="ghost" :label="t('design.manageTemplates')" @click="() => { /* scroll to custom */ }" />
      </div>
      <div class="grid grid-cols-2 gap-2 max-h-[430px] overflow-y-auto pr-1" data-testid="design-templates-grid">
        <div v-for="tpl in allSlideTemplates" :key="tpl.key" class="group relative">
          <button type="button"
            :data-testid="`slide-template-${tpl.key}`" :title="tpl.description"
            :data-active="currentSlide.templateKey === tpl.key"
            :aria-label="`${t('style.layout')}: ${tpl.title}`"
            class="w-full relative rounded-lg overflow-hidden border text-left transition-colors"
            :class="currentSlide.templateKey === tpl.key ? 'border-primary ring-2 ring-primary/50' : 'border-default hover:border-primary/50'"
            @click="() => handleTemplateClick(tpl)">
            <span class="block relative aspect-[4/5] bg-muted overflow-hidden">
              <span class="absolute top-0 left-0 origin-top-left pointer-events-none block"
                :style="{ width: '1080px', height: '1350px', transform: 'scale(0.135)' }"
                v-html="previewHtml(tpl)" />
            </span>
            <span class="flex items-center justify-between gap-1 px-1.5 py-1">
              <span class="text-[10px] font-medium text-default truncate">{{ tpl.title }}</span>
              <span class="shrink-0 text-[8px] uppercase tracking-wide px-1 rounded"
                :class="tpl.kind === 'html' ? 'bg-neutral-500/20 text-muted' : 'bg-primary/15 text-primary'">
                {{ tpl.kind === 'html' ? 'HTML' : 'Layers' }}
              </span>
            </span>
          </button>
          <UButton v-if="customSlideTemplates.some(c => c.key === tpl.key)" size="2xs" color="error" variant="ghost" icon="i-lucide-trash-2"
            class="absolute top-1 right-1 bg-black/60 backdrop-blur rounded-full" :data-testid="`btn-delete-template-${tpl.key}`"
            @click.stop="() => removeCustomSlideTemplate(tpl.key)" />
        </div>
      </div>
      <UModal v-model:open="showCreateTemplateModal" :title="t('design.createTemplateTitle')" :description="t('design.createTemplateDesc')" :ui="{ overlay: 'bg-black/60' }">
        <template #body>
          <div class="space-y-3">
            <UFormField :label="t('design.templateName')" size="xs">
              <UInput v-model="createTemplateName" :placeholder="t('design.templateNamePlaceholder')" class="w-full" data-testid="create-template-name" />
            </UFormField>
            <UFormField :label="t('design.templateDesc')" size="xs">
              <UInput v-model="createTemplateDesc" :placeholder="t('design.templateDescPlaceholder')" class="w-full" data-testid="create-template-desc" />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton color="neutral" variant="ghost" :label="t('templates.cancel')" @click="() => showCreateTemplateModal = false" />
            <UButton color="primary" :label="t('design.createTemplateConfirm')" data-testid="btn-confirm-create-template" @click="saveCurrentSlideAsTemplate" />
          </div>
        </template>
      </UModal>
    </div>

    <!-- Backdrops -->
    <div v-else-if="activeTab === 'backdrops'" class="space-y-3" data-testid="design-backdrops">
      <p class="text-[11px] text-muted leading-relaxed">{{ t('design.backdropsHint') }}</p>
      <div class="grid grid-cols-4 gap-1.5">
        <button v-for="preset in PALETTES" :key="`solid-${preset.name}`" type="button"
          class="h-10 rounded-md border border-default hover:border-primary/60 transition-colors"
          :title="preset.name" :data-testid="`backdrop-solid-${preset.name.toLowerCase()}`"
          @click="() => applyBackdropColor(preset.bg)">
          <span class="block h-full w-full rounded-md" :style="{ background: preset.bg }" />
        </button>
        <button type="button" class="h-10 rounded-md border border-default hover:border-primary/60 transition-colors"
          title="White" data-testid="backdrop-solid-white" @click="() => applyBackdropColor('#ffffff')">
          <span class="block h-full w-full rounded-md bg-white" />
        </button>
        <button type="button" class="h-10 rounded-md border border-default hover:border-primary/60 transition-colors"
          title="Black" data-testid="backdrop-solid-black" @click="() => applyBackdropColor('#000000')">
          <span class="block h-full w-full rounded-md bg-black" />
        </button>
      </div>

      <p class="text-[10px] font-semibold uppercase tracking-wider text-muted">{{ t('design.gradients') }}</p>
      <div class="grid grid-cols-3 gap-1.5">
        <button v-for="g in BACKDROP_GRADIENTS" :key="g.key" type="button"
          class="aspect-[4/3] rounded-md border border-default hover:border-primary/60 transition-transform hover:scale-105"
          :title="g.label" :data-testid="`backdrop-gradient-${g.key}`"
          @click="() => applyBackdropPreset(g)">
          <span class="block h-full w-full rounded-md" :style="{ background: g.css() }" />
        </button>
      </div>

      <p class="text-[10px] font-semibold uppercase tracking-wider text-muted">{{ t('design.textures') }}</p>
      <div class="grid grid-cols-3 gap-1.5">
        <button v-for="tx in BACKDROP_TEXTURES" :key="tx.key" type="button"
          class="aspect-[4/3] rounded-md border border-default hover:border-primary/60 transition-transform hover:scale-105"
          :title="tx.label" :data-testid="`backdrop-texture-${tx.key}`"
          @click="() => applyBackdropPreset(tx)">
          <span class="block h-full w-full rounded-md" :style="{ background: tx.css('#9ca3af'), backgroundSize: '12px 12px' }" />
        </button>
      </div>
      <p class="text-[10px] text-muted">{{ t('design.backdropCustomHint') }}</p>
    </div>

    <!-- Frames -->
    <div v-else-if="activeTab === 'frames'" class="space-y-2" data-testid="design-frames">
      <p class="text-[11px] text-muted leading-relaxed">{{ t('design.framesHint') }}</p>
      <div class="grid grid-cols-3 gap-1.5">
        <button v-for="f in FRAMES" :key="f.key" type="button"
          :data-testid="`frame-${f.key}`" :data-active="isFrameActive(f.key)"
          class="relative aspect-[4/3] rounded-md border overflow-hidden transition-transform hover:scale-105"
          :class="isFrameActive(f.key) ? 'ring-2 ring-primary border-transparent' : 'border-default'"
          :title="f.label" @click="() => applyFrame(f.key)">
          <span class="absolute inset-0 bg-gradient-to-br from-indigo-500 to-fuchsia-500"
            :style="f.thumb ? { border: '5px solid rgba(255,255,255,0.85)' } : {}" />
        </button>
      </div>
    </div>

    <!-- Overlays -->
    <div v-else-if="activeTab === 'overlays'" class="space-y-2" data-testid="design-overlays">
      <p class="text-[11px] text-muted leading-relaxed">{{ t('design.overlaysHint') }}</p>
      <div class="grid grid-cols-3 gap-1.5">
        <button v-for="o in OVERLAYS" :key="o.key" type="button"
          :data-testid="`overlay-${o.key}`" :data-active="isOverlayActive(o.key)"
          class="relative aspect-[4/3] rounded-md border overflow-hidden transition-transform hover:scale-105"
          :class="isOverlayActive(o.key) ? 'ring-2 ring-primary border-transparent' : 'border-default'"
          :title="o.label" @click="() => applyOverlay(o.key)">
          <span class="absolute inset-0 bg-gradient-to-br from-orange-300 to-rose-400"
            :style="o.thumb ? { background: o.css('#000000') } : {}" />
        </button>
      </div>
    </div>

    <!-- Effects -->
    <div v-else-if="activeTab === 'effects'" class="space-y-2" data-testid="design-effects">
      <p class="text-[11px] text-muted leading-relaxed">{{ t('design.effectsHint') }}</p>
      <div class="grid grid-cols-3 gap-1.5">
        <button v-for="ef in EFFECTS" :key="ef.key" type="button"
          :data-testid="`effect-${ef.key}`" :data-active="isEffectActive(ef.key)"
          class="relative aspect-[4/3] rounded-md border overflow-hidden transition-transform hover:scale-105"
          :class="isEffectActive(ef.key) ? 'ring-2 ring-primary border-transparent' : 'border-default'"
          :title="ef.label" @click="() => applyEffect(ef.key)">
          <span class="absolute inset-0 bg-gradient-to-br from-orange-400 via-rose-400 to-indigo-500"
            :style="ef.filter ? { filter: ef.filter } : {}" />
        </button>
      </div>
    </div>

    <!-- Patterns -->
    <div v-else-if="activeTab === 'patterns'" class="space-y-2" data-testid="design-patterns">
      <p class="text-[11px] text-muted leading-relaxed">{{ t('design.patternsHint') }}</p>
      <div class="grid grid-cols-6 gap-1.5">
        <button v-for="p in CAROUSEL_PATTERNS" :key="p.key" type="button"
          :data-testid="`design-pattern-${p.key}`" :data-active="isPatternActive(p.key)"
          class="relative aspect-square rounded-md border overflow-hidden transition-transform hover:scale-105"
          :class="isPatternActive(p.key) ? 'ring-2 ring-primary border-transparent' : 'border-default'"
          :title="p.key" @click="() => applyPattern(p.key)">
          <span class="absolute inset-0" :style="patternThumb(p.key, palette.text)" />
        </button>
      </div>
    </div>

    <!-- Confirm replace -->
    <UModal v-model:open="confirmApply" :title="t('templates.confirmTitle')"
      :description="pendingTemplate ? t('templates.confirmReplace', { title: pendingTemplate.title }) : undefined">
      <template #body>
        <p class="text-sm text-muted">{{ t('templates.confirmBody') }}</p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" :label="t('templates.cancel')" @click="() => confirmApply = false" />
          <UButton color="primary" :label="t('templates.confirm')" data-testid="btn-confirm-template"
            @click="confirmApplyTemplate" />
        </div>
      </template>
    </UModal>
  </div>
</template>
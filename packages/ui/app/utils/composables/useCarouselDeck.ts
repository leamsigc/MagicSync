/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-empty */
import { domToPng } from 'modern-screenshot'
import { parseJsonArray } from '#layers/BaseShared/utils/json';
import {
  CAROUSEL_TEMPLATES,
  DEFAULT_FLOW,
  flowLayer,
  renderSlideHtml,
  type BgImageLayer,
  type DeckFlow,
  type ImageTransform,
  type SlideData,
  type SlidePalette,
} from '../carouselTemplates'
import { CAROUSEL_DECK_TEMPLATES, type DeckTemplate } from '../deckTemplates'
import { patternStyle } from '../patterns'
import { renderSlideLayers, type RenderPalette } from '../layers/render'
import { migrateLegacySlide } from '../layers/legacy'
import { instantiateSlideTemplateByKey, findSlideTemplate } from '../slideTemplates'
import type { LayerSpec, SlideLayer } from '../layers/types'
import { createLayerId, FRAME_W } from '../layers/types'

export const MAX_CAROUSEL_SLIDES = 10

export interface CarouselSlide {
  id: string
  templateKey: string
  data: SlideData
  pattern: string
  patternColor: string
  patternOpacity: number
  bgImage: BgImageLayer | null
  customHtml: string
  /** Layer-based content. When absent the slide renders through the legacy path. */
  layers?: SlideLayer[]
}

export interface DeckPalette {
  bg: string
  text: string
  accent: string
  font?: string
}

export interface DeckFrame {
  w: number
  h: number
}

export const FRAME_PRESETS: Record<'portrait' | 'square', DeckFrame & { key: string }> = {
  portrait: { key: 'portrait', w: 1080, h: 1350 },
  square: { key: 'square', w: 1080, h: 1080 },
}

export interface DeckFx {
  rotate: number
  zoom: number
}

export function fxStyle(fx: DeckFx): string {
  const parts: string[] = []
  if (fx.rotate) parts.push(`rotate(${fx.rotate}deg)`)
  if (fx.zoom !== 100) parts.push(`scale(${fx.zoom / 100})`)
  return parts.join(' ') || 'none'
}

export interface AiDesignResult {
  palette: DeckPalette
  slides: Array<{ template: string, html?: string } & SlideData>
}

export const DEFAULT_PALETTE: DeckPalette = {
  bg: '#0f0e0d',
  text: '#fafaf9',
  accent: '#f97316',
}

export interface AiDeckTemplate extends DeckTemplate {
  isAi?: boolean
  createdAt?: string
}

function createId(): string {
  return `slide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function renderPalette(): RenderPalette {
  return {
    bg: palette.value.bg,
    text: palette.value.text,
    accent: palette.value.accent,
    font: palette.value.font,
  }
}

function ensureLayers(slide: CarouselSlide): SlideLayer[] {
  if (!slide.layers) {
    slide.layers = migrateLegacySlide(slide, palette.value, frame.value.h)
  }
  return slide.layers
}

function blankSlide(templateKey?: string, deterministicIds = false): CarouselSlide {
  const base: CarouselSlide = {
    id: createId(),
    templateKey: templateKey ?? '',
    data: { headline: 'Your headline here', body: '', borderRadius: 0 },
    pattern: 'dots',
    patternColor: '#ffffff',
    patternOpacity: 0.08,
    bgImage: null,
    customHtml: '',
  }
  if (templateKey) {
    base.layers = instantiateSlideTemplateByKey(templateKey, palette.value, frame.value.h)
  } else {
    base.layers = [
      {
        id: createLayerId(),
        type: 'background',
        name: 'Background',
        visible: true,
        locked: false,
        opacity: 1,
        transform: { x: 0, y: 0, w: FRAME_W, h: frame.value.h, rotate: 0 },
        fill: { kind: 'color', color: palette.value.bg },
      },
      {
        id: createLayerId(),
        type: 'text',
        name: 'Headline',
        visible: true,
        locked: false,
        opacity: 1,
        transform: { x: 90, y: 420, w: 900, h: 320, rotate: 0 },
        content: 'Your headline here',
        font: 'Arial',
        fontSize: 88,
        fontWeight: 900,
        align: 'left',
        lineHeight: 1.1,
        letterSpacing: 0,
        color: palette.value.text,
      },
    ]
  }
  if (deterministicIds) {
    base.layers.forEach((l, i) => { l.id = `layer-${i}` })
  }
  if (!base.layers.length) {
    base.layers = [
      {
        id: createLayerId(),
        type: 'background',
        name: 'Background',
        visible: true,
        locked: false,
        opacity: 1,
        transform: { x: 0, y: 0, w: FRAME_W, h: frame.value.h, rotate: 0 },
        fill: { kind: 'color', color: palette.value.bg },
      },
      {
        id: createLayerId(),
        type: 'text',
        name: 'Headline',
        visible: true,
        locked: false,
        opacity: 1,
        transform: { x: 90, y: 420, w: 900, h: 320, rotate: 0 },
        content: 'Your headline here',
        font: 'Arial',
        fontSize: 88,
        fontWeight: 900,
        align: 'left',
        lineHeight: 1.1,
        letterSpacing: 0,
        color: palette.value.text,
      },
    ]
  }
  return base
}

const palette = ref<DeckPalette>({ ...DEFAULT_PALETTE })
const flow = ref<DeckFlow>({ ...DEFAULT_FLOW })
const handle = ref('')
const frame = ref<DeckFrame>({ ...FRAME_PRESETS.portrait })
const fx = ref<DeckFx>({ rotate: 0, zoom: 100 })
const exporting = ref(false)
const exportProgress = ref('')

const slides = ref<CarouselSlide[]>([blankSlide('layer-minimal-dots', true)])
const currentIndex = ref(0)
const selectedLayerId = ref<string | null>(null)
const showFromImageModal = ref(false)
const showFromHtmlModal = ref(false)

const slicedImageGroup = computed(() => {
    const target = findSlicedTarget()
    if (!target) return null
    let start = -1
    let end = -1
    let count = 1
    for (let i = 0; i < slides.value.length; i++) {
      const bg = slicedBackgroundAt(i)
      if (bg && bg.fill.src === target.src) {
        if (start === -1) start = i
        end = i
        count = bg.fill.slice.count
        target.direction = bg.fill.slice.direction
      } else if (start !== -1) {
        break
      }
    }
    if (start === -1) return null
    return { src: target.src, count, direction: target.direction!, startIndex: start, endIndex: end, length: end - start + 1 }
  })

  function slicedBackgroundAt(index: number): any {
    return slides.value[index]?.layers?.find(l => l.type === 'background' && (l as any).fill?.kind === 'image' && (l as any).fill.slice) as any ?? null
  }

  function findSlicedTarget(): { src: string, direction: 'vertical' | 'horizontal' | null } | null {
    const currentBg = slicedBackgroundAt(currentIndex.value)
    if (currentBg) {
      return { src: currentBg.fill.src, direction: currentBg.fill.slice.direction }
    }
    for (let i = 0; i < slides.value.length; i++) {
      const bg = slicedBackgroundAt(i)
      if (bg) {
        return { src: bg.fill.src, direction: bg.fill.slice.direction }
      }
    }
    return null
  }

if (import.meta.client) {
  ;(window as any).__slicedGroup = slicedImageGroup
  ;(window as any).__slides = slides
  ;(window as any).__currentIndex = currentIndex
}

function updateSlicedImageCount(newCount: number): void {
    const group = slicedImageGroup.value
    if (!group) return
    newCount = Math.min(Math.max(Math.round(newCount), 1), 9)
    const oldCount = group.count
    if (newCount === oldCount) return
    if (newCount > oldCount) {
      newCount = growSlicedGroup(group, oldCount, newCount)
      if (newCount === oldCount) return
    }
    retagSlicedGroup(group, Math.min(oldCount, newCount), newCount)
    if (newCount > oldCount) {
      const batch = buildSliceSlides(group.src, group.direction, newCount, oldCount)
      slides.value.splice(group.startIndex + oldCount, 0, ...batch)
    } else {
      shrinkSlicedGroup(group, newCount, oldCount)
    }
  }

  function growSlicedGroup(group: { startIndex: number, count: number, length: number }, oldCount: number, newCount: number): number {
    const delta = newCount - oldCount
    if (slides.value.length + delta > MAX_CAROUSEL_SLIDES) {
      return oldCount + (MAX_CAROUSEL_SLIDES - slides.value.length)
    }
    return newCount
  }

  function retagSlicedGroup(group: { startIndex: number }, upTo: number, newCount: number): void {
    for (let i = 0; i < upTo; i++) {
      const bg = slicedBackgroundAt(group.startIndex + i)
      if (bg) {
        bg.fill.slice.count = newCount
        bg.fill.slice.index = i
      }
    }
  }

  function buildSliceSlides(src: string, direction: string, newCount: number, oldCount: number): CarouselSlide[] {
    const batch: CarouselSlide[] = []
    const group = slicedImageGroup.value
    const template = group ? slides.value[group.startIndex] : undefined
    const templateBg = template?.layers?.find(l => l.type === 'background' && (l as any).fill?.kind === 'image' && (l as any).fill.slice) as any
    const templateBackdrop = template?.layers?.find(l => l.type === 'background' && (l as any).fill?.kind === 'color') as any
    const pad = templateBg?.transform?.x ?? 0
    for (let i = oldCount; i < newCount; i++) {
      const slide = blankSlide()
      const layers: SlideLayer[] = []
      if (templateBackdrop) {
        layers.push({
          id: createLayerId(),
          type: 'background',
          name: 'Backdrop',
          visible: true,
          locked: false,
          opacity: 1,
          transform: { x: 0, y: 0, w: FRAME_W, h: frame.value.h, rotate: 0 },
          fill: { kind: 'color', color: templateBackdrop.fill.color },
        })
      }
      layers.push({
        id: createLayerId(),
        type: 'background',
        name: 'Image slice',
        visible: true,
        locked: false,
        opacity: 1,
        transform: { x: pad, y: pad, w: FRAME_W - pad * 2, h: frame.value.h - pad * 2, rotate: 0 },
        fill: { kind: 'image', src, fit: 'cover', dim: 0, slice: { count: newCount, index: i, direction: direction as 'vertical' | 'horizontal' } },
      })
      layers.push({
        id: createLayerId(),
        type: 'text',
        name: 'Caption',
        visible: true,
        locked: false,
        opacity: 1,
        transform: { x: 80 + pad * 0.5, y: 1120 - pad * 0.3, w: 920 - pad, h: 140, rotate: 0 },
        content: '',
        font: 'Arial',
        fontSize: 44,
        fontWeight: 800,
        align: 'left',
        lineHeight: 1.2,
        letterSpacing: 0,
        color: '#ffffff',
      })
      slide.layers = layers as SlideLayer[]
      batch.push(slide)
    }
    return batch
  }

  function shrinkSlicedGroup(group: { startIndex: number }, newCount: number, oldCount: number): void {
    slides.value.splice(group.startIndex + newCount, oldCount - newCount)
    if (currentIndex.value >= slides.value.length) currentIndex.value = slides.value.length - 1
    if (currentIndex.value >= group.startIndex + newCount && currentIndex.value < group.startIndex + oldCount) {
      currentIndex.value = group.startIndex + newCount - 1
    }
  }

const CUSTOM_DECKS_KEY = 'carousel-ai-decks'
const customDecks = ref<AiDeckTemplate[]>([])

if (import.meta.client) {
  try {
    const raw = localStorage.getItem(CUSTOM_DECKS_KEY)
    if (raw) customDecks.value = parseJsonArray<AiDeckTemplate>(raw)
  } catch {}
}

function persistCustomDecks(): void {
  if (!import.meta.client) return
  try {
    localStorage.setItem(CUSTOM_DECKS_KEY, JSON.stringify(customDecks.value.slice(0, 30)))
  } catch {}
}

const allDeckTemplates = computed<DeckTemplate[]>(() => [
  ...customDecks.value,
  ...CAROUSEL_DECK_TEMPLATES,
])

if (import.meta.client) {
  interface WindowWithDeckLoads extends Window {
    __CAROUSEL_DECK_LOADS__?: number
  }
  const w = window as WindowWithDeckLoads
  w.__CAROUSEL_DECK_LOADS__ = (w.__CAROUSEL_DECK_LOADS__ ?? 0) + 1
}

export function useCarouselDeck() {

  const currentSlide = computed(() => slides.value[currentIndex.value] ?? slides.value[0]!)

  const selectedLayer = computed(() => {
    const layers = currentSlide.value.layers
    if (!layers) return null
    return layers.find(l => l.id === selectedLayerId.value) ?? null
  })

  function currentLayers(): SlideLayer[] {
    return ensureLayers(currentSlide.value)
  }

  function selectLayer(id: string | null): void {
    if (id === null) { selectedLayerId.value = null; return }
    if (currentSlide.value.layers?.some(l => l.id === id)) {
      selectedLayerId.value = id
    } else {
      selectedLayerId.value = null
    }
  }

  function addLayer(spec?: Partial<LayerSpec>): SlideLayer {
    const layers = currentLayers()
    const layer = {
      id: createLayerId(),
      type: 'text',
      name: 'Text',
      visible: true,
      locked: false,
      opacity: 1,
      transform: { x: 100, y: 200, w: 680, h: 140, rotate: 0 },
      content: 'New text',
      font: 'Arial',
      fontSize: 48,
      fontWeight: 700,
      align: 'left',
      lineHeight: 1.2,
      letterSpacing: 0,
      color: palette.value.text,
      ...spec,
    } as SlideLayer
    layers.push(layer)
    selectedLayerId.value = layer.id
    return layer
  }

  function updateLayer(id: string, patch: Partial<SlideLayer>): void {
    const layers = currentSlide.value.layers
    if (!layers) return
    const idx = layers.findIndex(l => l.id === id)
    if (idx === -1) return
    layers[idx] = { ...layers[idx], ...patch } as SlideLayer
  }

  function updateLayerTransform(id: string, patch: Partial<SlideLayer['transform']>): void {
    const layers = currentSlide.value.layers
    if (!layers) return
    const layer = layers.find(l => l.id === id)
    if (!layer) return
    layer.transform = { ...layer.transform, ...patch }
  }

  function removeLayer(id: string): void {
    const layers = currentSlide.value.layers
    if (!layers) return
    const idx = layers.findIndex(l => l.id === id)
    if (idx === -1) return
    layers.splice(idx, 1)
    if (selectedLayerId.value === id) selectedLayerId.value = null
  }

  function duplicateLayer(id: string): void {
    const layers = currentSlide.value.layers
    if (!layers) return
    const idx = layers.findIndex(l => l.id === id)
    if (idx === -1) return
    const copy = JSON.parse(JSON.stringify(layers[idx])) as SlideLayer
    copy.id = createLayerId()
    copy.name = `${copy.name} copy`
    copy.transform = { ...copy.transform, x: copy.transform.x + 40, y: copy.transform.y + 40 }
    layers.splice(idx + 1, 0, copy)
    selectedLayerId.value = copy.id
  }

  function moveLayer(id: string, direction: -1 | 1): void {
    const layers = currentSlide.value.layers
    if (!layers) return
    const idx = layers.findIndex(l => l.id === id)
    const target = idx + direction
    if (idx === -1 || target < 0 || target >= layers.length) return
    const [moved] = layers.splice(idx, 1)
    layers.splice(target, 0, moved!)
  }

  function reorderLayer(id: string, toIndex: number): void {
    const layers = currentSlide.value.layers
    if (!layers) return
    const from = layers.findIndex(l => l.id === id)
    if (from === -1) return
    const clamped = Math.min(Math.max(toIndex, 0), layers.length - 1)
    if (from === clamped) return
    const [moved] = layers.splice(from, 1)
    layers.splice(clamped, 0, moved!)
  }

  function setDesignLayer(type: SlideLayer['type'], build: () => Omit<SlideLayer, 'id' | 'type' | 'name'> & { name?: string }): SlideLayer | null {
    const layers = currentLayers()
    const existing = layers.findIndex(l => l.type === type)
    const spec = build()
    const layer = { ...spec, id: createLayerId(), type, name: spec.name ?? type } as SlideLayer
    if (existing !== -1) {
      layers[existing] = layer
    } else {
      layers.push(layer)
    }
    selectedLayerId.value = layer.id
    return layer
  }

  function migrateAllSlides(): void {
    for (const slide of slides.value) {
      ensureLayers(slide)
    }
  }

  function slideHtml(slide: CarouselSlide, index: number, total: number): string {
    if (slide.layers) {
      const backgroundOverride = flow.value.mode !== 'off'
        ? (i: number, t: number) => flowLayer(flow.value, i, t)
        : undefined
      return renderSlideLayers(slide.layers, frame.value, renderPalette(), {
        index,
        total,
        handle: handle.value,
        backgroundOverride,
      })
    }
    if (slide.customHtml) return slide.customHtml
    const fullPalette: SlidePalette = {
      bg: palette.value.bg,
      text: palette.value.text,
      accent: palette.value.accent,
      patternColor: slide.patternColor,
      font: palette.value.font,
    }
    const patternHtml = `<div style="position:absolute;inset:0;${Object.entries(patternStyle(slide.pattern, slide.patternColor, slide.patternOpacity)).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`).join(';')}"></div>`
    return renderSlideHtml(slide.templateKey, slide.data, fullPalette, index, total, patternHtml, slide.bgImage ?? undefined, flow.value, handle.value)
  }

  function currentHtml(): string {
    return slideHtml(currentSlide.value, currentIndex.value, slides.value.length)
  }

  function addSlide(templateKey?: string): void {
    if (slides.value.length >= MAX_CAROUSEL_SLIDES) return
    const slide = blankSlide(templateKey)
    slides.value.push(slide)
    currentIndex.value = slides.value.length - 1
    selectedLayerId.value = null
  }

  function insertSlideAt(index: number, templateKey?: string, data?: Partial<SlideData>): void {
    if (slides.value.length >= MAX_CAROUSEL_SLIDES) return
    const slide = blankSlide(templateKey)
    if (data) slide.data = { ...slide.data, ...data }
    const at = Math.min(Math.max(index, 0), slides.value.length)
    slides.value.splice(at, 0, slide)
    currentIndex.value = at
    selectedLayerId.value = null
  }

  function addHtmlSlide(html: string): void {
    if (slides.value.length >= MAX_CAROUSEL_SLIDES) return
    const slide = blankSlide()
    slide.layers = [
      {
        id: createLayerId(),
        type: 'background',
        name: 'Background',
        visible: true,
        locked: false,
        opacity: 1,
        transform: { x: 0, y: 0, w: FRAME_W, h: frame.value.h, rotate: 0 },
        fill: { kind: 'color', color: palette.value.bg },
      },
      {
        id: createLayerId(),
        type: 'html',
        name: 'Custom HTML',
        visible: true,
        locked: false,
        opacity: 1,
        transform: { x: 0, y: 0, w: FRAME_W, h: frame.value.h, rotate: 0 },
        html,
      },
    ]
    slides.value.push(slide)
    currentIndex.value = slides.value.length - 1
    selectedLayerId.value = null
  }

  function addImageSlicesSlide(imageUrl: string, count: number, direction: 'vertical' | 'horizontal', opts?: { padding?: number, backdropColor?: string }): void {
    const n = Math.min(Math.max(count, 1), 9)
    const room = MAX_CAROUSEL_SLIDES - slides.value.length
    const actual = Math.min(n, room)
    if (actual <= 0) return
    const pad = Math.max(0, Math.min(80, opts?.padding ?? 0))
    const hasBackdrop = !!(opts?.backdropColor && opts.backdropColor !== 'transparent')
    const batch: CarouselSlide[] = []
    for (let i = 0; i < actual; i++) {
      const slide = blankSlide()
      const layers: SlideLayer[] = []
      if (hasBackdrop) {
        layers.push({
          id: createLayerId(),
          type: 'background',
          name: 'Backdrop',
          visible: true,
          locked: false,
          opacity: 1,
          transform: { x: 0, y: 0, w: FRAME_W, h: frame.value.h, rotate: 0 },
          fill: { kind: 'color', color: opts!.backdropColor! },
        })
      }
      layers.push({
        id: createLayerId(),
        type: 'background',
        name: 'Image slice',
        visible: true,
        locked: false,
        opacity: 1,
        transform: { x: pad, y: pad, w: FRAME_W - pad * 2, h: frame.value.h - pad * 2, rotate: 0 },
        fill: { kind: 'image', src: imageUrl, fit: 'cover', dim: 0, slice: { count: actual, index: i, direction } },
      })
      layers.push({
        id: createLayerId(),
        type: 'text',
        name: 'Caption',
        visible: true,
        locked: false,
        opacity: 1,
        transform: { x: 80 + pad * 0.5, y: 1120 - pad * 0.3, w: 920 - pad, h: 140, rotate: 0 },
        content: '',
        font: 'Arial',
        fontSize: 44,
        fontWeight: 800,
        align: 'left',
        lineHeight: 1.2,
        letterSpacing: 0,
        color: '#ffffff',
      })
      slide.layers = layers as SlideLayer[]
      batch.push(slide)
    }
    slides.value.push(...batch)
    currentIndex.value = slides.value.length - 1
    selectedLayerId.value = null
  }

  function applyDeckTemplate(deckKey: string): void {
    const deck = (allDeckTemplates.value.find(d => d.key === deckKey) ?? CAROUSEL_DECK_TEMPLATES.find(d => d.key === deckKey)) as DeckTemplate | undefined
    if (!deck) return
    const mapped: CarouselSlide[] = deck.slides.map(spec => {
      const base = blankSlide()
      if (spec.layers) {
        base.layers = JSON.parse(JSON.stringify(spec.layers)).map((l: LayerSpec) => ({ ...l, id: createLayerId() }))
      } else if (spec.html) {
        base.layers = [
          {
            id: createLayerId(),
            type: 'background',
            name: 'Background',
            visible: true,
            locked: false,
            opacity: 1,
            transform: { x: 0, y: 0, w: FRAME_W, h: frame.value.h, rotate: 0 },
            fill: { kind: 'color', color: deck.palette.bg },
          },
          {
            id: createLayerId(),
            type: 'html',
            name: 'AI HTML',
            visible: true,
            locked: false,
            opacity: 1,
            transform: { x: 0, y: 0, w: FRAME_W, h: frame.value.h, rotate: 0 },
            html: spec.html,
          },
        ]
      } else {
        base.templateKey = spec.templateKey
        base.data = { ...spec.data, images: spec.data.images ? [...spec.data.images] : undefined }
        base.layers = migrateLegacySlide(base, { ...deck.palette, font: deck.palette.font }, frame.value.h)
      }
      return base
    })
    slides.value = mapped.slice(0, MAX_CAROUSEL_SLIDES)
    applyPalette({ ...deck.palette })
    currentIndex.value = 0
    selectedLayerId.value = null
  }

  function addCustomDeckTemplate(deck: DeckTemplate): void {
    const normalized: AiDeckTemplate = {
      ...deck,
      key: deck.key.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'),
      isAi: true,
      createdAt: new Date().toISOString(),
    }
    // ensure unique key
    let candidate = normalized.key
    let suffix = 1
    const existingKeys = new Set([...CAROUSEL_DECK_TEMPLATES.map(d => d.key), ...customDecks.value.map(d => d.key)])
    while (existingKeys.has(candidate)) {
      candidate = `${normalized.key}-${suffix++}`
    }
    normalized.key = candidate
    customDecks.value.unshift(normalized)
    // keep max 20 ai decks
    if (customDecks.value.length > 20) customDecks.value = customDecks.value.slice(0, 20)
    persistCustomDecks()
  }

  function removeCustomDeck(key: string): void {
    customDecks.value = customDecks.value.filter(d => d.key !== key)
    persistCustomDecks()
  }

  function duplicateSlide(index: number): void {
    if (slides.value.length >= MAX_CAROUSEL_SLIDES) return
    const source = slides.value[index]
    if (!source) return
    const copy: CarouselSlide = JSON.parse(JSON.stringify(source))
    copy.id = createId()
    if (copy.layers) {
      copy.layers = copy.layers.map(l => ({ ...l, id: createLayerId() }))
    }
    slides.value.splice(index + 1, 0, copy)
    currentIndex.value = index + 1
    selectedLayerId.value = null
  }

  function removeSlide(index: number): void {
    if (slides.value.length <= 1) return
    slides.value.splice(index, 1)
    currentIndex.value = Math.min(currentIndex.value, slides.value.length - 1)
    selectedLayerId.value = null
  }

  function moveSlide(index: number, direction: -1 | 1): void {
    const target = index + direction
    if (target < 0 || target >= slides.value.length) return
    const [moved] = slides.value.splice(index, 1)
    slides.value.splice(target, 0, moved!)
    currentIndex.value = target
  }

  function switchTo(index: number): void {
    if (index >= 0 && index < slides.value.length) {
      currentIndex.value = index
      selectedLayerId.value = null
    }
  }

  function nextSlide(): void {
    switchTo(currentIndex.value + 1)
  }

  function prevSlide(): void {
    switchTo(currentIndex.value - 1)
  }

  function migrateAllSlides(): void {
    for (const slide of slides.value) {
      ensureLayers(slide)
    }
  }

  function updateSlideData(patch: Partial<SlideData>): void {
    currentSlide.value.data = { ...currentSlide.value.data, ...patch }
  }

  function setBgImage(url: string | null): void {
    if (!url) {
      currentSlide.value.bgImage = null
      return
    }
    const existing = currentSlide.value.bgImage
    currentSlide.value.bgImage = {
      url,
      dim: existing?.dim ?? 0.25,
      shadow: existing?.shadow ?? { x: 0, y: 18, blur: 45, opacity: 0.45 },
      transform: existing?.transform ?? { x: 0, y: 0, scale: 1 },
    }
  }

  function updateBgTransform(patch: Partial<ImageTransform>): void {
    if (!currentSlide.value.bgImage) return
    const cur = currentSlide.value.bgImage.transform ?? { x: 0, y: 0, scale: 1 }
    currentSlide.value.bgImage = {
      ...currentSlide.value.bgImage,
      transform: { ...cur, ...patch },
    }
  }

  function setGalleryImage(index: number, url: string | null): void {
    const raw = currentSlide.value.data.images
    const imgs = Array.isArray(raw) ? [...raw] : typeof raw === 'string' ? raw.split(/[,\n]/).map(s => s.trim()).filter(Boolean) : []
    while (imgs.length <= index) imgs.push('')
    if (url === null) {
      imgs.splice(index, 1)
    } else {
      imgs[index] = url
    }
    // filter empty trailing? Keep but remove empty strings
    const filtered = imgs.filter(Boolean)
    // Preserve order with at most 4
    updateSlideData({ images: filtered.slice(0, 4) })
  }

  function resetBgTransform(): void {
    if (!currentSlide.value.bgImage) return
    currentSlide.value.bgImage = { ...currentSlide.value.bgImage, transform: { x: 0, y: 0, scale: 1 } }
  }

  function applyTemplateToCurrent(templateKey: string): void {
    const template = findSlideTemplate(templateKey)
    if (!template) return
    const layers = instantiateSlideTemplateByKey(templateKey, palette.value, frame.value.h)
    if (!layers.length) return
    const slide = currentSlide.value
    ensureLayers(slide)
    slide.layers = layers
    slide.templateKey = templateKey
    selectedLayerId.value = null
  }

  function themeValue(value: unknown, map: Record<string, string>): unknown {
    if (typeof value === 'string') return map[value] ?? value
    if (Array.isArray(value)) return value.map(v => themeValue(v, map))
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, themeValue(v, map)]))
    }
    return value
  }

  function themeLayerColorFields(layer: SlideLayer, map: Record<string, string>): void {
    if (layer.type === 'html' || layer.type === 'effect' || layer.type === 'frame' || layer.type === 'overlay') return
    if (layer.type === 'background') {
      themeBackground(layer, map)
      return
    }
    if (layer.type === 'text') {
      themeText(layer, map)
      return
    }
    if (layer.type === 'shape') {
      themeShape(layer, map)
      return
    }
    if (layer.type === 'pattern' && map[layer.color]) {
      layer.color = map[layer.color]!
    }
  }

  function themeBackground(layer: SlideLayer, map: Record<string, string>): void {
    if (layer.type !== 'background') return
    if (layer.fill.kind === 'color' && layer.name === 'Background') {
      layer.fill = { kind: 'color', color: map[layer.fill.color] ?? layer.fill.color }
      return
    }
    if (layer.fill.kind === 'gradient') {
      layer.fill.gradient = themeValue(layer.fill.gradient, map) as typeof layer.fill.gradient
    }
  }

  function themeText(layer: SlideLayer, map: Record<string, string>): void {
    if (layer.type !== 'text') return
    if (layer.color && map[layer.color]) layer.color = map[layer.color]!
    if (layer.gradient) layer.gradient = themeValue(layer.gradient, map) as typeof layer.gradient
    if (layer.bg && map[layer.bg]) layer.bg = map[layer.bg]!
  }

  function themeShape(layer: SlideLayer, map: Record<string, string>): void {
    if (layer.type !== 'shape') return
    if (typeof layer.fill === 'string' && map[layer.fill]) layer.fill = map[layer.fill]!
    else if (typeof layer.fill !== 'string') layer.fill = themeValue(layer.fill, map) as typeof layer.fill
    if (layer.stroke && map[layer.stroke.color]) layer.stroke.color = map[layer.stroke.color]!
  }

  /**
   * Palettes arrive from outside our control (saved carousels, AI designs).
   * A missing bg/text/accent would poison every render (esc(undefined)),
   * so fall back to defaults per field instead of trusting the shape.
   */
  function sanitizePalette(raw: Partial<DeckPalette>): DeckPalette {
    return {
      bg: raw.bg || DEFAULT_PALETTE.bg,
      text: raw.text || DEFAULT_PALETTE.text,
      accent: raw.accent || DEFAULT_PALETTE.accent,
      font: typeof raw.font === 'string' ? raw.font : undefined,
    }
  }

  function applyPalette(newPalette: DeckPalette): void {
    const old = palette.value
    const map: Record<string, string> = {}
    if (old.bg !== newPalette.bg) map[old.bg] = newPalette.bg
    if (old.text !== newPalette.text) map[old.text] = newPalette.text
    if (old.accent !== newPalette.accent) map[old.accent] = newPalette.accent
    palette.value = { ...newPalette }
    for (const slide of slides.value) {
      if (!slide.layers) {
        slide.patternColor = newPalette.text
        continue
      }
      for (const layer of slide.layers) {
        themeLayerColorFields(layer, map)
      }
    }
  }

  function applyAiDesign(result: AiDesignResult): void {
    const safePalette = sanitizePalette(result.palette)
    palette.value = safePalette
    const mapped: CarouselSlide[] = result.slides.slice(0, MAX_CAROUSEL_SLIDES).map(aiSlide => {
      const base = blankSlide()
      const layers: SlideLayer[] = [
        {
          id: createLayerId(),
          type: 'background',
          name: 'Background',
          visible: true,
          locked: false,
          opacity: 1,
          transform: { x: 0, y: 0, w: FRAME_W, h: frame.value.h, rotate: 0 },
          fill: { kind: 'color', color: safePalette.bg },
        },
      ]
      if (aiSlide.html) {
        layers.push({
          id: createLayerId(),
          type: 'html',
          name: 'AI HTML',
          visible: true,
          locked: false,
          opacity: 1,
          transform: { x: 0, y: 0, w: FRAME_W, h: frame.value.h, rotate: 0 },
          html: aiSlide.html,
        })
      } else {
        const templateKey = CAROUSEL_TEMPLATES.some(t => t.key === aiSlide.template) ? aiSlide.template : 'big-statement'
        layers.push({
          id: createLayerId(),
          type: 'html',
          name: 'Content',
          visible: true,
          locked: false,
          opacity: 1,
          transform: { x: 0, y: 0, w: FRAME_W, h: frame.value.h, rotate: 0 },
          bindings: {
            templateKey,
            data: {
              kicker: aiSlide.kicker,
              headline: aiSlide.headline || 'Untitled',
              body: aiSlide.body,
              items: aiSlide.items,
              quote: aiSlide.quote,
              author: aiSlide.author,
              stat: aiSlide.stat,
              statLabel: aiSlide.statLabel,
              cta: aiSlide.cta,
              images: (aiSlide as any).images,
            },
          },
        })
      }
      base.layers = layers
      return base
    })
    if (!mapped.length) return
    slides.value = mapped
    currentIndex.value = 0
    selectedLayerId.value = null
  }

  function applyAiDeckTemplate(deck: DeckTemplate): void {
    addCustomDeckTemplate(deck)
    applyDeckTemplate(deck.key)
  }

  async function renderSlideToPng(stage: HTMLElement, index: number): Promise<string> {
    const html = slideHtml(slides.value[index]!, index, slides.value.length)
    const host = stage.querySelector<HTMLElement>('#carousel-export-canvas')
    if (!host) throw new Error('Export stage missing')
    host.innerHTML = html
    // Webfonts (deck font, layer fonts) must be in the document before the
    // snapshot or the PNG bakes in fallback glyphs.
    await document.fonts?.ready?.catch(() => undefined)
    await new Promise(r => setTimeout(r, 120))
    return await domToPng(stage, {
      quality: 1,
      width: frame.value.w,
      height: frame.value.h,
      maximumCanvasSize: 10000,
      timeout: 120000,
    })
  }

  async function downloadSlide(stage: HTMLElement, index: number): Promise<void> {
    exporting.value = true
    exportProgress.value = `${index + 1}/${slides.value.length}`
    try {
      const dataUrl = await renderSlideToPng(stage, index)
      const link = document.createElement('a')
      link.download = `carousel_${String(index + 1).padStart(2, '0')}.png`
      link.href = dataUrl
      link.click()
    }
    finally {
      exporting.value = false
      exportProgress.value = ''
    }
  }

  async function downloadAllSlides(stage: HTMLElement): Promise<void> {
    exporting.value = true
    try {
      for (let index = 0; index < slides.value.length; index++) {
        exportProgress.value = `${index + 1}/${slides.value.length}`
        const dataUrl = await renderSlideToPng(stage, index)
        const link = document.createElement('a')
        link.download = `carousel_${String(index + 1).padStart(2, '0')}.png`
        link.href = dataUrl
        link.click()
        if (index < slides.value.length - 1) await new Promise(r => setTimeout(r, 350))
      }
    }
    finally {
      exporting.value = false
      exportProgress.value = ''
    }
  }

  async function saveAllSlides(
    stage: HTMLElement,
    upload: (dataUrl: string, filename: string) => Promise<string>,
  ): Promise<string[]> {
    exporting.value = true
    const ids: string[] = []
    try {
      for (let index = 0; index < slides.value.length; index++) {
        exportProgress.value = `${index + 1}/${slides.value.length}`
        const dataUrl = await renderSlideToPng(stage, index)
        const id = await upload(dataUrl, `carousel_${String(index + 1).padStart(2, '0')}.png`)
        ids.push(id)
      }
    }
    finally {
      exporting.value = false
      exportProgress.value = ''
    }
    return ids
  }

  return {
    slides,
    currentIndex,
    palette,
    flow,
    handle,
    frame,
    fx,
    currentSlide,
    exporting,
    exportProgress,
    selectedLayerId,
    selectedLayer,
    selectLayer,
    addLayer,
    updateLayer,
    updateLayerTransform,
    removeLayer,
    duplicateLayer,
    moveLayer,
    reorderLayer,
    setDesignLayer,
    currentLayers,
    migrateAllSlides,
    slideHtml,
    currentHtml,
    addSlide,
    insertSlideAt,
    addHtmlSlide,
    addImageSlicesSlide,
    duplicateSlide,
    removeSlide,
    moveSlide,
    switchTo,
    nextSlide,
    prevSlide,
    updateSlideData,
    setBgImage,
    updateBgTransform,
    resetBgTransform,
    setGalleryImage,
    applyTemplateToCurrent,
    applyPalette,
    sanitizePalette,
    applyAiDesign,
    applyDeckTemplate,
    addCustomDeckTemplate,
    removeCustomDeck,
    applyAiDeckTemplate,
    customDecks,
    slicedImageGroup,
    updateSlicedImageCount,
    showFromImageModal,
    showFromHtmlModal,
    allDeckTemplates,
    downloadSlide,
    renderSlideToPng,
    downloadAllSlides,
    saveAllSlides,
    MAX_CAROUSEL_SLIDES,
  }
}

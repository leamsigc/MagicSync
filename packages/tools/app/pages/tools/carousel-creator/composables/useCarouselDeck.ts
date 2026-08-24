import { domToPng } from 'modern-screenshot'
import {
  CAROUSEL_TEMPLATES,
  DEFAULT_FLOW,
  renderSlideHtml,
  type BgImageLayer,
  type DeckFlow,
  type SlideData,
  type SlidePalette,
} from '../templates'
import { CAROUSEL_DECK_TEMPLATES } from '../deckTemplates'
import { patternStyle } from '../patterns'

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
}

export interface DeckPalette {
  bg: string
  text: string
  accent: string
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
  slides: Array<{ template: string } & SlideData>
}

export const DEFAULT_PALETTE: DeckPalette = {
  bg: '#0f0e0d',
  text: '#fafaf9',
  accent: '#f97316',
}

function createId(): string {
  return `slide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function blankSlide(templateKey = 'title-kicker'): CarouselSlide {
  return {
    id: createId(),
    templateKey,
    data: { headline: 'Your headline here', body: '' },
    pattern: 'dots',
    patternColor: '#ffffff',
    patternOpacity: 0.08,
    bgImage: null,
    customHtml: '',
  }
}

const slides = ref<CarouselSlide[]>([blankSlide()])
const currentIndex = ref(0)
const palette = ref<DeckPalette>({ ...DEFAULT_PALETTE })
const flow = ref<DeckFlow>({ ...DEFAULT_FLOW })
const handle = ref('')
const frame = ref<DeckFrame>({ ...FRAME_PRESETS.portrait })
const fx = ref<DeckFx>({ rotate: 0, zoom: 100 })
const exporting = ref(false)
const exportProgress = ref('')

if (import.meta.client) {
  const w = window as unknown as { __CAROUSEL_DECK_LOADS__?: number }
  w.__CAROUSEL_DECK_LOADS__ = (w.__CAROUSEL_DECK_LOADS__ ?? 0) + 1
}

export function useCarouselDeck() {

  const currentSlide = computed(() => slides.value[currentIndex.value] ?? slides.value[0]!)

  function slideHtml(slide: CarouselSlide, index: number, total: number): string {
    if (slide.customHtml) return slide.customHtml
    const fullPalette: SlidePalette = {
      bg: palette.value.bg,
      text: palette.value.text,
      accent: palette.value.accent,
      patternColor: slide.patternColor,
    }
    const patternHtml = `<div style="position:absolute;inset:0;${Object.entries(patternStyle(slide.pattern, slide.patternColor, slide.patternOpacity)).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`).join(';')}"></div>`
    return renderSlideHtml(slide.templateKey, slide.data, fullPalette, index, total, patternHtml, slide.bgImage ?? undefined, flow.value, handle.value)
  }

  function currentHtml(): string {
    return slideHtml(currentSlide.value, currentIndex.value, slides.value.length)
  }

  function addSlide(templateKey?: string): void {
    if (slides.value.length >= MAX_CAROUSEL_SLIDES) return
    const slide = blankSlide(templateKey ?? 'big-statement')
    slide.pattern = currentSlide.value.pattern
    slide.patternColor = currentSlide.value.patternColor
    slide.patternOpacity = currentSlide.value.patternOpacity
    slides.value.push(slide)
    currentIndex.value = slides.value.length - 1
  }

  function insertSlideAt(index: number, templateKey?: string, data?: Partial<SlideData>): void {
    if (slides.value.length >= MAX_CAROUSEL_SLIDES) return
    const slide = blankSlide(templateKey ?? currentSlide.value.templateKey)
    slide.pattern = currentSlide.value.pattern
    slide.patternColor = currentSlide.value.patternColor
    slide.patternOpacity = currentSlide.value.patternOpacity
    if (data) slide.data = { ...slide.data, ...data }
    const at = Math.min(Math.max(index, 0), slides.value.length)
    slides.value.splice(at, 0, slide)
    currentIndex.value = at
  }

  function applyDeckTemplate(deckKey: string): void {
    const deck = CAROUSEL_DECK_TEMPLATES.find(d => d.key === deckKey)
    if (!deck) return
    const mapped: CarouselSlide[] = deck.slides.map(spec => ({
      id: createId(),
      templateKey: spec.templateKey,
      data: { ...spec.data },
      pattern: 'dots',
      patternColor: deck.palette.text,
      patternOpacity: 0.08,
      bgImage: null,
      customHtml: '',
    }))
    slides.value = mapped.slice(0, MAX_CAROUSEL_SLIDES)
    palette.value = { ...deck.palette }
    for (const slide of slides.value) slide.patternColor = deck.palette.text
    currentIndex.value = 0
  }

  function duplicateSlide(index: number): void {
    if (slides.value.length >= MAX_CAROUSEL_SLIDES) return
    const source = slides.value[index]
    if (!source) return
    const copy: CarouselSlide = JSON.parse(JSON.stringify(source))
    copy.id = createId()
    slides.value.splice(index + 1, 0, copy)
    currentIndex.value = index + 1
  }

  function removeSlide(index: number): void {
    if (slides.value.length <= 1) return
    slides.value.splice(index, 1)
    currentIndex.value = Math.min(currentIndex.value, slides.value.length - 1)
  }

  function moveSlide(index: number, direction: -1 | 1): void {
    const target = index + direction
    if (target < 0 || target >= slides.value.length) return
    const [moved] = slides.value.splice(index, 1)
    slides.value.splice(target, 0, moved!)
    currentIndex.value = target
  }

  function switchTo(index: number): void {
    if (index >= 0 && index < slides.value.length) currentIndex.value = index
  }

  function nextSlide(): void {
    switchTo(currentIndex.value + 1)
  }

  function prevSlide(): void {
    switchTo(currentIndex.value - 1)
  }

  function updateSlideData(patch: Partial<SlideData>): void {
    currentSlide.value.data = { ...currentSlide.value.data, ...patch }
  }

  function applyTemplateToCurrent(templateKey: string): void {
    currentSlide.value.templateKey = templateKey
  }

  function applyPalette(newPalette: DeckPalette): void {
    palette.value = { ...newPalette }
    for (const slide of slides.value) {
      slide.patternColor = newPalette.text
    }
  }

  function applyAiDesign(result: AiDesignResult): void {
    palette.value = { ...result.palette }
    const mapped: CarouselSlide[] = result.slides.slice(0, MAX_CAROUSEL_SLIDES).map(aiSlide => ({
      id: createId(),
      templateKey: CAROUSEL_TEMPLATES.some(t => t.key === aiSlide.template) ? aiSlide.template : 'big-statement',
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
      },
      pattern: 'dots',
      patternColor: result.palette.text,
      patternOpacity: 0.08,
      bgImage: null,
      customHtml: '',
    }))
    if (!mapped.length) return
    slides.value = mapped
    currentIndex.value = 0
  }

  async function renderSlideToPng(stage: HTMLElement, index: number): Promise<string> {
    const html = slideHtml(slides.value[index]!, index, slides.value.length)
    const host = stage.querySelector<HTMLElement>('#carousel-export-canvas')
    if (!host) throw new Error('Export stage missing')
    host.innerHTML = html
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
    slideHtml,
    currentHtml,
    addSlide,
    insertSlideAt,
    duplicateSlide,
    removeSlide,
    moveSlide,
    switchTo,
    nextSlide,
    prevSlide,
    updateSlideData,
    applyTemplateToCurrent,
    applyPalette,
    applyAiDesign,
    applyDeckTemplate,
    downloadSlide,
    downloadAllSlides,
    saveAllSlides,
    MAX_CAROUSEL_SLIDES,
  }
}

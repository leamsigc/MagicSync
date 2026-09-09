/**
 * Slide templates — JSON-first.
 *
 * Two kinds:
 * - `layers`: pure JSON layer specs (dynamic inputs = text layers, styles = layer
 *   styles). Palette tokens `__BG__`, `__TEXT__`, `__ACCENT__` are replaced at
 *   instantiation so templates stay coherent with the deck palette.
 * - `html`: content-only HTML templates (the 22 legacy layouts wrapped via their
 *   render functions). Applied with a `bindings` html layer so the editable
 *   fields (headline, body, items…) stay live.
 */
import type { BackgroundLayer, GradientSpec, ImageLayer, LayerSpec, PatternLayer, ShapeLayer, SlideLayer, TextLayer } from './layers/types'
import { instantiateLayers } from './layers/types'
import { CAROUSEL_TEMPLATES, type SlideData, type SlidePalette } from './templates'
import { stripLegacyChrome } from './layers/legacy'

export type TemplateCategory = 'cover' | 'content' | 'cta' | 'photo' | 'misc'

export interface HtmlSlideTemplate {
  kind: 'html'
  key: string
  title: string
  description: string
  category: TemplateCategory
  /** Editable field keys shown when the bound html layer is selected */
  bindings: string[]
  defaultData: SlideData
  renderContent: (data: SlideData, palette: SlidePalette, index: number, total: number) => string
}

export interface LayersSlideTemplate {
  kind: 'layers'
  key: string
  title: string
  description: string
  category: TemplateCategory
  layers: LayerSpec[]
}

export type SlideTemplate = HtmlSlideTemplate | LayersSlideTemplate

export interface TemplatePalette {
  bg: string
  text: string
  accent: string
  font?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────

function text(name: string, content: string, x: number, y: number, w: number, opts: {
  h?: number
  fontSize?: number
  fontWeight?: number
  align?: 'left' | 'center' | 'right'
  lineHeight?: number
  letterSpacing?: number
  color?: string
  font?: string
  opacity?: number
  rotate?: number
} = {}): Omit<TextLayer, 'id'> {
  const o = { ...TEXT_DEFAULTS, ...opts }
  return {
    type: 'text',
    name,
    visible: true,
    locked: false,
    opacity: o.opacity,
    transform: { x, y, w, h: o.h, rotate: o.rotate },
    content,
    font: o.font,
    fontSize: o.fontSize,
    fontWeight: o.fontWeight,
    align: o.align,
    lineHeight: o.lineHeight,
    letterSpacing: o.letterSpacing,
    color: o.color,
  }
}

const TEXT_DEFAULTS = {
  h: undefined as number | undefined,
  rotate: 0,
  opacity: 1,
  font: 'Arial',
  fontSize: 40,
  fontWeight: 700,
  align: 'left' as 'left' | 'center' | 'right',
  lineHeight: 1.2,
  letterSpacing: 0,
  color: '__TEXT__',
}

function rect(name: string, x: number, y: number, w: number, h: number, opts: {
  fill?: string | GradientSpec
  rotate?: number
  radius?: number
  opacity?: number
} = {}): Omit<ShapeLayer, 'id'> {
  return {
    type: 'shape',
    shape: 'rect',
    name,
    visible: true,
    locked: false,
    opacity: opts.opacity ?? 1,
    transform: { x, y, w, h, rotate: opts.rotate ?? 0 },
    fill: opts.fill ?? '__ACCENT__',
    radius: opts.radius,
  }
}

function circle(name: string, x: number, y: number, size: number, opts: {
  fill?: string | GradientSpec
  opacity?: number
  rotate?: number
} = {}): Omit<ShapeLayer, 'id'> {
  return {
    type: 'shape',
    shape: 'circle',
    name,
    visible: true,
    locked: false,
    opacity: opts.opacity ?? 1,
    transform: { x, y, w: size, h: size, rotate: opts.rotate ?? 0 },
    fill: opts.fill ?? '__ACCENT__',
  }
}

function image(name: string, x: number, y: number, w: number, h: number, opts: {
  fit?: 'cover' | 'contain' | 'fill'
  radius?: number
  rotate?: number
  opacity?: number
} = {}): Omit<ImageLayer, 'id'> {
  return {
    type: 'image',
    name,
    visible: true,
    locked: false,
    opacity: opts.opacity ?? 1,
    transform: { x, y, w, h, rotate: opts.rotate ?? 0 },
    src: '',
    fit: opts.fit ?? 'cover',
    radius: opts.radius,
  }
}

function pattern(key: string, color: string, opacity: number): Omit<PatternLayer, 'id'> {
  return {
    type: 'pattern',
    key,
    name: 'Pattern',
    visible: true,
    locked: false,
    opacity,
    transform: { x: 0, y: 0, w: 1080, h: 1350, rotate: 0 },
    color,
  }
}

function background(color: string, gradient?: GradientSpec): Omit<BackgroundLayer, 'id'> {
  return {
    type: 'background',
    name: 'Background',
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x: 0, y: 0, w: 1080, h: 1350, rotate: 0 },
    fill: gradient ? { kind: 'gradient', gradient } : { kind: 'color', color },
  }
}

const grad = (kind: GradientSpec['kind'], angle: number, stops: Array<[string, number]>): GradientSpec => ({
  kind,
  angle,
  stops: stops.map(([color, pos]) => ({ color, pos })),
})

/** Replaces `__BG__` / `__TEXT__` / `__ACCENT__` tokens inside a layer tree. */
export function replaceTokens(layers: LayerSpec[], palette: TemplatePalette): LayerSpec[] {
  const map = { __BG__: palette.bg, __TEXT__: palette.text, __ACCENT__: palette.accent } as Record<string, string>
  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return value.replace(/__BG__|__TEXT__|__ACCENT__/g, token => map[token] ?? token)
    }
    if (Array.isArray(value)) return value.map(walk)
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, walk(v)]))
    }
    return value
  }
  return walk(layers) as LayerSpec[]
}

// ── Legacy wraps ──────────────────────────────────────────────────────────

const LEGACY_BINDINGS: Record<string, string[]> = {
  'title-kicker': ['kicker', 'headline', 'body'],
  'big-statement': ['headline'],
  'tips-list': ['kicker', 'headline', 'items'],
  quote: ['quote', 'author'],
  'stat-highlight': ['stat', 'statLabel', 'body'],
  steps: ['headline', 'items'],
  checklist: ['headline', 'items'],
  comparison: ['headline', 'items'],
  'photo-left': ['headline', 'body'],
  'full-photo': ['kicker', 'headline', 'body'],
  qa: ['headline', 'body'],
  'wireframe-hero': ['kicker', 'headline', 'body'],
  'terminal-window': ['kicker', 'headline', 'body'],
  'gallery-wall': ['kicker', 'headline', 'body', 'images'],
  'mono-statement': ['headline', 'body'],
  'duotone-stat': ['kicker', 'stat', 'statLabel', 'headline', 'body'],
  'clay-cards': ['kicker', 'headline', 'body', 'items'],
  'myth-fact': ['headline', 'items'],
  cta: ['headline', 'body', 'cta'],
  'photo-grid': ['kicker', 'headline', 'images'],
  polaroid: ['headline', 'body', 'images'],
  'stat-cards': ['headline', 'items'],
  'split-band': ['kicker', 'headline', 'body'],
  'number-hero': ['headline', 'body', 'items'],
  'feature-highlight': ['kicker', 'headline', 'body', 'items'],
  testimonial: ['quote', 'author', 'body', 'images'],
  timeline: ['headline', 'body', 'items'],
  'image-focus': ['kicker', 'headline', 'body', 'images'],
}

function wrapLegacy(tpl: (typeof CAROUSEL_TEMPLATES)[number], category: TemplateCategory): HtmlSlideTemplate {
  return {
    kind: 'html',
    key: tpl.key,
    title: tpl.title,
    description: tpl.description,
    category,
    bindings: LEGACY_BINDINGS[tpl.key] ?? ['headline'],
    defaultData: { headline: 'Your headline here', body: 'Supporting text that explains the idea.', items: ['First point', 'Second point', 'Third point'], quote: 'A powerful quote.', author: 'Author Name', stat: '87%', statLabel: 'of people remember the stat', cta: 'Get started' },
    renderContent: (data, palette, index, total) =>
      stripLegacyChrome(tpl.render(data, palette, index, total), palette),
  }
}

const LEGACY_CATEGORY: Record<string, TemplateCategory> = {
  'title-kicker': 'cover',
  'big-statement': 'cover',
  'split-band': 'cover',
  'full-photo': 'cover',
  'image-focus': 'photo',
  'photo-left': 'photo',
  'photo-grid': 'photo',
  polaroid: 'photo',
  'wireframe-hero': 'cover',
  'terminal-window': 'cover',
  'gallery-wall': 'photo',
  'mono-statement': 'cover',
  'duotone-stat': 'content',
  'clay-cards': 'content',
  cta: 'cta',
  tips: 'content',
  quote: 'content',
  testimonial: 'content',
  'myth-fact': 'content',
  qa: 'content',
  'stat-highlight': 'content',
  'stat-cards': 'content',
  'number-hero': 'content',
  steps: 'content',
  checklist: 'content',
  comparison: 'content',
  'feature-highlight': 'content',
  timeline: 'content',
}

function wrapAllLegacy(): HtmlSlideTemplate[] {
  return CAROUSEL_TEMPLATES.map(tpl => wrapLegacy(tpl, LEGACY_CATEGORY[tpl.key] ?? 'misc'))
}

// ── New layer-based templates ─────────────────────────────────────────────

const NEW_LAYER_TEMPLATES: Array<Omit<LayersSlideTemplate, 'kind'>> = [
  {
    key: 'layer-split-screen',
    title: 'Split Screen',
    description: 'Image left, text right — clean product/photo split',
    category: 'photo',
    layers: [
      background('#000000', grad('linear', 135, [['#000000', 0], ['__ACCENT__', 100]])),
      image('Photo', 0, 0, 540, 1350, { fit: 'cover' }),
      text('Kicker', 'THE STORY', 590, 420, 420, { fontSize: 24, letterSpacing: 6, color: '__ACCENT__', fontWeight: 700 }),
      text('Headline', 'Make every pixel count', 590, 480, 430, { fontSize: 76, lineHeight: 1.08, fontWeight: 900 }),
      text('Body', 'A sentence that earns the swipe.', 590, 760, 410, { fontSize: 30, lineHeight: 1.5, fontWeight: 400, opacity: 0.85 }),
    ],
  },
  {
    key: 'layer-magazine',
    title: 'Magazine',
    description: 'Giant number + rule + editorial type',
    category: 'content',
    layers: [
      background('__BG__'),
      text('Number', '01', 70, 200, 420, { fontSize: 300, fontWeight: 900, letterSpacing: -8, color: '__ACCENT__' }),
      rect('Rule', 560, 300, 140, 8, { fill: '__ACCENT__' }),
      text('Headline', 'The big idea in one line', 560, 340, 450, { fontSize: 68, lineHeight: 1.1, fontWeight: 900 }),
      text('Body', 'Supporting copy with the details that matter.', 560, 700, 440, { fontSize: 30, lineHeight: 1.5, fontWeight: 400, opacity: 0.85 }),
    ],
  },
  {
    key: 'layer-editorial',
    title: 'Editorial',
    description: 'Kicker + oversized headline + gradient band',
    category: 'cover',
    layers: [
      background('__BG__'),
      text('Kicker', 'EDITORIAL', 80, 220, 400, { fontSize: 24, letterSpacing: 8, color: '__ACCENT__', fontWeight: 700 }),
      text('Headline', 'Say it loud.', 70, 270, 940, { fontSize: 148, fontWeight: 900, letterSpacing: -4, lineHeight: 0.98 }),
      rect('Band', -80, 900, 1240, 260, { fill: grad('linear', 90, [['__ACCENT__', 0], ['__TEXT__', 100]]), rotate: 0 }),
      text('Body', 'The message that lands below the band.', 90, 990, 900, { fontSize: 36, lineHeight: 1.45, fontWeight: 500, color: '__BG__' }),
    ],
  },
  {
    key: 'layer-glow',
    title: 'Glow',
    description: 'Soft radial glow behind a centered headline',
    category: 'cover',
    layers: [
      background('__BG__'),
      circle('Glow', 140, -160, 800, { fill: '__ACCENT__', opacity: 0.5 }),
      text('Headline', 'Bright ideas shine', 100, 500, 880, { fontSize: 104, fontWeight: 900, align: 'center', lineHeight: 1.05 }),
      text('Kicker', 'POWERED BY MAGIC', 340, 720, 400, { fontSize: 20, letterSpacing: 6, align: 'center', color: '__ACCENT__', fontWeight: 700, opacity: 0.9 }),
      text('Body', 'A subtle glow makes the message pop.', 220, 820, 640, { fontSize: 30, align: 'center', fontWeight: 400, opacity: 0.8 }),
    ],
  },
  {
    key: 'layer-ribbon',
    title: 'Ribbon',
    description: 'Rotated accent ribbon carrying the headline',
    category: 'cover',
    layers: [
      background('__BG__'),
      rect('Ribbon', 60, 300, 960, 170, { fill: '__ACCENT__', rotate: -3 }),
      text('Headline', 'On the band', 120, 335, 840, { fontSize: 88, fontWeight: 900, align: 'center', color: '__BG__' }),
      text('Kicker', 'FEATURED', 440, 200, 200, { fontSize: 22, letterSpacing: 8, align: 'center', color: '__ACCENT__', fontWeight: 700 }),
      text('Body', 'The supporting sentence that follows.', 160, 560, 760, { fontSize: 32, align: 'center', fontWeight: 400, opacity: 0.85 }),
    ],
  },
  {
    key: 'layer-3cards',
    title: 'Three Cards',
    description: 'Three numbered value cards',
    category: 'content',
    layers: [
      background('__BG__'),
      text('Headline', 'Why it works', 80, 120, 920, { fontSize: 64, fontWeight: 900 }),
      rect('Card 1', 80, 340, 286, 460, { fill: '__ACCENT__', radius: 24 }),
      text('Card 1 num', '01', 110, 380, 200, { fontSize: 96, fontWeight: 900, color: '__BG__' }),
      text('Card 1 text', 'First point', 110, 540, 226, { fontSize: 30, lineHeight: 1.35, color: '__BG__', fontWeight: 600 }),
      rect('Card 2', 396, 340, 286, 460, { fill: '__TEXT__', radius: 24, opacity: 0.12 }),
      text('Card 2 num', '02', 426, 380, 200, { fontSize: 96, fontWeight: 900, color: '__ACCENT__' }),
      text('Card 2 text', 'Second point', 426, 540, 226, { fontSize: 30, lineHeight: 1.35, fontWeight: 600 }),
      rect('Card 3', 712, 340, 286, 460, { fill: '__TEXT__', radius: 24, opacity: 0.12 }),
      text('Card 3 num', '03', 742, 380, 200, { fontSize: 96, fontWeight: 900, color: '__ACCENT__' }),
      text('Card 3 text', 'Third point', 742, 540, 226, { fontSize: 30, lineHeight: 1.35, fontWeight: 600 }),
    ],
  },
  {
    key: 'layer-quote-card',
    title: 'Quote Card',
    description: 'Quote in a soft card with giant marks',
    category: 'content',
    layers: [
      background('__BG__'),
      rect('Card', 80, 240, 920, 860, { fill: '__TEXT__', radius: 40, opacity: 0.07 }),
      text('Marks', '“', 120, 250, 200, { fontSize: 220, color: '__ACCENT__', font: 'Georgia', fontWeight: 700 }),
      text('Quote', 'The quote that carries the message.', 140, 480, 820, { fontSize: 56, lineHeight: 1.3, fontWeight: 700, align: 'center' }),
      text('Author', '— AUTHOR NAME', 140, 820, 820, { fontSize: 24, letterSpacing: 4, align: 'center', opacity: 0.7, fontWeight: 600 }),
    ],
  },
  {
    key: 'layer-photo-stack',
    title: 'Photo Stack',
    description: 'Three tilted photos, stack style',
    category: 'photo',
    layers: [
      background('__BG__'),
      image('Photo 1', 140, 160, 500, 620, { fit: 'cover', rotate: -8, radius: 12 }),
      image('Photo 2', 440, 300, 500, 620, { fit: 'cover', rotate: 6, radius: 12 }),
      image('Photo 3', 280, 520, 500, 620, { fit: 'cover', rotate: -3, radius: 12 }),
      text('Headline', 'Moments that matter', 90, 1150, 900, { fontSize: 66, fontWeight: 900, align: 'center' }),
    ],
  },
  {
    key: 'layer-sticker-cta',
    title: 'Sticker CTA',
    description: 'Badge circle CTA finale',
    category: 'cta',
    layers: [
      background('__BG__'),
      text('Headline', 'Ready when you are', 90, 200, 900, { fontSize: 92, fontWeight: 900, align: 'center' }),
      text('Body', 'One small action changes the week.', 160, 420, 760, { fontSize: 32, align: 'center', fontWeight: 400, opacity: 0.85 }),
      circle('Badge', 300, 620, 480, { fill: '__ACCENT__' }),
      text('CTA', 'Start now', 300, 770, 480, { fontSize: 56, fontWeight: 900, align: 'center', color: '__BG__' }),
      text('Hint', 'NO SIGNUP REQUIRED', 300, 900, 480, { fontSize: 20, letterSpacing: 4, align: 'center', color: '__BG__', opacity: 0.8, fontWeight: 600 }),
    ],
  },
  {
    key: 'layer-countdown',
    title: 'Countdown',
    description: 'Giant number with a progress bar',
    category: 'content',
    layers: [
      background('__BG__'),
      text('Number', '03', 80, 300, 920, { fontSize: 420, fontWeight: 900, letterSpacing: -12, color: '__ACCENT__', align: 'center' }),
      rect('Bar track', 240, 860, 600, 16, { fill: '__TEXT__', radius: 999, opacity: 0.15 }),
      rect('Bar fill', 240, 860, 300, 16, { fill: '__ACCENT__', radius: 999 }),
      text('Headline', 'Three things to know', 120, 940, 840, { fontSize: 72, fontWeight: 900, align: 'center' }),
      text('Body', 'The countdown continues.', 180, 1060, 720, { fontSize: 30, align: 'center', fontWeight: 400, opacity: 0.8 }),
    ],
  },
  {
    key: 'layer-minimal-dots',
    title: 'Minimal Dots',
    description: 'Restrained type with a dotted accent',
    category: 'cover',
    layers: [
      background('__BG__'),
      pattern('dots', '__ACCENT__', 0.14),
      text('Kicker', 'MINIMAL', 90, 260, 400, { fontSize: 22, letterSpacing: 10, color: '__ACCENT__', fontWeight: 700 }),
      text('Headline', 'Less, but better', 80, 320, 920, { fontSize: 128, fontWeight: 900, letterSpacing: -3, lineHeight: 1.0 }),
      text('Body', 'A quiet line about the idea.', 90, 820, 620, { fontSize: 34, lineHeight: 1.5, fontWeight: 400, opacity: 0.8 }),
    ],
  },
  {
    key: 'layer-gradient-cover',
    title: 'Gradient Cover',
    description: 'Bold gradient backdrop for the hook slide',
    category: 'cover',
    layers: [
      background('#000000', grad('linear', 135, [['__ACCENT__', 0], ['__BG__', 60], ['#000000', 100]])),
      pattern('dots', '#ffffff', 0.08),
      text('Headline', 'Open with a claim', 90, 420, 900, { fontSize: 108, fontWeight: 900, lineHeight: 1.02 }),
      text('Kicker', 'THE HOOK', 90, 340, 300, { fontSize: 24, letterSpacing: 8, color: '__BG__', fontWeight: 700 }),
      text('Body', 'Context that keeps them swiping.', 90, 900, 800, { fontSize: 34, fontWeight: 400, opacity: 0.9 }),
    ],
  },
]

// ── Registry ──────────────────────────────────────────────────────────────

export const CAROUSEL_SLIDE_TEMPLATES: SlideTemplate[] = [
  ...wrapAllLegacy(),
  ...NEW_LAYER_TEMPLATES.map(tpl => ({ ...tpl, kind: 'layers' as const })),
]

export function findSlideTemplate(key: string): SlideTemplate | undefined {
  return CAROUSEL_SLIDE_TEMPLATES.find(t => t.key === key)
}

export function isLayerTemplate(key: string): boolean {
  return findSlideTemplate(key)?.kind === 'layers'
}

/**
 * Instantiates a template into concrete layers for a slide.
 * - layers kind: deep-cloned specs with palette tokens replaced
 * - html kind: background layer (palette bg) + bindings html layer
 */
export function instantiateSlideTemplate(template: SlideTemplate, palette: TemplatePalette, frameH: number): SlideLayer[] {
  if (template.kind === 'layers') {
    const specs = replaceTokens(template.layers, palette)
    const layers = instantiateLayers(specs)
    for (const layer of layers) {
      if (layer.transform.h === undefined && layer.type !== 'text') {
        layer.transform.h = frameH
      }
    }
    return layers
  }
  const layers: SlideLayer[] = []
  layers.push({
    id: `layer-bg-${Math.random().toString(36).slice(2, 8)}`,
    type: 'background',
    name: 'Background',
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x: 0, y: 0, w: 1080, h: frameH, rotate: 0 },
    fill: { kind: 'color', color: palette.bg },
  })
  layers.push({
    id: `layer-content-${Math.random().toString(36).slice(2, 8)}`,
    type: 'html',
    name: 'Content',
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x: 0, y: 0, w: 1080, h: frameH, rotate: 0 },
    bindings: { templateKey: template.key, data: { ...template.defaultData } },
  })
  return layers
}

export function instantiateSlideTemplateByKey(key: string, palette: TemplatePalette, frameH: number): SlideLayer[] {
  const template = findSlideTemplate(key)
  if (!template) return []
  return instantiateSlideTemplate(template, palette, frameH)
}
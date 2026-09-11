/**
 * Legacy HTML template → object layers converter (Task 1.3).
 *
 * The 28 html-kind templates (`templates.ts`) render bespoke HTML the fabric
 * pipeline cannot paint. This module re-expresses them as editable object
 * layers via per-template presets (`legacy-presets.ts`, sizes harvested from
 * the original `render()` functions): vertical auto-layout flow (measure then
 * vertically center), image-region fixed layers, decorations, and footers.
 *
 * Pure, DOM-free, fabric-free — output feeds `slideToFabricScene()`.
 */
import { SCENE_W } from './constants'
import { presetFor } from './legacy-presets'
import type { BlockKind, ImageRegion, LegacyPreset } from './legacy-presets'

export interface ConverterData {
  kicker?: string
  headline: string
  body?: string
  items?: string[] | string
  quote?: string
  author?: string
  stat?: string
  statLabel?: string
  cta?: string
  footer?: string
  images?: string[]
}

export interface ConverterPalette {
  bg: string
  text: string
  accent: string
  font?: string
}

export interface ConverterOptions {
  frameH: number
  index: number
  total: number
}

export interface ConvertedLayer {
  type: 'background' | 'text' | 'image' | 'shape'
  visible: boolean
  opacity: number
  transform: { x: number, y: number, w: number, h?: number, rotate: number }
  [key: string]: unknown
}

interface Ctx {
  data: ConverterData
  preset: LegacyPreset
  palette: ConverterPalette
  frameH: number
  index: number
  total: number
  contentX: number
  contentW: number
}

interface PlacedBlock {
  height: number
  place: (y: number) => ConvertedLayer[]
}

type BlockBuilder = (ctx: Ctx) => PlacedBlock | null

const GAP = 34
const FOOTER_RESERVE = 150

export function toStringArray(items: ConverterData['items']): string[] {
  if (Array.isArray(items)) return items.filter(x => typeof x === 'string' && x.trim() !== '')
  if (typeof items === 'string' && items.trim()) return items.split('\n').map(s => s.trim()).filter(Boolean)
  return []
}

function estimateLines(text: string, fontSize: number, width: number): number {
  const perLine = Math.max(8, Math.floor(width / (fontSize * 0.52)))
  return Math.max(1, Math.ceil(text.length / perLine))
}

function textHeight(text: string, fontSize: number, width: number, lineHeight: number): number {
  return estimateLines(text, fontSize, width) * fontSize * lineHeight
}

interface TextOpts {
  size: number
  weight?: number
  color?: string
  align?: 'left' | 'center' | 'right'
  lineHeight?: number
  letterSpacing?: number
  opacity?: number
  font?: string
}

function textLayer(name: string, content: string, x: number, y: number, w: number, opts: TextOpts, ctx: Ctx): ConvertedLayer {
  return {
    type: 'text',
    name,
    visible: true,
    locked: false,
    opacity: opts.opacity ?? 1,
    transform: { x, y, w, rotate: 0 },
    content,
    font: opts.font ?? ctx.palette.font ?? 'Inter',
    fontSize: opts.size,
    fontWeight: opts.weight ?? 700,
    align: opts.align ?? (ctx.preset.align === 'center' ? 'center' : 'left'),
    lineHeight: opts.lineHeight ?? 1.2,
    letterSpacing: opts.letterSpacing ?? 0,
    color: opts.color ?? ctx.palette.text,
  }
}

function shapeLayer(name: string, shape: string, x: number, y: number, w: number, h: number, fill: unknown, extra?: Record<string, unknown>): ConvertedLayer {
  return {
    type: 'shape',
    name,
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x, y, w, h, rotate: 0 },
    shape,
    fill,
    ...(extra ?? {}),
  }
}

function baseColor(ctx: Ctx): string {
  return ctx.preset.textColor ?? ctx.palette.text
}

function accentOrBand(ctx: Ctx): string {
  return ctx.preset.bandText ? ctx.palette.bg : ctx.palette.accent
}

function staticBlock(text: string, opts: TextOpts, gapAfter: number): (ctx: Ctx) => PlacedBlock {
  return (ctx: Ctx) => {
    const height = textHeight(text, opts.size, ctx.contentW, opts.lineHeight ?? 1.2) + gapAfter
    return { height, place: (y: number) => [textLayer('block', text, ctx.contentX, y, ctx.contentW, opts, ctx)] }
  }
}

const BLOCKS: Record<BlockKind, BlockBuilder> = {
  accentBar: (ctx) => {
    const x = ctx.preset.align === 'center' ? ctx.contentX + (ctx.contentW - 96) / 2 : ctx.contentX
    return { height: 44, place: (y: number) => [shapeLayer('accent-bar', 'rect', x, y, 96, 8, ctx.palette.accent, { radius: 4 })] }
  },
  kicker: (ctx) => {
    if (!ctx.data.kicker?.trim()) return null
    const text = ctx.data.kicker.toUpperCase()
    const build = staticBlock(text, { size: ctx.preset.kickerSize ?? 24, weight: 700, color: accentOrBand(ctx), letterSpacing: 22 }, GAP)
    return build(ctx)
  },
  headline: (ctx) => {
    if (!ctx.data.headline?.trim()) return null
    const build = staticBlock(ctx.data.headline, { size: ctx.preset.headlineSize, weight: 800, color: baseColor(ctx), lineHeight: 1.08 }, GAP)
    return build(ctx)
  },
  body: (ctx) => {
    if (!ctx.data.body?.trim()) return null
    const build = staticBlock(ctx.data.body, { size: ctx.preset.bodySize, weight: 400, color: baseColor(ctx), opacity: 0.8, lineHeight: 1.45 }, GAP)
    return build(ctx)
  },
  quoteMark: (ctx) => {
    const build = staticBlock('“', { size: 140, weight: 700, color: ctx.palette.accent, font: 'Georgia', lineHeight: 0.6 }, 10)
    return build(ctx)
  },
  quote: (ctx) => {
    const text = ctx.data.quote?.trim() ? ctx.data.quote : ctx.data.headline
    const build = staticBlock(text, { size: ctx.preset.headlineSize, weight: 700, color: baseColor(ctx), lineHeight: 1.25 }, GAP)
    return build(ctx)
  },
  author: (ctx) => {
    if (!ctx.data.author?.trim()) return null
    const build = staticBlock(`— ${ctx.data.author}`, { size: 26, weight: 600, color: baseColor(ctx), opacity: 0.7, letterSpacing: 14 }, GAP)
    return build(ctx)
  },
  stat: (ctx) => {
    const text = ctx.data.stat?.trim() ? ctx.data.stat : ctx.data.headline
    const build = staticBlock(text, { size: ctx.preset.statSize ?? 150, weight: 900, color: accentOrBand(ctx), lineHeight: 1 }, GAP)
    return build(ctx)
  },
  statLabel: (ctx) => {
    if (!ctx.data.statLabel?.trim() && !ctx.data.stat?.trim()) return null
    const text = ctx.data.statLabel?.trim() ? ctx.data.statLabel : ctx.data.headline
    const build = staticBlock(text, { size: 36, weight: 600, color: baseColor(ctx), lineHeight: 1.35 }, GAP)
    return build(ctx)
  },
  items: (ctx) => {
    const items = toStringArray(ctx.data.items).slice(0, ctx.preset.maxItems ?? 8)
    if (items.length === 0) return null
    return buildItems(items, ctx)
  },
  ctaButton: (ctx) => {
    if (!ctx.data.cta?.trim()) return null
    const bw = 480
    const bh = 104
    const height = bh + GAP
    return {
      height,
      place: (y: number) => {
        const x = ctx.contentX + (ctx.contentW - bw) / 2
        return [
          { ...shapeLayer('cta-bg', 'rect', x, y, bw, bh, ctx.palette.accent, { radius: 52 }), opacity: 1 },
          textLayer('cta-text', ctx.data.cta as string, x, y + 30, bw, { size: 34, weight: 800, color: ctx.palette.bg, align: 'center' }, ctx),
        ]
      },
    }
  },
  avatar: (ctx) => {
    const size = 120
    const height = size + GAP
    return {
      height,
      place: (y: number) => {
        const x = ctx.contentX + (ctx.contentW - size) / 2
        const src = (ctx.data.images ?? [])[0]
        if (src) {
          return [{ type: 'image', name: 'avatar', visible: true, locked: false, opacity: 1, transform: { x, y, w: size, h: size, rotate: 0 }, src, fit: 'cover' }]
        }
        return [shapeLayer('avatar-ring', 'circle', x, y, size, size, ctx.palette.accent)]
      },
    }
  },
}

/* ── List items ─────────────────────────────────────────────────────── */

interface RowStyle {
  marker: 'dot' | 'circleNum' | 'roundedNum' | 'roundedCheck' | 'roundedLetter'
  markerSize: number
  textSize: number
  rowGap: number
}

const ROW_STYLES: Record<string, RowStyle> = {
  numbered: { marker: 'roundedNum', markerSize: 56, textSize: 32, rowGap: 28 },
  bullet: { marker: 'dot', markerSize: 12, textSize: 30, rowGap: 24 },
  check: { marker: 'roundedCheck', markerSize: 46, textSize: 31, rowGap: 26 },
  steps: { marker: 'circleNum', markerSize: 52, textSize: 30, rowGap: 36 },
  timeline: { marker: 'circleNum', markerSize: 44, textSize: 26, rowGap: 28 },
  dot: { marker: 'dot', markerSize: 10, textSize: 27, rowGap: 14 },
  letter: { marker: 'roundedLetter', markerSize: 52, textSize: 27, rowGap: 18 },
}

function markerLayers(style: RowStyle, label: string, x: number, y: number, ctx: Ctx): ConvertedLayer[] {
  if (style.marker === 'dot') {
    return [shapeLayer('bullet', 'circle', x, y + 14, style.markerSize, style.markerSize, ctx.palette.accent)]
  }
  const shape = style.marker === 'circleNum' ? 'circle' : 'rect'
  const radius = style.marker === 'circleNum' ? undefined : Math.round(style.markerSize * 0.28)
  const layers: ConvertedLayer[] = [
    shapeLayer('badge', shape, x, y, style.markerSize, style.markerSize, ctx.palette.accent, radius ? { radius } : undefined),
  ]
  if (label) {
    layers.push(textLayer('badge-label', label, x, y + style.markerSize / 2 - 13, style.markerSize, { size: 24, weight: 800, color: ctx.palette.bg, align: 'center' }, ctx))
  }
  return layers
}

function badgeLabel(style: RowStyle, item: string, index: number): string {
  if (style.marker === 'circleNum' || style.marker === 'roundedNum') return String(index + 1)
  if (style.marker === 'roundedLetter') return (item.trim().slice(0, 1) || '•').toUpperCase()
  return ''
}

function rowTextX(style: RowStyle, x: number): number {
  return x + style.markerSize + 22
}

function buildRows(items: string[], ctx: Ctx, styleKey: string): PlacedBlock {
  const style = ROW_STYLES[styleKey] ?? ROW_STYLES.bullet!
  const rows = items.map((item, i) => {
    const text = item
    const h = Math.max(style.markerSize, textHeight(text, style.textSize, ctx.contentW - style.markerSize - 22, 1.4))
    return { text, h, label: badgeLabel(style, item, i) }
  })
  const height = rows.reduce((sum, r) => sum + r.h + style.rowGap, 0)
  return {
    height,
    place: (y: number) => {
      const out: ConvertedLayer[] = []
      let cursor = y
      for (const row of rows) {
        out.push(...markerLayers(style, row.label, ctx.contentX, cursor, ctx))
        out.push(textLayer('item', row.text, rowTextX(style, ctx.contentX), cursor + 4, ctx.contentW - style.markerSize - 22, { size: style.textSize, weight: 400, color: baseColor(ctx), lineHeight: 1.4 }, ctx))
        cursor += row.h + style.rowGap
      }
      return out
    },
  }
}

function buildCards(items: string[], ctx: Ctx): PlacedBlock {
  const height = 300 + GAP
  return {
    height,
    place: (y: number) => {
      const n = items.length
      const gap = 22
      const cardW = (ctx.contentW - gap * (n - 1)) / n
      const out: ConvertedLayer[] = []
      items.forEach((item, idx) => {
        const even = idx % 2 === 0
        const x = ctx.contentX + idx * (cardW + gap)
        const card = even
          ? shapeLayer(`card-${idx}`, 'rect', x, y, cardW, 300, ctx.palette.accent, { radius: 24 })
          : { ...shapeLayer(`card-${idx}`, 'rect', x, y, cardW, 300, '#ffffff', { radius: 24 }), opacity: 0.07 }
        out.push(card)
        const fg = even ? ctx.palette.bg : baseColor(ctx)
        out.push(textLayer(`card-num-${idx}`, String(idx + 1).padStart(2, '0'), x + 26, y + 30, cardW - 52, { size: 72, weight: 800, color: fg, lineHeight: 1 }, ctx))
        out.push(textLayer(`card-text-${idx}`, item, x + 26, y + 130, cardW - 52, { size: 25, weight: 600, color: fg, lineHeight: 1.35 }, ctx))
      })
      return out
    },
  }
}

function buildColumns(items: string[], ctx: Ctx): PlacedBlock {
  const half = Math.ceil(items.length / 2)
  const left = items.slice(0, half)
  const right = items.slice(half)
  const colW = (ctx.contentW - 28) / 2
  const rowH = (text: string): number => textHeight(text, 27, colW - 72, 1.35) + 18
  const colH = (list: string[]): number => 72 + list.reduce((s, t) => s + rowH(t), 0)
  const height = Math.max(colH(left), colH(right)) + GAP
  return {
    height,
    place: (y: number) => {
      const out: ConvertedLayer[] = [
        shapeLayer('col-left', 'rect', ctx.contentX, y, colW, height - GAP, ctx.palette.accent, { radius: 24 }),
        { ...shapeLayer('col-right', 'rect', ctx.contentX + colW + 28, y, colW, height - GAP, '#ffffff', { radius: 24 }), opacity: 0.07 },
      ]
      const stack = (list: string[], x: number, fg: string): void => {
        let cursor = y + 36
        for (const text of list) {
          out.push(textLayer('col-item', text, x + 36, cursor, colW - 72, { size: 27, weight: 400, color: fg, lineHeight: 1.35 }, ctx))
          cursor += rowH(text)
        }
      }
      stack(left, ctx.contentX, ctx.palette.bg)
      stack(right, ctx.contentX + colW + 28, baseColor(ctx))
      return out
    },
  }
}

function buildChips(items: string[], ctx: Ctx): PlacedBlock {
  const height = 300 + GAP
  return {
    height,
    place: (y: number) => {
      const n = items.length
      const gap = 18
      const cardW = (ctx.contentW - gap * (n - 1)) / n
      const out: ConvertedLayer[] = []
      items.forEach((item, idx) => {
        const x = ctx.contentX + idx * (cardW + gap)
        out.push({ ...shapeLayer(`chip-${idx}`, 'rect', x, y, cardW, 300, '#ffffff', { radius: 20 }), opacity: 0.06 })
        out.push(shapeLayer(`chip-dot-${idx}`, 'circle', x + 22, y + 28, 48, 48, ctx.palette.accent))
        out.push(textLayer(`chip-letter-${idx}`, (item.trim().slice(0, 1) || '•').toUpperCase(), x + 22, y + 38, 48, { size: 22, weight: 800, color: ctx.palette.bg, align: 'center' }, ctx))
        out.push(textLayer(`chip-text-${idx}`, item, x + 22, y + 100, cardW - 44, { size: 24, weight: 600, color: baseColor(ctx), lineHeight: 1.35 }, ctx))
      })
      return out
    },
  }
}

function buildItems(items: string[], ctx: Ctx): PlacedBlock {
  const style = ctx.preset.itemStyle ?? 'bullet'
  if (style === 'cards') return buildCards(items, ctx)
  if (style === 'columns') return buildColumns(items, ctx)
  if (style === 'chips') return buildChips(items, ctx)
  return buildRows(items, ctx, style)
}

/* ── Decorations ──────────────────────────────────────────────────── */

function decoSplitBand(ctx: Ctx): ConvertedLayer[] {
  return [{ ...shapeLayer('split-band', 'rect', -162, -160, 1404, Math.round(ctx.frameH * 0.54), ctx.palette.accent), transform: { x: -162, y: -160, w: 1404, h: Math.round(ctx.frameH * 0.54), rotate: -6 } }]
}

function decoDuotoneBand(ctx: Ctx): ConvertedLayer[] {
  return [shapeLayer('duotone-band', 'rect', 0, 0, SCENE_W, 560, ctx.palette.accent)]
}

function decoTerminalDots(ctx: Ctx): ConvertedLayer[] {
  const colors = ['#ff5f57', '#febc2e', '#28c840']
  const out: ConvertedLayer[] = []
  colors.forEach((color, i) => {
    out.push(shapeLayer(`term-dot-${i}`, 'circle', ctx.contentX + i * 28, 170, 16, 16, color))
  })
  return out
}

function decoWireRings(ctx: Ctx): ConvertedLayer[] {
  const cx = 920
  const cy = 160
  const ring = (name: string, d: number): ConvertedLayer => ({
    ...shapeLayer(name, 'circle', cx - d / 2, cy - d / 2, d, d, 'transparent'),
    opacity: 1,
  })
  return [
    { ...ring('wire-outer', 702), stroke: { color: ctx.palette.accent, width: 2 }, opacity: 0.5 },
    { ...ring('wire-inner', 515), stroke: { color: ctx.palette.accent, width: 2 }, opacity: 0.65 },
    shapeLayer('wire-dot', 'circle', cx - 14, cy - 14, 28, 28, ctx.palette.accent),
  ]
}

const DECORATIONS: Record<string, (ctx: Ctx) => ConvertedLayer[]> = {
  splitBand: decoSplitBand,
  duotoneBand: decoDuotoneBand,
  terminalDots: decoTerminalDots,
  wireRings: decoWireRings,
}

/* ── Image regions ────────────────────────────────────────────────── */

interface Zone {
  top: number
  bottom: number
}

function placeholderImage(name: string, x: number, y: number, w: number, h: number, ctx: Ctx): ConvertedLayer {
  return { ...shapeLayer(name, 'rect', x, y, w, h, ctx.palette.accent, { radius: 20 }), opacity: 0.13 }
}

function regionImage(name: string, src: string | undefined, x: number, y: number, w: number, h: number, ctx: Ctx): ConvertedLayer {
  if (src) {
    return { type: 'image', name, visible: true, locked: false, opacity: 1, transform: { x, y, w, h, rotate: 0 }, src, fit: 'cover' }
  }
  return placeholderImage(name, x, y, w, h, ctx)
}

function zoneFor(region: ImageRegion | undefined, frameH: number): Zone {
  const zones: Record<string, Zone> = {
    grid2x2: { top: 120, bottom: 470 },
    wall: { top: frameH - 440, bottom: frameH - 160 },
    focusTop: { top: 760, bottom: frameH - 160 },
    polaroid: { top: 780, bottom: frameH - 160 },
  }
  return (region && zones[region]) ?? { top: 120, bottom: frameH - FOOTER_RESERVE }
}

function regionGrid(images: Array<string | undefined>, ctx: Ctx): ConvertedLayer[] {
  const top = 500
  const gridH = ctx.frameH - top - 180
  const cellH = (gridH - 16) / 2
  const cellW = (ctx.contentW - 16) / 2
  const out: ConvertedLayer[] = []
  for (let i = 0; i < 4; i++) {
    const cx = ctx.contentX + (i % 2) * (cellW + 16)
    const cy = top + Math.floor(i / 2) * (cellH + 16)
    out.push(regionImage(`grid-${i}`, images[i], cx, cy, cellW, cellH, ctx))
  }
  return out
}

function regionLayers(region: ImageRegion | undefined, ctx: Ctx): ConvertedLayer[] {
  const images = ctx.data.images ?? []
  if (region === 'leftPanel') {
    return [regionImage('photo-panel', images[0], 0, 0, 497, ctx.frameH, ctx)]
  }
  if (region === 'polaroid') {
    const cardW = 620
    const cardH = 570
    const x = (SCENE_W - cardW) / 2
    const y = 140
    return [
      shapeLayer('polaroid-card', 'rect', x, y, cardW, cardH, '#ffffff', { radius: 12 }),
      regionImage('polaroid-photo', images[0], x + 26, y + 26, cardW - 52, cardH - 52, ctx),
    ]
  }
  if (region === 'grid2x2') {
    return regionGrid(images, ctx)
  }
  if (region === 'wall') {
    const top = 120
    const wallH = ctx.frameH - 470 - top
    const leftW = Math.round((ctx.contentW - 16) * 0.55)
    const rightW = ctx.contentW - 16 - leftW
    const rx = ctx.contentX + leftW + 16
    return [
      regionImage('wall-tall', images[0], ctx.contentX, top, leftW, wallH, ctx),
      regionImage('wall-top', images[1], rx, top, rightW, (wallH - 16) / 2, ctx),
      regionImage('wall-bottom', images[2], rx, top + (wallH + 16) / 2, rightW, (wallH - 16) / 2, ctx),
    ]
  }
  if (region === 'focusTop') {
    return [regionImage('focus-banner', images[0], 48, 36, SCENE_W - 96, 660, ctx)]
  }
  return []
}

/* ── Footer ───────────────────────────────────────────────────────── */

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function footerLayers(ctx: Ctx): ConvertedLayer[] {
  const y = ctx.frameH - 70
  const out: ConvertedLayer[] = [
    textLayer('page-num', `${pad2(ctx.index + 1)} / ${pad2(ctx.total)}`, ctx.contentX + ctx.contentW - 160, y, 160, { size: 22, weight: 500, color: baseColor(ctx), opacity: 0.55, align: 'right' }, ctx),
  ]
  if (ctx.data.footer?.trim()) {
    out.push(textLayer('footer', ctx.data.footer, ctx.contentX, y, ctx.contentW - 200, { size: 22, weight: 500, color: baseColor(ctx), opacity: 0.55 }, ctx))
  }
  return out
}

/* ── Orchestrator ─────────────────────────────────────────────────── */

function backgroundLayer(ctx: Ctx): ConvertedLayer {
  const firstImage = (ctx.data.images ?? [])[0]
  if (ctx.preset.imageRegion === 'fullBleed' && firstImage) {
    return { type: 'background', name: 'bg', visible: true, locked: false, opacity: 1, transform: { x: 0, y: 0, w: SCENE_W, h: ctx.frameH, rotate: 0 }, fill: { kind: 'image', src: firstImage, fit: 'cover', dim: 0.35 } }
  }
  return { type: 'background', name: 'bg', visible: true, locked: false, opacity: 1, transform: { x: 0, y: 0, w: SCENE_W, h: ctx.frameH, rotate: 0 }, fill: { kind: 'color', color: ctx.palette.bg } }
}

function collectBlocks(ctx: Ctx): PlacedBlock[] {
  const out: PlacedBlock[] = []
  for (const kind of ctx.preset.blocks) {
    const built = BLOCKS[kind](ctx)
    if (built) out.push(built)
  }
  return out
}

function placeFlow(blocks: PlacedBlock[], zone: Zone): ConvertedLayer[] {
  const total = blocks.reduce((sum, b) => sum + b.height, 0)
  let cursor = Math.max(zone.top, zone.top + (zone.bottom - zone.top - total) / 2)
  const out: ConvertedLayer[] = []
  for (const block of blocks) {
    out.push(...block.place(cursor))
    cursor += block.height
  }
  return out
}

export function convertLegacySlide(
  templateKey: string,
  data: ConverterData,
  palette: ConverterPalette,
  options: ConverterOptions,
): ConvertedLayer[] {
  const preset = presetFor(templateKey)
  const ctx: Ctx = {
    data,
    preset,
    palette,
    frameH: options.frameH,
    index: options.index,
    total: options.total,
    contentX: 96,
    contentW: SCENE_W - 192,
  }
  const layers: ConvertedLayer[] = [backgroundLayer(ctx)]
  const decoration = preset.decoration ? DECORATIONS[preset.decoration] : undefined
  if (decoration) layers.push(...decoration(ctx))
  layers.push(...regionLayers(preset.imageRegion, ctx))
  layers.push(...placeFlow(collectBlocks(ctx), zoneFor(preset.imageRegion, options.frameH)))
  layers.push(...footerLayers(ctx))
  return layers
}

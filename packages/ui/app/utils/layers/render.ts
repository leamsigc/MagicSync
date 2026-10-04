/**
 * Renders a slide's layer list into a self-contained inline-styled HTML string.
 *
 * Output contract (keeps the whole export pipeline unchanged):
 * - root div is 1080 × frame.h, `overflow:hidden`, applies `--slide-fx`
 * - every interactive layer carries `data-layer-id` for stage selection
 * - background layers always render first; everything else in array order (z)
 * - the topmost `effect` layer becomes a CSS filter + blend overlays on a
 *   content wrapper (effect layers don't paint their own div)
 * - frames render last (above content) regardless of position — they are the
 *   "outer" chrome; everything else keeps full user-controlled stacking
 */
import { fontFamilyStack, toSlideData } from '../carouselTemplates'
import { patternStyle } from '../patterns'
import { effectPreset, framePreset, overlayPreset } from '../designAssets'
import { renderHtmlTemplateContent } from './legacy'
import type {
  BackgroundFill,
  BackgroundLayer,
  EffectLayer,
  FrameLayer,
  GradientSpec,
  HtmlLayer,
  ImageLayer,
  LayerBase,
  OverlayLayer,
  PatternLayer,
  ShapeLayer,
  SlideLayer,
  TextLayer,
} from './types'

export interface RenderPalette {
  bg: string
  text: string
  accent: string
  font?: string
}

export interface RenderOptions {
  index: number
  total: number
  handle?: string
  /** Replaces the background layers with deck-flow chrome (pan/plane). Return '' to keep normal backgrounds. */
  backgroundOverride?: (index: number, total: number) => string
}

// Never throws — see templates.ts esc(): layer fields (src, content) can be
// undefined on migrated/AI-imported slides; one bad layer must not kill render.
const esc = (s: unknown): string => {
  if (s === undefined || s === null) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function gradientCss(g: GradientSpec): string {
  const stops = g.stops.map(s => `${s.color} ${s.pos}%`).join(', ')
  if (g.kind === 'linear') return `linear-gradient(${g.angle}deg, ${stops})`
  if (g.kind === 'radial') return `radial-gradient(circle at center, ${stops})`
  return `conic-gradient(from ${g.angle}deg, ${stops})`
}

function fillCss(fill: string | GradientSpec): string {
  return typeof fill === 'string' ? fill : gradientCss(fill)
}

function shadowCss(s?: { x: number, y: number, blur: number, color: string, opacity: number }): string {
  if (!s || s.blur <= 0 && s.x === 0 && s.y === 0) return ''
  return `box-shadow:${s.x}px ${s.y}px ${s.blur}px ${hexA(s.color, s.opacity)}`
}

function hexA(hex: string, opacity: number): string {
  const alpha = Math.round(Math.min(1, Math.max(0, opacity)) * 255).toString(16).padStart(2, '0')
  return `${hex}${alpha}`
}

function baseCss(l: LayerBase): string {
  const t = l.transform
  const parts = [
    'position:absolute',
    `left:${t.x}px`,
    `top:${t.y}px`,
    `width:${t.w}px`,
  ]
  if (t.h !== undefined) parts.push(`height:${t.h}px`)
  parts.push(`opacity:${l.opacity}`)
  if (l.visible === false) parts.push('display:none')
  if (t.rotate) parts.push(`transform:rotate(${t.rotate}deg)`)
  if (l.filter) parts.push(`filter:${l.filter}`)
  return parts.join(';')
}

function wrap(l: LayerBase, inner: string): string {
  return `<div data-layer-id="${l.id}" style="${baseCss(l)};overflow:hidden">${inner}</div>`
}

// ── Background ────────────────────────────────────────────────────────────

function bgFillCss(fill: BackgroundFill): { css: string, dim: number, extra: string } {
  if (fill.kind === 'color') {
    return { css: `background:${fill.color}`, dim: 0, extra: '' }
  }
  if (fill.kind === 'gradient') {
    return { css: `background:${gradientCss(fill.gradient)}`, dim: 0, extra: '' }
  }
  const sliceCss = fill.slice
    ? fill.slice.direction === 'vertical'
      ? `background-size:100% ${fill.slice.count * 100}%;background-position:0 ${(fill.slice.index / Math.max(1, fill.slice.count - 1)) * 100}%`
      : `background-size:${fill.slice.count * 100}% 100%;background-position:${(fill.slice.index / Math.max(1, fill.slice.count - 1)) * 100}% 0`
    : `background-size:${fill.fit === 'contain' ? 'contain' : 'cover'};background-position:center`
  return {
    css: `background-image:url(${esc(fill.src)});background-repeat:no-repeat;${sliceCss}`,
    dim: fill.dim,
    extra: '',
  }
}

function renderBackground(l: BackgroundLayer): string {
  const { css, dim, extra } = bgFillCss(l.fill)
  const dimDiv = dim > 0 ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,${dim});pointer-events:none"></div>` : ''
  return `<div data-layer-id="${l.id}" style="${baseCss(l)};${css};${extra}overflow:hidden">${dimDiv}</div>`
}

// ── Text ──────────────────────────────────────────────────────────────────

function renderText(l: TextLayer): string {
  const fontStack = fontFamilyStack(l.font) || 'sans-serif'
  let color = l.color
  let extra = ''
  if (l.gradient) {
    color = 'transparent'
    extra += `background:${gradientCss(l.gradient)};background-clip:text;-webkit-background-clip:text;`
  }
  const bg = l.bg ? `background:${l.bg};` : ''
  const pad = l.padding ? `padding:${l.padding}px;` : ''
  const radius = l.radius ? `border-radius:${l.radius}px;` : ''
  const shadow = shadowCss(l.shadow)
  const align = l.align === 'center' ? 'center' : l.align === 'right' ? 'right' : 'left'
  const content = (l.content ?? '').split('\n').map(esc).join('<br>')
  return wrap(l, `<div style="font-family:${fontStack};font-size:${l.fontSize}px;font-weight:${l.fontWeight};text-align:${align};line-height:${l.lineHeight};letter-spacing:${l.letterSpacing}px;color:${color};${bg}${pad}${radius}${shadow}${extra}white-space:pre-wrap;width:100%;height:100%;overflow:hidden">${content}</div>`)
}

// ── Image ─────────────────────────────────────────────────────────────────

function renderImage(l: ImageLayer): string {
  const radius = l.radius !== undefined ? `border-radius:${l.radius}px;` : ''
  const border = l.border ? `border:${l.border.width}px solid ${l.border.color};` : ''
  const shadow = shadowCss(l.shadow)
  return wrap(l, `<img src="${esc(l.src)}" alt="" draggable="false" style="width:100%;height:100%;object-fit:${l.fit};${radius}${border}${shadow}display:block">`)
}

// ── Shapes ────────────────────────────────────────────────────────────────

const SHAPE_SVG: Record<string, string> = {
  arrow: '<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%"><path d="M10 40 H78 V22 L96 50 L78 78 V60 H10 Z"/></svg>',
  star: '<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%"><polygon points="50,4 61,38 97,38 68,59 79,94 50,73 21,94 32,59 3,38 39,38"/></svg>',
  triangle: '<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%"><polygon points="50,6 96,92 4,92"/></svg>',
  heart: '<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%"><path d="M50 88 C 20 64 6 46 6 28 C 6 12 20 4 33 4 C 41 4 47 8 50 14 C 53 8 59 4 67 4 C 80 4 94 12 94 28 C 94 46 80 64 50 88 Z"/></svg>',
  diamond: '<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%"><polygon points="50,4 96,50 50,96 4,50"/></svg>',
}

function renderShape(l: ShapeLayer): string {
  const fill = fillCss(l.fill)
  const stroke = l.stroke ? `stroke:${l.stroke.color};stroke-width:${l.stroke.width}` : ''
  if (l.shape === 'rect') {
    const radius = l.radius !== undefined ? `border-radius:${l.radius}px;` : ''
    return wrap(l, `<div style="width:100%;height:100%;background:${fill};${radius}${stroke}"></div>`)
  }
  if (l.shape === 'circle') {
    return wrap(l, `<div style="width:100%;height:100%;background:${fill};border-radius:50%;${stroke}"></div>`)
  }
  if (l.shape === 'line') {
    return wrap(l, `<div style="width:100%;height:100%;display:flex;align-items:center"><div style="width:100%;height:${l.stroke?.width ?? 4}px;background:${fill}"></div></div>`)
  }
  return wrap(l, renderSvgShape(l, fill))
}

function renderSvgShape(l: ShapeLayer, fill: string): string {
  const svg = SHAPE_SVG[l.shape]
  if (svg) {
    return svg.includes('</svg>') && (l.fill !== '#000000')
      ? svg.replace('<svg', `<svg fill="${esc(fill)}"`)
      : svg
  }
  return `<div style="width:100%;height:100%;background:${fill}"></div>`
}

// ── HTML ──────────────────────────────────────────────────────────────────

function renderHtml(l: HtmlLayer, palette: RenderPalette, opts: RenderOptions): string {
  let content = ''
  if (l.bindings?.templateKey) {
    content = renderHtmlTemplateContent(
      l.bindings.templateKey,
      toSlideData(l.bindings.data),
      { bg: palette.bg, text: palette.text, accent: palette.accent, patternColor: palette.accent, font: palette.font },
      opts.index,
      opts.total,
      opts.handle,
    )
  } else {
    content = l.html ?? ''
  }
  return wrap(l, content)
}

// ── Pattern / overlay / frame ─────────────────────────────────────────────

function renderPattern(l: PatternLayer): string {
  const styles = patternStyle(l.key, l.color, l.opacity)
  const css = Object.entries(styles)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`)
    .join(';')
  return `<div data-layer-id="${l.id}" style="position:absolute;inset:0;pointer-events:none;${css}${l.visible === false ? 'display:none;' : ''}"></div>`
}

function renderOverlay(l: OverlayLayer): string {
  const preset = overlayPreset(l.key)
  const css = preset.css(l.color ?? '#000000')
  if (!css) return `<div data-layer-id="${l.id}" style="position:absolute;inset:0;pointer-events:none;display:none"></div>`
  return `<div data-layer-id="${l.id}" style="position:absolute;inset:0;pointer-events:none;background:${css};opacity:${l.opacity}${l.visible === false ? ';display:none' : ''}"></div>`
}

function renderFrame(l: FrameLayer): string {
  const preset = framePreset(l.key)
  const css = preset.css(l.color ?? '#ffffff', l.color2 ?? l.color ?? '#f97316', l.thickness ?? 12)
  if (!css) return `<div data-layer-id="${l.id}" style="position:absolute;inset:0;pointer-events:none;display:none"></div>`
  return `<div data-layer-id="${l.id}" style="position:absolute;inset:0;pointer-events:none;${css}${l.visible === false ? 'display:none;' : ''}"></div>`
}

// ── Main ──────────────────────────────────────────────────────────────────

export function renderSlideLayers(
  layers: SlideLayer[],
  frame: { w: number, h: number },
  palette: RenderPalette,
  opts: RenderOptions,
): string {
  const backgrounds = layers.filter((l): l is BackgroundLayer => l.type === 'background')
  const overrideHtml = opts.backgroundOverride ? opts.backgroundOverride(opts.index, opts.total) : ''
  const backgroundsHtml = overrideHtml || backgrounds.map(renderBackground).join('')
  const content = layers.filter(l => l.type !== 'background' && l.type !== 'frame' && l.type !== 'effect')
  const frames = layers.filter((l): l is FrameLayer => l.type === 'frame')
  const effectLayer = [...layers].reverse().find((l): l is EffectLayer => l.type === 'effect' && l.visible !== false)
  const effect = effectLayer ? effectPreset(effectLayer.key) : effectPreset('none')

  const contentHtml = content.map((l) => {
    switch (l.type) {
      case 'text': return renderText(l)
      case 'image': return renderImage(l)
      case 'shape': return renderShape(l)
      case 'html': return renderHtml(l, palette, opts)
      case 'pattern': return renderPattern(l)
      case 'overlay': return renderOverlay(l)
      default: return ''
    }
  }).join('')

  const blendOverlays = effect.overlays.map((o, i) =>
    `<div style="position:absolute;inset:0;background:${o.color};mix-blend-mode:${o.blend};opacity:${o.opacity};pointer-events:none" data-effect-blend="${i}"></div>`,
  ).join('')

  const effectMarker = effectLayer
    ? `<div data-layer-id="${effectLayer.id}" style="position:absolute;inset:0;pointer-events:none;${effectLayer.visible === false ? 'display:none;' : ''}"></div>`
    : ''

  // Deck handle footer — mirrors the legacy pageFooter. Legacy templates with
  // live bindings already render their own footer, so skip those.
  const hasBindingFooter = layers.some(l => l.type === 'html' && l.bindings?.templateKey)
  const footerHtml = (opts.handle && !hasBindingFooter)
    ? `<div style="position:absolute;left:64px;right:64px;bottom:44px;display:flex;justify-content:space-between;align-items:center;font-size:22px;letter-spacing:0.12em;text-transform:uppercase;color:${esc(palette.text)};opacity:0.55">
      <span>${esc(opts.handle)}</span>
      <span style="font-variant-numeric:tabular-nums">${String(opts.index + 1).padStart(2, '0')} / ${String(opts.total).padStart(2, '0')}</span>
    </div>`
    : ''

  return `<div data-slide-root style="position:relative;width:${frame.w}px;height:${frame.h}px;overflow:hidden;background:transparent;transform:var(--slide-fx,none)">
    ${backgroundsHtml}
    <div data-effect-wrap style="position:absolute;inset:0;${effect.filter ? `filter:${effect.filter};` : ''}">
      ${contentHtml}
      ${blendOverlays}
    </div>
    ${effectMarker}
    ${footerHtml}
    ${frames.map(renderFrame).join('')}
  </div>`
}

/** Applies the legacy `borderRadius` wrap (used by the legacy render path). */
export function wrapBorderRadius(html: string, radius: number): string {
  if (radius <= 0) return html
  return `<div style="position:absolute;inset:0;border-radius:${radius}px;overflow:hidden">${html}</div>`
}
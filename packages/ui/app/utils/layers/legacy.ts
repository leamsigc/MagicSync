/**
 * Legacy slide → layer migration.
 *
 * Old carousels store slides as `{ templateKey, data, pattern, bgImage, customHtml }`.
 * The editor is layer-based now, so every loaded legacy slide is migrated once into
 * SlideLayer[] (background + pattern + image + content). The legacy template renderers
 * stay as content-only "html templates" via `renderHtmlTemplateContent`.
 */
import { CAROUSEL_TEMPLATES, fontFamilyStack, type SlideData, type SlidePalette } from '../carouselTemplates'
import { FRAME_W, type SlideLayer } from './types'

export interface LegacyBgImage {
  url: string
  dim: number
  shadow: { x: number, y: number, blur: number, opacity: number }
  transform?: { x: number, y: number, scale: number }
}

export interface LegacySlideShape {
  templateKey?: string
  data?: SlideData
  pattern?: string
  patternColor?: string
  patternOpacity?: number
  bgImage?: LegacyBgImage | null
  customHtml?: string
}

/** Finds the index just past the balanced `</div>` for the `<div ...>` starting at `startIdx`. */
function balancedDivEnd(html: string, startIdx: number): number {
  const openTagEnd = html.indexOf('>', startIdx)
  if (openTagEnd === -1) return html.length
  let depth = 1
  const re = /<\/?div[\s>]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (m.index <= openTagEnd) continue
    if (m[0].startsWith('</div')) depth--
    else depth++
    if (depth === 0) {
      const close = html.indexOf('>', m.index)
      return close === -1 ? html.length : close + 1
    }
  }
  return html.length
}

/**
 * Removes the legacy chrome from a template render so it can live inside the
 * layer system (which provides its own background/pattern/image layers):
 * - strips the `<div data-image-slot="bg">…</div>` full-bleed background div
 * - removes the `__PATTERN__` placeholder
 * - injects font + slide-fx transform using the same convention as `renderSlideHtml`
 */
export function stripLegacyChrome(html: string, palette: { font?: string }): string {
  let out = html
  const start = out.indexOf('<div data-image-slot="bg"')
  if (start !== -1) {
    const end = balancedDivEnd(out, start)
    out = out.slice(0, start) + out.slice(end)
  }
  out = out.replace('__PATTERN__', '')
  const fontStack = fontFamilyStack(palette.font)
  const fontCss = fontStack ? `font-family:${fontStack};` : ''
  out = out.replaceAll(
    'position:relative;height:100%',
    `position:relative;height:100%;transform:var(--slide-fx,none);transform-origin:50% 50%;${fontCss}`,
  )
  return out
}

/**
 * Renders a legacy template as content-only HTML (no bg/pattern layers).
 * `handle` is merged into `data.footer` like the legacy renderer did.
 */
export function renderHtmlTemplateContent(
  templateKey: string,
  data: SlideData,
  palette: SlidePalette,
  index: number,
  total: number,
  handle?: string,
): string {
  const template = CAROUSEL_TEMPLATES.find(tpl => tpl.key === templateKey) ?? CAROUSEL_TEMPLATES[0]!
  const effectiveData: SlideData = handle ? { ...data, footer: handle } : data
  return stripLegacyChrome(template.render(effectiveData, palette, index, total), palette)
}

/** Migrates a legacy slide into layer-based slides. */
export function migrateLegacySlide(slide: LegacySlideShape, palette: { bg: string, text: string, font?: string }, frameH: number): SlideLayer[] {
  const layers: SlideLayer[] = [buildBgLayer(palette.bg, frameH)]

  const patternKey = slide.pattern ?? 'none'
  if (patternKey !== 'none') {
    layers.push(buildPatternLayer(patternKey, slide.patternColor ?? palette.text, slide.patternOpacity ?? 0.08, frameH))
  }

  if (slide.bgImage?.url) {
    layers.push(buildImageLayer(slide.bgImage, frameH))
  }

  if (slide.customHtml) {
    layers.push(buildHtmlLayer('Custom HTML', { html: slide.customHtml }, frameH))
  } else if (slide.templateKey) {
    layers.push(buildHtmlLayer('Content', {
      bindings: {
        templateKey: slide.templateKey,
        data: { ...(slide.data ?? { headline: 'Your headline here' }) },
      },
    }, frameH))
  }

  return layers
}

function buildBgLayer(color: string, frameH: number): SlideLayer {
  return {
    id: `layer-bg-${Math.random().toString(36).slice(2, 8)}`,
    type: 'background',
    name: 'Background',
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x: 0, y: 0, w: FRAME_W, h: frameH, rotate: 0 },
    fill: { kind: 'color', color },
  }
}

function buildPatternLayer(key: string, color: string, opacity: number, frameH: number): SlideLayer {
  return {
    id: `layer-pattern-${Math.random().toString(36).slice(2, 8)}`,
    type: 'pattern',
    name: 'Pattern',
    visible: true,
    locked: false,
    opacity,
    transform: { x: 0, y: 0, w: FRAME_W, h: frameH, rotate: 0 },
    key,
    color,
  }
}

function buildImageLayer(bgImage: LegacyBgImage, frameH: number): SlideLayer {
  const s = bgImage.shadow
  return {
    id: `layer-img-${Math.random().toString(36).slice(2, 8)}`,
    type: 'image',
    name: 'Image',
    visible: true,
    locked: false,
    opacity: Math.max(0.1, 1 - (bgImage.dim ?? 0.25)),
    transform: { x: 0, y: 0, w: FRAME_W, h: frameH, rotate: 0 },
    src: bgImage.url,
    fit: 'cover',
    shadow: { x: s.x, y: s.y, blur: s.blur, color: '#000000', opacity: s.opacity },
  }
}

function buildHtmlLayer(name: string, extra: { html?: string, bindings?: { templateKey: string, data: Record<string, unknown> } }, frameH: number): SlideLayer {
  return {
    id: `layer-html-${Math.random().toString(36).slice(2, 8)}`,
    type: 'html',
    name,
    visible: true,
    locked: false,
    opacity: 1,
    transform: { x: 0, y: 0, w: FRAME_W, h: frameH, rotate: 0 },
    ...extra,
  }
}
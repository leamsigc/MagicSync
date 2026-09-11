/**
 * Layer-spec → fabric scene JSON translator — isomorphic, pure, DOM-free.
 *
 * Input: the creator's `SlideLayer` JSON (see
 * `app/pages/tools/carousel-creator/layers/types.ts`). Output: plain JSON that
 * `fabric.Canvas.loadFromJSON` hydrates in the browser and the Node renderer
 * interprets on the server. This module never imports fabric itself so both
 * runtimes (and plain Node tests) can use it.
 *
 * Kind mapping:
 * - background/text/image/shape → native fabric objects (Rect/Textbox/Image/
 *   Circle/Triangle/Line/Path).
 * - pattern/overlay/frame/effect → typed descriptor objects the two renderers
 *   implement identically (documented in the renderer contract, Task 1.5).
 * - html → explicit `HtmlUnsupported` marker (feeds the Task 1.3 conversion
 *   decision; never silently dropped).
 */
import { SCENE_VERSION, SCENE_W } from './constants'

export interface ScenePalette {
  bg: string
  text: string
  accent: string
  font?: string
}

export interface SceneTransform {
  x: number
  y: number
  w: number
  h?: number
  rotate: number
}

/** Minimal structural view of a creator layer — enough to translate. */
export interface InputLayer {
  type: string
  visible: boolean
  opacity: number
  transform: SceneTransform
  filter?: string
  [key: string]: unknown
}

export type FabricObjectJson = Record<string, unknown> & { type: string }

export interface FabricSlideScene {
  version: string
  width: number
  height: number
  objects: FabricObjectJson[]
}

const TOKEN_MAP: Record<string, keyof ScenePalette> = {
  __BG__: 'bg',
  __TEXT__: 'text',
  __ACCENT__: 'accent',
}

const TOKEN_RE = /__(BG|TEXT|ACCENT)__/g

/** Resolve `__BG__`/`__TEXT__`/`__ACCENT__` palette tokens inside a string. */
export function resolveToken(value: string, palette: ScenePalette): string {
  return value.replace(TOKEN_RE, match => String(palette[TOKEN_MAP[match] ?? 'bg']))
}

/** Deep-clone `value` with palette tokens resolved in every string. */
export function resolveTokensDeep<T>(value: T, palette: ScenePalette): T {
  const raw = JSON.stringify(value)
  if (!raw) return value
  const parsed: unknown = JSON.parse(raw.replace(TOKEN_RE, match => String(palette[TOKEN_MAP[match] ?? 'bg'])))
  if (typeof parsed !== 'object' || parsed === null) return value
  return parsed as T
}

function baseObject(layer: InputLayer): Record<string, unknown> {
  const t = layer.transform
  return {
    left: t.x,
    top: t.y,
    angle: t.rotate ?? 0,
    opacity: layer.opacity ?? 1,
  }
}

function gradientToFabric(gradient: { kind: string, angle: number, stops: Array<{ color: string, pos: number }> }, width: number, height: number): Record<string, unknown> {
  const stops = gradient.stops.map(s => ({ offset: s.pos / 100, color: s.color }))
  const radial = gradient.kind === 'radial'
  return {
    type: radial ? 'radial' : 'linear',
    coords: radial
      ? { x1: width / 2, y1: height / 2, x2: width / 2, y2: height / 2, r1: 0, r2: Math.max(width, height) / 2 }
      : { x1: 0, y1: 0, x2: width, y2: 0 },
    colorStops: stops,
    gradientTransform: gradient.kind === 'linear' ? [Math.cos((gradient.angle * Math.PI) / 180), 0, 0, 1, 0, 0] : undefined,
  }
}

function backgroundToObject(layer: InputLayer, width: number, height: number): FabricObjectJson {
  const fill = layer.fill as { kind: string, color?: string, gradient?: { kind: string, angle: number, stops: Array<{ color: string, pos: number }> }, src?: string } | undefined
  const kind = fill?.kind ?? 'color'
  if (kind === 'gradient' && fill?.gradient) {
    return { type: 'Rect', ...baseObject(layer), width, height, fill: gradientToFabric(fill.gradient, width, height) }
  }
  if (kind === 'image' && fill?.src) {
    return { type: 'Image', ...baseObject(layer), src: fill.src, width, height }
  }
  return { type: 'Rect', ...baseObject(layer), width, height, fill: (fill?.color as string | undefined) ?? '#0f0e0d' }
}

function textToObject(layer: InputLayer, palette: ScenePalette): FabricObjectJson {
  const t = layer.transform
  return {
    type: 'Textbox',
    ...baseObject(layer),
    text: String(layer.content ?? ''),
    fontFamily: String(layer.font ?? palette.font ?? 'Inter'),
    fontSize: Number(layer.fontSize ?? 48),
    fontWeight: Number(layer.fontWeight ?? 700),
    textAlign: String(layer.align ?? 'center'),
    lineHeight: Number(layer.lineHeight ?? 1.2),
    charSpacing: Number(layer.letterSpacing ?? 0) * 10,
    fill: String(layer.color ?? '__TEXT__'),
    width: t.w,
  }
}

function imageToObject(layer: InputLayer): FabricObjectJson {
  const t = layer.transform
  return {
    type: 'Image',
    ...baseObject(layer),
    src: String(layer.src ?? ''),
    width: t.w,
    height: t.h ?? t.w,
  }
}

/** Path data in a 100×100 box; scaled to the layer transform at hydration. */
const SHAPE_PATHS: Record<string, string> = {
  star: 'M50 0 L61 35 L98 35 L68 57 L79 91 L50 70 L21 91 L32 57 L2 35 L39 35 Z',
  heart: 'M50 88 C20 62 2 42 2 26 C2 12 13 2 25 2 C35 2 45 8 50 18 C55 8 65 2 75 2 C87 2 98 12 98 26 C98 42 80 62 50 88 Z',
  diamond: 'M50 0 L100 50 L50 100 L0 50 Z',
  arrow: 'M0 35 L60 35 L60 10 L100 50 L60 90 L60 65 L0 65 Z',
}

function shapeToObject(layer: InputLayer): FabricObjectJson {
  const t = layer.transform
  const shape = String(layer.shape ?? 'rect')
  const fill = layer.fill as string | undefined
  const stroke = layer.stroke as { color?: string, width?: number } | undefined
  const strokeProps = stroke ? { stroke: stroke.color ?? '#ffffff', strokeWidth: stroke.width ?? 2 } : {}
  const radius = Number((layer as Record<string, unknown>).radius ?? 0)
  const radiusProps = radius > 0 ? { rx: radius, ry: radius } : {}
  const direct: Record<string, string> = { rect: 'Rect', circle: 'Circle', triangle: 'Triangle', line: 'Line' }
  if (direct[shape]) {
    return { type: direct[shape], ...baseObject(layer), width: t.w, height: shape === 'circle' ? t.w : (t.h ?? t.w), fill: fill ?? '__ACCENT__', ...strokeProps, ...radiusProps }
  }
  return {
    type: 'Path',
    ...baseObject(layer),
    path: SHAPE_PATHS[shape] ?? SHAPE_PATHS.star,
    scaleX: t.w / 100,
    scaleY: (t.h ?? t.w) / 100,
    fill: fill ?? '__ACCENT__',
    ...strokeProps,
  }
}

/** Engine-interpreted kinds pass through as typed descriptors (Task 1.5 contract). */
function descriptorToObject(layer: InputLayer): FabricObjectJson {
  const { id, ...rest } = layer as InputLayer & { id?: unknown }
  void id
  return { ...rest, type: `Scene${String(layer.type).charAt(0).toUpperCase()}${String(layer.type).slice(1)}` } as FabricObjectJson
}

const BUILDERS: Record<string, (layer: InputLayer, ctx: { width: number, height: number, palette: ScenePalette }) => FabricObjectJson> = {
  background: (layer, ctx) => backgroundToObject(layer, ctx.width, ctx.height),
  text: (layer, ctx) => textToObject(layer, ctx.palette),
  image: layer => imageToObject(layer),
  shape: layer => shapeToObject(layer),
  pattern: layer => descriptorToObject(layer),
  overlay: layer => descriptorToObject(layer),
  frame: layer => descriptorToObject(layer),
  effect: layer => descriptorToObject(layer),
}

export function layerToFabricObject(layer: InputLayer, width: number, height: number, palette: ScenePalette): FabricObjectJson {
  if (layer.type === 'html') {
    return { type: 'HtmlUnsupported', ...baseObject(layer), templateKey: (layer.bindings as { templateKey?: string } | undefined)?.templateKey ?? null }
  }
  const build = BUILDERS[layer.type]
  const raw = build ? build(layer, { width, height, palette }) : { type: 'Unknown', ...baseObject(layer) }
  return resolveTokensDeep(raw, palette) as FabricObjectJson
}

export interface SlideSceneOptions {
  width?: number
  height: number
  palette: ScenePalette
}

/**
 * Translate one slide's layers to a fabric scene. Backgrounds paint first
 * (stable partition, mirrors `layers/render.ts`), everything else keeps
 * array order; invisible layers are dropped. Each object carries `layerIndex`
 * (its index in the input array) so editors can write interactions back to
 * the owning layer even after the background-first reorder.
 */
export function slideToFabricScene(layers: InputLayer[], options: SlideSceneOptions): FabricSlideScene {
  const width = options.width ?? SCENE_W
  const visible = layers.map((layer, index) => ({ layer, index })).filter(entry => entry.layer.visible)
  const ordered = [
    ...visible.filter(entry => entry.layer.type === 'background'),
    ...visible.filter(entry => entry.layer.type !== 'background'),
  ]
  return {
    version: SCENE_VERSION,
    width,
    height: options.height,
    objects: ordered.map(entry => ({ ...layerToFabricObject(entry.layer, width, options.height, options.palette), layerIndex: entry.index })),
  }
}

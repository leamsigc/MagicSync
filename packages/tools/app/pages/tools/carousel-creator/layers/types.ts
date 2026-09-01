/**
 * Layer model for the carousel creator.
 *
 * Every slide is an ordered list of layers. The array order is the z-order
 * (index 0 = bottom). Layers are rendered to a plain inline-styled HTML string
 * by `render.ts`, which keeps modern-screenshot PNG export, thumbnails,
 * platform previews and the shared page working.
 *
 * Coordinates are in a 1080 × frame.height design space (1080×1350 portrait
 * or 1080×1080 square).
 */

export interface GradientStop {
  color: string
  pos: number // 0-100
}

export type GradientSpec = {
  kind: 'linear' | 'radial' | 'conic'
  angle: number // deg
  stops: GradientStop[]
}

export interface TransformSpec {
  x: number
  y: number
  w: number
  h?: number // undefined = auto (text layers)
  rotate: number
}

export interface ShadowSpec {
  x: number
  y: number
  blur: number
  color: string
  opacity: number
}

export interface BorderSpec {
  width: number
  color: string
  radius: number
}

export interface LayerBase {
  id: string
  type: LayerType
  name: string
  visible: boolean
  locked: boolean
  opacity: number // 0-1
  transform: TransformSpec
  /** Optional per-layer CSS filter (applied to this layer only) */
  filter?: string
}

export type LayerType =
  | 'background'
  | 'text'
  | 'image'
  | 'shape'
  | 'html'
  | 'pattern'
  | 'overlay'
  | 'frame'
  | 'effect'

export type BackgroundFill =
  | { kind: 'color', color: string }
  | { kind: 'gradient', gradient: GradientSpec }
  | {
      kind: 'image'
      src: string
      fit: 'cover' | 'contain' | 'fill'
      dim: number
      /** Slice of a tall/wide image shown on this slide (From-Image flow) */
      slice?: { count: number, index: number, direction: 'vertical' | 'horizontal' }
    }

export interface BackgroundLayer extends LayerBase {
  type: 'background'
  fill: BackgroundFill
}

export interface TextLayer extends LayerBase {
  type: 'text'
  content: string
  font: string
  fontSize: number
  fontWeight: number
  align: 'left' | 'center' | 'right'
  lineHeight: number
  letterSpacing: number
  color: string
  gradient?: GradientSpec // text gradient via background-clip:text
  bg?: string
  padding?: number
  radius?: number
  shadow?: ShadowSpec
}

export interface ImageLayer extends LayerBase {
  type: 'image'
  src: string
  fit: 'cover' | 'contain' | 'fill'
  radius?: number
  border?: BorderSpec
  shadow?: ShadowSpec
}

export type ShapeKind = 'rect' | 'circle' | 'line' | 'arrow' | 'star' | 'triangle' | 'heart' | 'diamond'

export interface ShapeLayer extends LayerBase {
  type: 'shape'
  shape: ShapeKind
  fill: string | GradientSpec
  stroke?: { color: string, width: number }
  radius?: number
}

/** Raw HTML layer. `bindings` keep a live link to a legacy template + data. */
export interface HtmlLayer extends LayerBase {
  type: 'html'
  html?: string
  bindings?: {
    templateKey: string
    data: Record<string, unknown>
  }
}

export interface PatternLayer extends LayerBase {
  type: 'pattern'
  key: string
  color: string
  opacity: number
  scale?: number // multiplier on the preset background-size
}

export interface OverlayLayer extends LayerBase {
  type: 'overlay'
  key: string
  opacity: number
  color?: string
}

export interface FrameLayer extends LayerBase {
  type: 'frame'
  key: string
  color?: string
  color2?: string
  thickness?: number
}

export interface EffectLayer extends LayerBase {
  type: 'effect'
  key: string
  color?: string
  color2?: string
  strength?: number
}

export type SlideLayer =
  | BackgroundLayer
  | TextLayer
  | ImageLayer
  | ShapeLayer
  | HtmlLayer
  | PatternLayer
  | OverlayLayer
  | FrameLayer
  | EffectLayer

/** Template layer spec — everything except the runtime `id`. */
export type LayerSpec = Omit<SlideLayer, 'id'>

/** Slide-level effects: CSS filter + optional blend overlays applied to the content wrapper. */
export interface SlideEffects {
  filter: string
  overlays: Array<{ color: string, blend: 'multiply' | 'screen' | 'overlay', opacity: number }>
}

export const FRAME_W = 1080

export function createLayerId(): string {
  return `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function instantiateLayers(specs: LayerSpec[]): SlideLayer[] {
  return specs.map(spec => ({ ...JSON.parse(JSON.stringify(spec)), id: createLayerId() } as SlideLayer))
}
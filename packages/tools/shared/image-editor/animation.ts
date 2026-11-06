import type { EditorObject, ImageEditorDocument, LayerAnimation, PageTransitionType } from './document'
import { computePageDuration } from './document'

/**
 * Shared animation evaluator — the single source of truth for "what does a
 * layer look like at time t". The browser preview and the server frame
 * renderer both call `evaluateLayerState`, so preview and export match.
 */

export interface LayerState {
  visible: boolean
  opacity: number
  scaleX: number
  scaleY: number
  offsetX: number
  offsetY: number
  rotate: number
}

const IDENTITY: LayerState = { visible: true, opacity: 1, scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, rotate: 0 }

/** Easing functions (name → (t in 0..1) → eased), shared by UI and server. */
export const EASING_FNS: Record<string, (t: number) => number> = {
  linear: t => t,
  easeInSine: t => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: t => Math.sin((t * Math.PI) / 2),
  easeInOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  easeInQuad: t => t * t,
  easeOutQuad: t => t * (2 - t),
  easeInOutQuad: t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: t => t * t * t,
  easeOutCubic: t => 1 - (1 - t) ** 3,
  easeInOutCubic: t => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  easeOutExpo: t => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  easeInExpo: t => (t === 0 ? 0 : 2 ** (10 * t - 10)),
}

export function ease(name: string, t: number): number {
  const fn = EASING_FNS[name] ?? EASING_FNS.easeOutCubic
  return fn(Math.min(1, Math.max(0, t)))
}

export interface EvaluateOptions {
  /** Time within the page timeline (ms). */
  timeMs: number
  pageDurationMs?: number
}

/**
 * Evaluate one layer's animation state at a point in time.
 * Pure — used by the canvas preview overlay and the server frame renderer.
 */
export function evaluateLayerState(
  objectId: string,
  animation: LayerAnimation | undefined,
  options: EvaluateOptions,
): LayerState {
  if (!animation || (!animation.enter && !animation.exit && !animation.loop)) return IDENTITY
  const loop = animation.loop && animation.loop.type !== 'none' ? loopState(animation, options.timeMs) : null
  const enter = animation.enter && animation.enter.type !== 'none'
    ? enterState(objectId, animation.enter, options.timeMs)
    : null
  const exit = animation.exit && animation.exit.type !== 'none'
    ? exitState(objectId, animation.exit, options.timeMs)
    : null
  return compose(loop, enter, exit)
}

function compose(...states: (LayerState | null)[]): LayerState {
  return states.reduce((acc, next) => {
    if (!next) return acc
    return {
      visible: acc.visible && next.visible,
      opacity: acc.opacity * next.opacity,
      scaleX: acc.scaleX * next.scaleX,
      scaleY: acc.scaleY * next.scaleY,
      offsetX: acc.offsetX + next.offsetX,
      offsetY: acc.offsetY + next.offsetY,
      rotate: acc.rotate + next.rotate,
    }
  }, IDENTITY)
}

const BASE_ENTER: Partial<LayerState> = { opacity: 0, scaleX: 1, scaleY: 1 }

function enterState(_objectId: string, enter: NonNullable<LayerAnimation['enter']>, timeMs: number): LayerState | null {
  const local = timeMs - enter.delay
  if (local < 0) return { ...BASE_ENTER, visible: false } as LayerState
  const t = ease(enter.easing, Math.min(1, local / Math.max(1, enter.duration)))
  if (t >= 1) return null
  const state = { ...BASE_ENTER, visible: true, opacity: t }
  const px = 80
  if (enter.type === 'riseUp') state.offsetY = (1 - t) * px
  if (enter.type === 'dropDown') state.offsetY = -(1 - t) * px
  if (enter.type === 'slideLeft') state.offsetX = (1 - t) * px * 2
  if (enter.type === 'slideRight') state.offsetX = -(1 - t) * px * 2
  if (enter.type === 'zoomIn') state.scaleY = 1
  if (enter.type === 'zoomOut') { state.scaleX = 1 + (1 - t) * 0.4; state.scaleY = state.scaleX }
  if (enter.type === 'pop') { state.scaleX = 0.6 + 0.4 * (1.15 - 0.15 * t); state.scaleY = state.scaleX }
  if (enter.type === 'wipeUp') state.offsetY = (1 - t) * 40
  if (enter.type === 'fadeIn') state.offsetY = 0
  return state
}

function exitState(_objectId: string, exit: NonNullable<LayerAnimation['exit']>, timeMs: number): LayerState | null {
  const local = timeMs - exit.delay
  if (local < 0) return null
  const t = ease(exit.easing, Math.min(1, local / Math.max(1, exit.duration)))
  if (t <= 0) return null
  const progress = 1 - t
  const state: LayerState = { ...BASE_ENTER, visible: t < 1, opacity: progress }
  if (exit.type === 'riseUp') state.offsetY = -progress * 80
  if (exit.type === 'dropDown') state.offsetY = progress * 80
  if (exit.type === 'slideLeft') state.offsetX = -progress * 160
  if (exit.type === 'slideRight') state.offsetX = progress * 160
  if (exit.type === 'zoomIn') { state.scaleX = 1 + progress * 0.4; state.scaleY = state.scaleX }
  if (exit.type === 'zoomOut') { state.scaleX = Math.max(0.05, 1 - progress * 0.4); state.scaleY = state.scaleX }
  if (exit.type === 'pop') return null
  return state
}

function loopState(loop: NonNullable<LayerAnimation['loop']>, timeMs: number): LayerState | null {
  if (loop.type === 'none') return null
  const phase = ((timeMs / Math.max(1, loop.duration)) % 1 + 1) % 1
  const t = phase < 0.5 ? phase * 2 : 1 - (phase - 0.5) * 2
  if (loop.type === 'pulse') { const s = 1 + 0.05 * t; return { ...IDENTITY, scaleX: s, scaleY: s } }
  if (loop.type === 'spin') return { ...IDENTITY, rotate: phase * 360 }
  if (loop.type === 'bob') return { ...IDENTITY, offsetY: Math.sin(phase * Math.PI * 2) * 10 }
  if (loop.type === 'swing') return { ...IDENTITY, rotate: Math.sin(phase * Math.PI * 2) * 8 }
  if (loop.type === 'blink') return { ...IDENTITY, opacity: 0.35 + 0.65 * t }
  return null
}

/** Per-page multiplicative transition applied to everything on the page. */
export function evaluatePageTransition(
  transition: PageTransitionType,
  durationMs: number,
  timeMs: number,
  pageDuration: number,
): LayerState | null {
  if (transition === 'none' || durationMs <= 0) return null
  const inT = ease('easeOutCubic', Math.min(1, timeMs / durationMs))
  const outT = ease('easeOutCubic', Math.min(1, (pageDuration - timeMs) / durationMs))
  const t = Math.min(inT, outT)
  if (t >= 1) return null
  if (transition === 'fade') return { ...IDENTITY, opacity: t }
  if (transition === 'slideLeft') return { ...IDENTITY, offsetX: (1 - t) * 120 }
  if (transition === 'slideRight') return { ...IDENTITY, offsetX: -(1 - t) * 120 }
  if (transition === 'wipeUp') return { ...IDENTITY, offsetY: (1 - t) * 60 }
  if (transition === 'zoomIn') { const s = 0.9 + 0.1 * t; return { ...IDENTITY, scaleX: s, scaleY: s, opacity: t } }
  return null
}

/** Duration of a page in ms (explicit duration or computed from layers). */
export function pageDuration(page: ImageEditorDocument['pages'][number]): number {
  return page.duration ?? computePageDuration(page)
}

/**
 * Apply a layer state to a freshly enlivened (or normalized) fabric object.
 * The server frame renderer and the browser preview share this.
 */
export function applyLayerState(obj: EditorObject, state: LayerState) {
  if (!state.visible) {
    obj.visible = false
    return
  }
  obj.visible = true
  const r = Math.round
  if (state.opacity < 1) obj.opacity = r(state.opacity * 100) / 100
  if (state.scaleX !== 1) obj.scaleX = (Number(obj.scaleX) || 1) * state.scaleX
  if (state.scaleY !== 1) obj.scaleY = (Number(obj.scaleY) || 1) * state.scaleY
  if (state.offsetX !== 0) obj.left = (Number(obj.left) || 0) + state.offsetX
  if (state.offsetY !== 0) obj.top = (Number(obj.top) || 0) + state.offsetY
  if (state.rotate !== 0) obj.angle = (Number(obj.angle) || 0) + state.rotate
}

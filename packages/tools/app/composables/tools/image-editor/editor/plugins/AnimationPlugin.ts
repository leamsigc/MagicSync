import type { Canvas, FabricObject } from 'fabric'
import { BaseFabricPlugin } from '../FabricEditor'
import { evaluateLayerState, evaluatePageTransition, type LayerState } from '../../../../../../shared/image-editor/animation'
import { objectAnimation, pageAnimationOf } from '../../../../../../shared/image-editor/studio-canvas'

/**
 * AnimationPlugin — timeline playback on the live canvas. State math is the
 * SAME evaluateLayerState the server frame renderer runs, so the browser
 * preview and exported MP4s match.
 */
export class AnimationPlugin extends BaseFabricPlugin {
  static readonly pluginName = 'animation';
  override readonly pluginName = 'animation';

  override readonly exposedMethods = ['playPreview', 'stopPreview'];

  private raf: number | null = null
  private startedAt = 0
  private durationMs = 4000
  private bases = new Map<FabricObject, BaseSnapshot>()

  protected init() {}

  /** Play one full page timeline; resolves when finished or stopPreview is called. */
  async playPreview(durationMs: number): Promise<void> {
    if (!this.canvas) return
    this.stopPreviewInternal()
    const animation = pageAnimationOf(this.canvas)
    this.durationMs = Math.max(500, durationMs)
    this.bases = this.captureBases()
    this.startedAt = performance.now()

    await new Promise<void>((resolvePromise) => {
      const frame = (now: number) => {
        const timeMs = now - this.startedAt
        if (timeMs > this.durationMs) {
          this.restoreBases()
          this.canvas?.requestRenderAll()
          this.raf = null
          resolvePromise()
          return
        }
        this.applyFrame(animation, timeMs)
        this.raf = requestAnimationFrame(frame)
      }
      this.raf = requestAnimationFrame(frame)
    })
  }

  stopPreview(): void {
    this.stopPreviewInternal()
  }

  private stopPreviewInternal(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf)
    this.raf = null
    this.restoreBases()
    this.canvas?.requestRenderAll()
  }

  private captureBases(): Map<FabricObject, BaseSnapshot> {
    const map = new Map<FabricObject, BaseSnapshot>()
    for (const obj of this.canvas?.getObjects() ?? []) {
      if ((obj as { id?: string }).id === 'workspace') continue
      map.set(obj, {
        left: obj.left ?? 0,
        top: obj.top ?? 0,
        scaleX: obj.scaleX ?? 1,
        scaleY: obj.scaleY ?? 1,
        opacity: obj.opacity ?? 1,
        angle: obj.angle ?? 0,
        visible: obj.visible !== false,
      })
    }
    return map
  }

  private restoreBases(): void {
    for (const [obj, base] of this.bases) {
      obj.set({ left: base.left, top: base.top, scaleX: base.scaleX, scaleY: base.scaleY, opacity: base.opacity, angle: base.angle, visible: base.visible } as never)
      obj.setCoords?.()
    }
    this.bases = new Map()
  }

  private applyFrame(
    animation: { layers: Record<string, Parameters<typeof evaluateLayerState>[1]>; transition?: { type: string; duration: number } },
    timeMs: number,
  ): void {
    const transition = animation.transition
      ? evaluatePageTransition(transitionType(animation.transition.type), animation.transition.duration, timeMs, this.durationMs)
      : null
    for (const [obj, base] of this.bases) {
      const id = (obj as { id?: string }).id
      const spec = id ? animation.layers[id] ?? objectAnimation(obj) : objectAnimation(obj)
      const state = evaluateLayerState(String(id ?? ''), spec, { timeMs, pageDurationMs: this.durationMs })
      this.paint(obj, base, state, transition)
    }
    this.canvas?.requestRenderAll()
  }

  private paint(obj: FabricObject, base: BaseSnapshot, state: LayerState, transition: LayerState | null): void {
    const combined = transition ? composeState(state, transition) : state
    obj.set({
      left: base.left + combined.offsetX,
      top: base.top + combined.offsetY,
      scaleX: base.scaleX * combined.scaleX,
      scaleY: base.scaleY * combined.scaleY,
      opacity: base.opacity * combined.opacity,
      visible: base.visible && combined.visible,
    } as never)
    obj.setCoords?.()
  }
}

interface BaseSnapshot {
  left: number
  top: number
  scaleX: number
  scaleY: number
  opacity: number
  angle: number
  visible: boolean
}

function composeState(base: LayerState, transition: LayerState): LayerState {
  return {
    visible: base.visible && transition.visible,
    opacity: base.opacity * transition.opacity,
    scaleX: base.scaleX * transition.scaleX,
    scaleY: base.scaleY * transition.scaleY,
    offsetX: base.offsetX + transition.offsetX,
    offsetY: base.offsetY + transition.offsetY,
    rotate: base.rotate + transition.rotate,
  }
}

function transitionType(value: string): Parameters<typeof evaluatePageTransition>[0] {
  const known = ['none', 'fade', 'slideLeft', 'slideRight', 'wipeUp', 'zoomIn']
  return (known.includes(value) ? value : 'none') as Parameters<typeof evaluatePageTransition>[0]
}

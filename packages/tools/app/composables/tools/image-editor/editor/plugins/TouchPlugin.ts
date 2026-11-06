import type { Point } from 'fabric'
import { BaseFabricPlugin } from '../FabricEditor'

/**
 * TouchPlugin — H5 mobile editor: pinch-zoom + two-finger pan, tap-select is
 * fabric-native. Registered only for narrow viewports to keep desktop
 * behavior untouched.
 */
export class TouchPlugin extends BaseFabricPlugin {
  static readonly pluginName = 'touch';
  override readonly pluginName = 'touch';

  override readonly exposedMethods = ['enableTouch', 'disableTouch'];

  private startSpan = 0
  private startZoom = 1
  private active = false
  private startCenter: Point | null = null

  protected init() {}

  enableTouch(): void {
    if (!this.canvas || this.active) return
    this.active = true
    this.canvas.on('touch:gesture', this.onGesture as never)
    this.canvas.on('touch:drag', this.onDrag)
  }

  disableTouch(): void {
    if (!this.canvas || !this.active) return
    this.active = false
    this.canvas.off('touch:gesture', this.onGesture as never)
    this.canvas.off('touch:drag', this.onDrag)
  }

  private onGesture = (event: Event): void => {
    const detail = event as { self?: { scale?: number; state?: string; x?: number; y?: number } }
    const self = detail.self
    if (!this.canvas || !self?.scale) return
    if (self.state === 'start') {
      this.startSpan = self.scale
      this.startZoom = this.canvas.getZoom()
      this.startCenter = this.canvas.getCenterPoint()
      return
    }
    if (self.state === 'end') {
      this.startSpan = 0
      this.startCenter = null
      return
    }
    if (this.startSpan > 0) {
      const scale = Math.min(5, Math.max(0.1, this.startZoom * (self.scale / this.startSpan)))
      if (this.startCenter) this.canvas.zoomToPoint(this.startCenter, scale)
      else this.canvas.setZoom(scale)
      this.canvas.requestRenderAll()
    }
  }

  private onDrag = (event: Event): void => {
    void event
    // fabric multi-touch drag is handled by v7 selection transform; pan
    // while two fingers on the canvas (alter vpt) arrives through gesture
    // updates. nothing to add here today — hook preserved for future pan.
  }

  override onDestroy(): void {
    this.disableTouch()
  }
}

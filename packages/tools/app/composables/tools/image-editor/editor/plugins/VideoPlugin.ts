import type { Canvas, FabricObject } from 'fabric'
import { BaseFabricPlugin, FabricEditor } from '../FabricEditor'

/**
 * Keeps live video layers painting.
 *
 * Fabric renders whatever frame a `<video>` element currently holds, but only
 * when the canvas is asked to redraw. While at least one video layer exists we
 * repaint at ~30fps; when the last one is removed or the editor unmounts the
 * loop stops and the videos are paused so nothing keeps burning CPU.
 */
export class VideoPlugin extends BaseFabricPlugin {
  static readonly pluginName = 'video'
  override readonly pluginName = 'video'

  override readonly exposedMethods = ['startVideoLoop', 'stopVideoLoop']

  private raf = 0
  private lastFrame = 0

  protected init() {}

  override onCanvasInit(canvas: Canvas) {
    this.canvas = canvas
    // Documents hydrate after loadFromJSON (no object:added fires then).
    this.canvas.on('video:hydrated' as never, () => this.startVideoLoop())
    this.startVideoLoop()
  }

  override onObjectAdded(object: FabricObject) {
    if (this.videoOf(object)) this.startVideoLoop()
  }

  override onObjectRemoved() {
    if (!this.hasVideos()) this.stopVideoLoop()
  }

  override onDestroy() {
    this.stopVideoLoop()
    for (const object of this.canvas?.getObjects() ?? []) this.videoOf(object)?.pause()
  }

  private videoOf(object: FabricObject): HTMLVideoElement | null {
    const record = object as unknown as { videoUrl?: string; getElement?: () => unknown }
    if (!record.videoUrl) return null
    const element = record.getElement?.()
    return element instanceof HTMLVideoElement ? element : null
  }

  private hasVideos(): boolean {
    return !!this.canvas?.getObjects().some(object => !!this.videoOf(object))
  }

  startVideoLoop(): void {
    if (this.raf || !this.hasVideos()) return
    const tick = (time: number) => {
      if (!this.hasVideos()) {
        this.stopVideoLoop()
        return
      }
      if (time - this.lastFrame >= 33) {
        this.lastFrame = time
        for (const object of this.canvas?.getObjects() ?? []) {
          if (this.videoOf(object)) object.dirty = true
        }
        this.canvas?.requestRenderAll()
      }
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  stopVideoLoop(): void {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }
}

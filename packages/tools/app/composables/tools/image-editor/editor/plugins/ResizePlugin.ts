import { BaseFabricPlugin } from '../FabricEditor'

/** Resize catalog — map ready sizes to quick frame changes. */
export interface ResizeCatalogEntry {
  id: string
  label: string
  width: number
  height: number
  unit: 'px'
  group: 'social' | 'print' | 'web' | 'video'
}

export const RESIZE_CATALOG: ResizeCatalogEntry[] = [
  { id: 'instagram-post', label: 'Instagram Post', width: 1080, height: 1080, unit: 'px', group: 'social' },
  { id: 'instagram-story', label: 'Instagram Story', width: 1080, height: 1920, unit: 'px', group: 'social' },
  { id: 'facebook-post', label: 'Facebook Post', width: 1200, height: 630, unit: 'px', group: 'social' },
  { id: 'x-post', label: 'X Post', width: 1600, height: 900, unit: 'px', group: 'social' },
  { id: 'linkedin-post', label: 'LinkedIn Post', width: 1200, height: 1200, unit: 'px', group: 'social' },
  { id: 'pinterest-pin', label: 'Pinterest Pin', width: 1000, height: 1500, unit: 'px', group: 'social' },
  { id: 'threads', label: 'Threads Post', width: 1080, height: 1350, unit: 'px', group: 'social' },
  { id: 'presentation-169', label: 'Presentation 16:9', width: 1920, height: 1080, unit: 'px', group: 'web' },
  { id: 'web-banner', label: 'Web Banner', width: 1600, height: 500, unit: 'px', group: 'web' },
  { id: 'blog-banner', label: 'Blog Cover', width: 1200, height: 630, unit: 'px', group: 'web' },
  { id: 'video-1080p', label: 'Video 1080p', width: 1920, height: 1080, unit: 'px', group: 'video' },
  { id: 'video-vertical', label: 'Reel / Short', width: 1080, height: 1920, unit: 'px', group: 'video' },
  { id: 'a4', label: 'A4 Print', width: 2480, height: 3508, unit: 'px', group: 'print' },
  { id: 'business-card', label: 'Business Card', width: 1050, height: 600, unit: 'px', group: 'print' },
]

/**
 * ResizePlugin — change the frame size with three strategies:
 *  - scale: proportional scale objects to the new frame
 *  - reflow: keep objects, they remain where they are
 *  - pad:  keep object sizes, recenter into the new frame
 */
export class ResizePlugin extends BaseFabricPlugin {
  static readonly pluginName = 'resize';
  override readonly pluginName = 'resize';

  override readonly exposedMethods = ['resizeFrame', 'fitObjectsToFrame', 'centerAll'];

  protected init() {}

  /**
   * Resize the working frame. Returns the strategies applied.
   */
  resizeFrame(width: number, height: number, mode: 'scale' | 'reflow' | 'pad' = 'pad'): void {
    if (!this.canvas) return
    const core = this.editor.getPlugin('core') as { setSize?: (w: number, h: number) => void } | undefined
    if (!core?.setSize) return
    const previous = this.frameSize()
    core.setSize(width, height)
    const objects = this.canvas.getObjects().filter(obj => (obj as { id?: string }).id !== 'workspace')
    if (mode === 'scale' && previous.width > 0 && previous.height > 0) {
      // Uniform fit: scaling axes independently would distort text and images.
      const factor = Math.min(width / previous.width, height / previous.height)
      for (const obj of objects) {
        obj.set({
          left: (obj.left ?? 0) * factor,
          top: (obj.top ?? 0) * factor,
          scaleX: (obj.scaleX ?? 1) * factor,
          scaleY: (obj.scaleY ?? 1) * factor,
        } as never)
        obj.setCoords?.()
      }
      this.centerAll()
    }
    if (mode === 'pad') {
      this.centerAll()
    }
    this.canvas.requestRenderAll()
  }

  /** Proportionally scale object rect into the frame (used by fit). */
  fitObjectsToFrame(): void {
    if (!this.canvas) return
    const frame = this.frameSize()
    const bounds = this.objectsBounds()
    if (!frame.width || !frame.height || !bounds.width || !bounds.height) return
    const scale = Math.min(frame.width / bounds.width, frame.height / bounds.height, 1)
    for (const obj of this.canvas.getObjects().filter(entry => (entry as { id?: string }).id !== 'workspace')) {
      obj.set({
        left: (obj.left ?? 0) * scale,
        top: (obj.top ?? 0) * scale,
        scaleX: (obj.scaleX ?? 1) * scale,
        scaleY: (obj.scaleY ?? 1) * scale,
      } as never)
      obj.setCoords?.()
    }
    this.canvas.requestRenderAll()
  }

  centerAll(): void {
    if (!this.canvas) return
    const frame = this.frameSize()
    const bounds = this.objectsBounds()
    // Clamp: when the content is wider/taller than the frame, pin it to the
    // frame origin instead of centering it into negative (clipped) space.
    const dx = bounds.width >= frame.width
      ? Math.round(-bounds.left)
      : Math.round(((frame.width - bounds.width) / 2) - bounds.left)
    const dy = bounds.height >= frame.height
      ? Math.round(-bounds.top)
      : Math.round(((frame.height - bounds.height) / 2) - bounds.top)
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return
    for (const obj of this.canvas.getObjects().filter(entry => (entry as { id?: string }).id !== 'workspace')) {
      obj.set({ left: (obj.left ?? 0) + dx, top: (obj.top ?? 0) + dy } as never)
      obj.setCoords?.()
    }
    this.canvas.requestRenderAll()
  }

  private frameSize(): { width: number; height: number } {
    const ws = this.canvas?.getObjects().find(obj => (obj as { id?: string }).id === 'workspace')
    return { width: Math.round(ws?.width ?? 0), height: Math.round(ws?.height ?? 0) }
  }

  private objectsBounds(): { left: number; top: number; width: number; height: number } {
    const objects = this.canvas?.getObjects().filter(entry => (entry as { id?: string }).id !== 'workspace') ?? []
    if (objects.length === 0) return { left: 0, top: 0, width: 0, height: 0 }
    const left = Math.min(...objects.map(obj => obj.left ?? 0))
    const top = Math.min(...objects.map(obj => obj.top ?? 0))
    const right = Math.max(...objects.map(obj => (obj.left ?? 0) + (obj.width ?? 0) * (obj.scaleX ?? 1)))
    const bottom = Math.max(...objects.map(obj => (obj.top ?? 0) + (obj.height ?? 0) * (obj.scaleY ?? 1)))
    return { left, top, width: right - left, height: bottom - top }
  }
}

import { Rect } from 'fabric';
import { BaseFabricPlugin } from '../FabricEditor';

/**
 * SimpleClipImagePlugin — clip an image layer to a rounded rectangle or the
 * frame (the vue-fabric-editor "simple clip" behaviour). Works on the active
 * image; `removeClip` restores the original square image.
 */
export class SimpleClipImagePlugin extends BaseFabricPlugin {
  static readonly pluginName = 'simpleClip';
  override readonly pluginName = 'simpleClip';

  override readonly exposedMethods = ['clipActiveImage', 'removeImageClip'];

  protected init() { }

  clipActiveImage(radius = 0): boolean {
    const canvas = this.canvas;
    const target = canvas?.getActiveObject() as unknown as { type?: string; width?: number; height?: number; scaleX?: number; scaleY?: number; getBoundingRect?: () => { width: number; height: number } } | undefined;
    if (!canvas || !target || target.type !== 'image') return false;

    const bounds = target.getBoundingRect?.() ?? { width: (target.width ?? 0) * (target.scaleX ?? 1), height: (target.height ?? 0) * (target.scaleY ?? 1) };
    const clip = new Rect({
      width: bounds.width,
      height: bounds.height,
      rx: radius,
      ry: radius,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      absolutePositioned: false,
    });
    (target as { clipPath?: unknown }).clipPath = clip;
    canvas.requestRenderAll();
    return true;
  }

  removeImageClip(): boolean {
    const canvas = this.canvas;
    const target = canvas?.getActiveObject() as unknown as { type?: string; clipPath?: unknown } | undefined;
    if (!canvas || !target || target.type !== 'image' || !target.clipPath) return false;
    target.clipPath = undefined;
    canvas.requestRenderAll();
    return true;
  }
}

import { Group, Text, type Canvas } from 'fabric';
import { BaseFabricPlugin, type FabricObjectWithName } from '../FabricEditor';

/**
 * WatermarkPlugin — tiled text watermark across the frame.
 *
 * The watermark lives in the document on purpose (it should render in exports
 * and batch output), is locked so it cannot be deleted by accident apart from
 * the explicit remove control, and is tagged `id = 'watermark'` so the plugin
 * can find and replace it.
 */

const WATERMARK_ID = 'watermark';

export interface WatermarkOptions {
  opacity?: number;
  fontSize?: number;
  angle?: number;
  color?: string;
  gap?: number;
}

export class WatermarkPlugin extends BaseFabricPlugin {
  static readonly pluginName = 'watermark';
  override readonly pluginName = 'watermark';

  override readonly exposedMethods = ['addWatermark', 'removeWatermark', 'hasWatermark'];

  protected init() { }

  hasWatermark(): boolean {
    return !!this.canvas?.getObjects().some(obj => (obj as { id?: string }).id === WATERMARK_ID);
  }

  addWatermark(text: string, options: WatermarkOptions = {}): boolean {
    const canvas = this.canvas as Canvas | undefined;
    if (!canvas || !text.trim()) return false;
    this.removeWatermark();

    const frame = canvas.getObjects().find(obj => (obj as { id?: string }).id === 'workspace');
    const width = Math.round(frame?.width ?? canvas.width ?? 1080);
    const height = Math.round(frame?.height ?? canvas.height ?? 1080);
    const fontSize = options.fontSize ?? Math.max(24, Math.round(width / 24));
    const gap = options.gap ?? Math.round(fontSize * 7);
    const angle = options.angle ?? -30;

    const tiles: Text[] = [];
    for (let y = -height; y < height * 2; y += gap) {
      for (let x = -width; x < width * 2; x += gap * 1.6) {
        tiles.push(new Text(text, {
          left: x,
          top: y,
          fontSize,
          fontFamily: 'DejaVu Sans',
          fill: options.color ?? '#111827',
          opacity: options.opacity ?? 0.14,
          angle,
          selectable: false,
          evented: false,
        }));
      }
    }

    const group = new Group(tiles, {
      id: WATERMARK_ID,
      name: 'Watermark',
      selectable: false,
      evented: false,
      opacity: 1,
      left: 0,
      top: 0,
    } as never);
    (group as FabricObjectWithName).id = WATERMARK_ID;
    canvas.add(group);
    canvas.bringObjectToFront(group as never);
    canvas.requestRenderAll();
    return true;
  }

  removeWatermark(): void {
    const canvas = this.canvas as Canvas | undefined;
    if (!canvas) return;
    const existing = canvas.getObjects().filter(obj => (obj as { id?: string }).id === WATERMARK_ID);
    for (const object of existing) canvas.remove(object);
    canvas.requestRenderAll();
  }
}

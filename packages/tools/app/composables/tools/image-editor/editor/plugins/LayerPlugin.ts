import type { Canvas, FabricObject } from 'fabric';
import { BaseFabricPlugin, FabricEditor, type FabricObjectWithName } from '../FabricEditor';

export class LayerPlugin extends BaseFabricPlugin {
  static readonly pluginName = 'layer';
  override readonly pluginName = 'layer';

  override readonly exposedMethods = [
    'arrangeFront',
    'arrangeBack',
    'getLayers',
    'toggleLayerVisibility',
    'toggleLayerLock'
  ];

  protected init() { }

  /**
   * Move one step up. `target` lets the layer-list arrows move the row the
   * user clicked instead of whichever object happened to be selected.
   */
  arrangeFront(target?: FabricObject) {
    const object = target ?? this.canvas?.getActiveObject();
    if (!this.canvas || !object) return;
    (this.canvas as any).bringObjectForward(object);
    this.canvas.requestRenderAll();
  }

  arrangeBack(target?: FabricObject) {
    const object = target ?? this.canvas?.getActiveObject();
    if (!this.canvas || !object) return;
    (this.canvas as Canvas).sendObjectBackwards(object);
    this.canvas.requestRenderAll();
  }

  getLayers() {
    return this.canvas ? this.canvas.getObjects() : [];
  }

  toggleLayerVisibility(layer: FabricObject, visible: boolean) {
    layer.set('visible', visible);
    this.canvas?.requestRenderAll();
  }

  toggleLayerLock(layer: FabricObject, locked: boolean) {
    layer.set('selectable', !locked);
    layer.set('evented', !locked);
    this.canvas?.requestRenderAll();
  }
}

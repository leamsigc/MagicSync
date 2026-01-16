import { Canvas, FabricObject } from 'fabric';
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

  arrangeFront() {
    if (this.canvas) {
      const activeObject = this.canvas.getActiveObject();
      if (activeObject) {
        (this.canvas as any).bringObjectForward(activeObject);
        this.canvas.requestRenderAll();
      }
    }
  }

  arrangeBack() {
    if (this.canvas) {
      const activeObject = this.canvas.getActiveObject();
      if (activeObject) {
        (this.canvas as Canvas).sendObjectBackwards(activeObject);
        this.canvas.requestRenderAll();
      }
    }
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

import { Canvas, Group } from 'fabric';
import { BaseFabricPlugin, FabricEditor, type FabricObjectWithName } from '../FabricEditor';
import { CorePlugin } from '../CorePlugin';

export class ExportPlugin extends BaseFabricPlugin {
  static readonly pluginName = 'export';
  override readonly pluginName = 'export';

  override readonly exposedMethods = [
    'downloadCanvasImage',
    'exportCurrentCanvas',
    'loadTemplateFromJson',
    'groupLayers'
  ];

  protected init() { }

  downloadCanvasImage(
    format: 'png' | 'jpeg' = 'png',
    quality: number = 1,
  ) {
    if (this.canvas) {
      const frame = this.canvas
        .getObjects()
        .find((obj: FabricObjectWithName) => obj.id === 'workspace');
      if (!frame) {
        console.warn('Main frame not found for download.');
        return;
      }
      console.log('frame', frame);


      // Store current viewport transform
      const vpt = this.canvas.viewportTransform;
      // Reset viewport to ensure 1:1 export scale relative to canvas 0,0
      this.canvas.viewportTransform = [1, 0, 0, 1, 0, 0];

      const dataURL = this.canvas.toDataURL({
        format,
        quality,
        multiplier: 2, // High resolution
        left: frame.left,
        top: frame.top,
        width: frame.width * frame.scaleX!, // Account for potential scaling
        height: frame.height * frame.scaleY!,
      });

      // Restore viewport
      this.canvas.setViewportTransform(vpt!);
      this.canvas.requestRenderAll();

      const link = document.createElement('a');
      link.href = dataURL;
      link.download = `magic_sync_design.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  exportCurrentCanvas() {
    if (this.canvas) {
      const groupLayer = this.groupLayers();
      if (!groupLayer) return;

      (groupLayer as any).id = 'workspace';
      this.canvas.add(groupLayer);

      const json = this.canvas.toObject([
        'id',
        'gradientAngle',
        'selectable',
        'hasControls',
        'linkData',
        'editable',
        'extensionType',
        'extension',
        'verticalAlign',
        'roundValue',
      ]);
      const fileStr = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(json, null, '\t')
      )}`;

      const anchorEl = document.createElement('a');
      anchorEl.href = fileStr;
      anchorEl.download = `magic_sync_design_${Date.now()}.json`;
      document.body.appendChild(anchorEl);
      anchorEl.click();
      anchorEl.remove();

      this.canvas.remove(groupLayer); // Clean up after export
      this.canvas.requestRenderAll();
    }
  }

  async loadTemplateFromJson(json: string) {
    if (this.canvas) {
      await this.canvas.loadFromJSON(json);
      const currentMainFrame = this.canvas
        .getObjects()
        .find((obj: FabricObjectWithName) => obj.id === 'workspace');

      if (currentMainFrame) {
        this.canvas.centerObject(currentMainFrame);
        this.canvas.requestRenderAll();
      } else {
        const corePlugin = this.editor.getPlugin('core') as CorePlugin;
        if (corePlugin) {
          // Re-initialize core workspace if missing
          (corePlugin as any)._initWorkspace();
        }
      }
    }
  }

  groupLayers() {
    if (!this.canvas) return null;
    const otherLayers = this.canvas
      .getObjects()
      .filter((obj: FabricObjectWithName) => obj.id !== 'workspace');

    const layers = otherLayers ? [...otherLayers] : [];
    const mainLayer = this.canvas
      .getObjects()
      .find((obj: FabricObjectWithName) => obj.id === 'workspace');

    if (mainLayer) layers.unshift(mainLayer);

    const group = new Group(layers);
    if (mainLayer) group.clipPath = mainLayer.clipPath;

    otherLayers.forEach((obj) => this.canvas?.remove(obj));

    return group;
  }
}

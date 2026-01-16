import { Canvas, FabricObject } from 'fabric';
import { BaseFabricPlugin, FabricEditor, type FabricObjectWithName } from '../FabricEditor';

export class AlignPlugin extends BaseFabricPlugin {
  static readonly pluginName = 'align';
  override readonly pluginName = 'align';

  override readonly exposedMethods = [
    'alignObjects',
    'distributeObjects',
    'center'
  ];

  protected init() { }

  alignObjects(alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') {
    if (this.canvas) {
      const activeObject = this.canvas.getActiveObject();
      if (!activeObject) return;

      const workspace = this.canvas.getObjects().find((obj: any) => obj.id === 'workspace');
      const bounds = workspace ? {
        left: workspace.left || 0,
        top: workspace.top || 0,
        width: (workspace.width || 0) * (workspace.scaleX || 1),
        height: (workspace.height || 0) * (workspace.scaleY || 1)
      } : {
        left: 0,
        top: 0,
        width: this.canvas.width || 0,
        height: this.canvas.height || 0
      };

      const objBounds = activeObject.getBoundingRect();

      switch (alignment) {
        case 'left':
          activeObject.set({
            left: bounds.left + (activeObject.left - objBounds.left)
          });
          break;
        case 'center':
          activeObject.set({
            left: bounds.left + (bounds.width / 2) - (objBounds.width / 2) + (activeObject.left - objBounds.left)
          });
          break;
        case 'right':
          activeObject.set({
            left: bounds.left + bounds.width - objBounds.width + (activeObject.left - objBounds.left)
          });
          break;
        case 'top':
          activeObject.set({
            top: bounds.top + (activeObject.top - objBounds.top)
          });
          break;
        case 'middle':
          activeObject.set({
            top: bounds.top + (bounds.height / 2) - (objBounds.height / 2) + (activeObject.top - objBounds.top)
          });
          break;
        case 'bottom':
          activeObject.set({
            top: bounds.top + bounds.height - objBounds.height + (activeObject.top - objBounds.top)
          });
          break;
      }

      activeObject.setCoords();
      this.canvas.requestRenderAll();
    }
  }

  distributeObjects(distribution: 'horizontal' | 'vertical') {
    if (this.canvas) {
      const activeSelection = this.canvas.getActiveObject();
      if (activeSelection && activeSelection.type === 'activeSelection') {
        const objects = (activeSelection as any)._objects as FabricObject[];
        if (objects.length < 3) return;

        objects.sort((a: FabricObject, b: FabricObject) => {
          if (distribution === 'horizontal') {
            return (a.left || 0) - (b.left || 0);
          } else {
            return (a.top || 0) - (b.top || 0);
          }
        });

        const first = objects[0];
        const last = objects[objects.length - 1];

        if (distribution === 'horizontal') {
          const totalWidth = (last!.left || 0) + (last!.width || 0) * (last!.scaleX || 1) - (first!.left || 0);
          const objectsWidth = objects.reduce((sum: number, obj: FabricObject) => sum + (obj.width || 0) * (obj.scaleX || 1), 0);
          const gap = (totalWidth - objectsWidth) / (objects.length - 1);

          let currentLeft = (first!.left || 0) + (first!.width || 0) * (first!.scaleX || 1);
          for (let i = 1; i < objects.length - 1; i++) {
            currentLeft += gap;
            objects[i]?.set('left', currentLeft);
            currentLeft += (objects[i]?.width || 0) * (objects[i]?.scaleX || 1);
          }
        } else {
          const totalHeight = (last!.top || 0) + (last!.height || 0) * (last!.scaleY || 1) - (first!.top || 0);
          const objectsHeight = objects.reduce((sum: number, obj: FabricObject) => sum + (obj.height || 0) * (obj.scaleY || 1), 0);
          const gap = (totalHeight - objectsHeight) / (objects.length - 1);

          let currentTop = (first!.top || 0) + (first!.height || 0) * (first!.scaleY || 1);
          for (let i = 1; i < objects.length - 1; i++) {
            currentTop += gap;
            objects[i]?.set('top', currentTop);
            currentTop += (objects[i]?.height || 0) * (objects[i]?.scaleY || 1);
          }
        }

        this.canvas.requestRenderAll();
      }
    }
  }

  center(layer: FabricObjectWithName) {
    this.canvas?.centerObject(layer);
    this.canvas?.requestRenderAll();
  }
}

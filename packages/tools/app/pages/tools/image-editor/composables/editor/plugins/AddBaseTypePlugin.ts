import { Canvas, FabricObject, Rect, Circle, Triangle } from 'fabric';
import { BaseFabricPlugin, FabricEditor, type FabricObjectWithName } from '../FabricEditor';

export class AddBaseTypePlugin extends BaseFabricPlugin {
    static readonly pluginName = 'addBaseType';
    override readonly pluginName = 'addBaseType';

    override readonly exposedMethods = [
        'addShapeLayer',
        'updateStroke'
    ];

    protected init() { }

    addShapeLayer(
        type: 'rect' | 'circle' | 'triangle',
        options?: any,
    ) {
        if (this.canvas) {
            let shape: FabricObject;
            switch (type) {
                case 'rect':
                    shape = new Rect({
                        left: 50,
                        top: 50,
                        width: 100,
                        height: 100,
                        fill: 'red',
                        ...options,
                    });
                    break;
                case 'circle':
                    shape = new Circle({
                        left: 50,
                        top: 50,
                        radius: 50,
                        fill: 'blue',
                        ...options,
                    });
                    break;
                case 'triangle':
                    shape = new Triangle({
                        left: 50,
                        top: 50,
                        width: 100,
                        height: 100,
                        fill: 'green',
                        ...options,
                    });
                    break;
            }
            this.canvas.add(shape!);
            this.canvas.setActiveObject(shape!);
            this.canvas.requestRenderAll();
            this.editor.state.value = 'Editing';
        }
    }

    updateStroke(options: { width?: number; color?: string; dashArray?: number[]; lineCap?: string; lineJoin?: string }) {
        if (this.canvas) {
            const activeObject = this.canvas.getActiveObject();
            if (activeObject) {
                if (options.width !== undefined) activeObject.set('strokeWidth', options.width);
                if (options.color !== undefined) activeObject.set('stroke', options.color);
                if (options.dashArray !== undefined) activeObject.set('strokeDashArray', options.dashArray);
                if (options.lineCap !== undefined) activeObject.set('strokeLineCap', options.lineCap as any);
                if (options.lineJoin !== undefined) activeObject.set('strokeLineJoin', options.lineJoin as any);
                this.canvas.requestRenderAll();
            }
        }
    }
}

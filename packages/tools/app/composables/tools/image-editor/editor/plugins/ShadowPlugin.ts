import { Canvas, Shadow } from 'fabric';
import { BaseFabricPlugin, FabricEditor } from '../FabricEditor';

export class ShadowPlugin extends BaseFabricPlugin {
    static readonly pluginName = 'shadow';
    override readonly pluginName = 'shadow';

    override readonly exposedMethods = [
        'updateShadow',
        'removeShadow'
    ];

    protected init() { }

    updateShadow(options: { offsetX?: number; offsetY?: number; blur?: number; color?: string }) {
        if (this.canvas) {
            const activeObject = this.canvas.getActiveObject();
            if (activeObject) {
                activeObject.set('shadow', new Shadow({
                    offsetX: options.offsetX ?? 0,
                    offsetY: options.offsetY ?? 0,
                    blur: options.blur ?? 10,
                    color: options.color ?? 'rgba(0, 0, 0, 0.5)',
                }));
                this.canvas.requestRenderAll();
            }
        }
    }

    removeShadow() {
        if (this.canvas) {
            const activeObject = this.canvas.getActiveObject();
            if (activeObject) {
                activeObject.set('shadow', null);
                this.canvas.requestRenderAll();
            }
        }
    }
}

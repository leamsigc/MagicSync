import { BaseFabricPlugin } from '../FabricEditor';

export class TransformPlugin extends BaseFabricPlugin {
    static readonly pluginName = 'transform';
    override readonly pluginName = 'transform';

    override readonly exposedMethods = [
        'flip',
        'rotateObject'
    ];

    protected init() { }

    flip(direction: 'horizontal' | 'vertical') {
        if (this.canvas) {
            const activeObject = this.canvas.getActiveObject();
            if (activeObject) {
                if (direction === 'horizontal') {
                    activeObject.set('flipX', !activeObject.flipX);
                } else {
                    activeObject.set('flipY', !activeObject.flipY);
                }
                this.canvas.requestRenderAll();
            }
        }
    }

    rotateObject(direction: 'left' | 'right') {
        if (this.canvas) {
            const activeObject = this.canvas.getActiveObject();
            if (activeObject) {
                const currentAngle = activeObject.angle || 0;
                const angle = direction === 'left' ? currentAngle - 90 : currentAngle + 90;
                activeObject.rotate(angle);
                this.canvas.requestRenderAll();
            }
        }
    }
}

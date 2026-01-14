import { Canvas, FabricObject } from 'fabric';
import { BaseFabricPlugin, FabricEditor } from '../FabricEditor';

export class LockPlugin extends BaseFabricPlugin {
    static readonly pluginName = 'lock';
    override readonly pluginName = 'lock';

    override readonly exposedMethods = [
        'lock',
        'unlock',
        'isLocked'
    ];

    protected init() { }

    lock(layer?: FabricObject) {
        const obj = layer || this.canvas?.getActiveObject();
        if (obj) {
            obj.set({
                selectable: false,
                evented: false,
                lockMovementX: true,
                lockMovementY: true,
                lockRotation: true,
                lockScalingX: true,
                lockScalingY: true,
                hasControls: false,
            });
            this.canvas?.discardActiveObject();
            this.canvas?.requestRenderAll();
        }
    }

    unlock(layer: FabricObject) {
        layer.set({
            selectable: true,
            evented: true,
            lockMovementX: false,
            lockMovementY: false,
            lockRotation: false,
            lockScalingX: false,
            lockScalingY: false,
            hasControls: true,
        });
        this.canvas?.requestRenderAll();
    }

    isLocked(layer: FabricObject) {
        return !layer.selectable && !layer.evented;
    }
}

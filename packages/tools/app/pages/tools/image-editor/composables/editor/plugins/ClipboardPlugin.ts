import { Canvas, FabricObject, util } from 'fabric';
import { BaseFabricPlugin, FabricEditor } from '../FabricEditor';

export class ClipboardPlugin extends BaseFabricPlugin {
    static readonly pluginName = 'clipboard';
    override readonly pluginName = 'clipboard';

    private _clipboard: FabricObject | null = null;

    override readonly exposedMethods = [
        'copy',
        'paste',
        'clone'
    ];

    protected init() { }

    async copy() {
        if (this.canvas) {
            const activeObject = this.canvas.getActiveObject();
            if (activeObject) {
                this._clipboard = await activeObject.clone();
            }
        }
    }

    async paste() {
        if (this.canvas && this._clipboard) {
            const clonedObj = await this._clipboard.clone();
            this.canvas.discardActiveObject();
            clonedObj.set({
                left: clonedObj.left! + 10,
                top: clonedObj.top! + 10,
                evented: true,
            });
            if (clonedObj.type === 'activeSelection') {
                // activeSelection needs to be added to canvas differently
                clonedObj.canvas = this.canvas;
                clonedObj.forEachObject((obj) => {
                    this.canvas?.add(obj);
                });
                clonedObj.setCoords();
            } else {
                this.canvas.add(clonedObj);
            }
            this._clipboard.set({
                left: this._clipboard.left! + 10,
                top: this._clipboard.top! + 10,
            });
            this.canvas.setActiveObject(clonedObj);
            this.canvas.requestRenderAll();
        }
    }

    async clone() {
        if (this.canvas) {
            const activeObject = this.canvas.getActiveObject();
            if (activeObject) {
                const clonedObj = await activeObject.clone();
                clonedObj.set({
                    left: clonedObj.left! + 10,
                    top: clonedObj.top! + 10,
                });
                this.canvas.add(clonedObj);
                this.canvas.setActiveObject(clonedObj);
                this.canvas.requestRenderAll();
            }
        }
    }
}

import { Canvas, Group, ActiveSelection } from 'fabric';
import { BaseFabricPlugin, FabricEditor } from '../FabricEditor';

export class GroupPlugin extends BaseFabricPlugin {
    static readonly pluginName = 'group';
    override readonly pluginName = 'group';

    override readonly exposedMethods = [
        'group',
        'ungroup'
    ];

    protected init() { }

    group() {
        if (this.canvas) {
            const activeObject = this.canvas.getActiveObject();
            if (activeObject && activeObject.type === 'activeSelection') {
                const group = (activeObject as ActiveSelection).toGroup();
                this.canvas.setActiveObject(group);
                this.canvas.requestRenderAll();
            }
        }
    }

    ungroup() {
        if (this.canvas) {
            const activeObject = this.canvas.getActiveObject();
            if (activeObject && activeObject.type === 'group') {
                const activeSelection = (activeObject as Group).toActiveSelection();
                this.canvas.setActiveObject(activeSelection);
                this.canvas.requestRenderAll();
            }
        }
    }
}

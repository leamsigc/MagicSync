import { Canvas, Rect, FabricObject } from 'fabric';
import { BaseFabricPlugin, FabricEditor, type FabricObjectWithName } from '../FabricEditor';

export class RulerPlugin extends BaseFabricPlugin {
    static readonly pluginName = 'ruler';
    override readonly pluginName = 'ruler';

    override readonly exposedMethods = [
        'addGuideline',
        'removeGuideline',
        'toggleRulers',
        'toggleGuidelineSnap'
    ];

    private guidelines: Map<string, FabricObject> = new Map();
    private rulersVisible: boolean = false;
    private snapEnabled: boolean = true;

    protected init() { }

    addGuideline(orientation: 'horizontal' | 'vertical', position: number) {
        if (this.canvas) {
            const guideline = orientation === 'horizontal'
                ? new Rect({
                    left: 0,
                    top: position,
                    width: this.canvas.width || 0,
                    height: 1,
                    fill: '#00bcd4',
                    selectable: false,
                    evented: false,
                    opacity: 0.5,
                })
                : new Rect({
                    left: position,
                    top: 0,
                    width: 1,
                    height: this.canvas.height || 0,
                    fill: '#00bcd4',
                    selectable: false,
                    evented: false,
                    opacity: 0.5,
                });

            const id = `guideline-${orientation}-${Date.now()}`;
            (guideline as any).id = id;
            (guideline as any).isGuideline = true;
            this.canvas.add(guideline);
            this.guidelines.set(id, guideline);
            this.canvas.requestRenderAll();
            return id;
        }
        return null;
    }

    removeGuideline(id: string) {
        if (this.canvas) {
            const guideline = this.guidelines.get(id);
            if (guideline) {
                this.canvas.remove(guideline);
                this.guidelines.delete(id);
                this.canvas.requestRenderAll();
            }
        }
    }

    toggleRulers(visible: boolean) {
        this.rulersVisible = visible;
        console.log(`Rulers ${visible ? 'enabled' : 'disabled'}`);
        this.canvas?.requestRenderAll();
    }

    toggleGuidelineSnap(enabled: boolean) {
        this.snapEnabled = enabled;
        console.log(`Guideline snapping ${enabled ? 'enabled' : 'disabled'}`);
    }
}

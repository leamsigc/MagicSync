import { Canvas, PencilBrush } from 'fabric';
import { BaseFabricPlugin, FabricEditor } from '../FabricEditor';

export class DrawPlugin extends BaseFabricPlugin {
    static readonly pluginName = 'draw';
    override readonly pluginName = 'draw';

    override readonly exposedMethods = [
        'addBrushLayer',
        'eraseLayer',
        'updateBrushSettings',
        'stopDrawingMode'
    ];

    protected init() { }

    addBrushLayer(color: string = '#000000', width: number = 5) {
        if (this.canvas) {
            this.canvas.isDrawingMode = true;
            // Use existing brush if available to preserve settings, or create new
            if (!this.canvas.freeDrawingBrush) {
                this.canvas.freeDrawingBrush = new PencilBrush(this.canvas as any);
            }
            const brush = this.canvas.freeDrawingBrush;
            if (brush) {
                brush.color = color;
                brush.width = width;
            }
            this.editor.state.value = 'Editing';
        }
    }

    updateBrushSettings(options: { color?: string; width?: number }) {
        if (this.canvas && this.canvas.freeDrawingBrush) {
            if (options.color) this.canvas.freeDrawingBrush.color = options.color;
            if (options.width) this.canvas.freeDrawingBrush.width = options.width;
        }
    }

    stopDrawingMode() {
        if (this.canvas) {
            this.canvas.isDrawingMode = false;
        }
    }

    eraseLayer(width: number = 10) {
        if (this.canvas) {
            // "Eraser" in Fabric 6 is often a brush with globalCompositeOperation = 'destination-out'
            // or we just stop drawing. The previous code just stopped drawing, which is wrong for "Erase".
            // For now, let's keep the user's focus on "Switching to Select should stop drawing".
            // Actual eraser brush implementation would be:
            // const eraserBrush = new PencilBrush(this.canvas);
            // eraserBrush.width = width;
            // eraserBrush.color = 'white'; // Hacky
            // this.canvas.freeDrawingBrush = eraserBrush;
            // this.canvas.isDrawingMode = true;

            // But for this specific fix (stopping pencil when clicking select), stopDrawingMode is key.
            this.canvas.isDrawingMode = false;
            this.editor.state.value = 'Editing';
        }
    }
}

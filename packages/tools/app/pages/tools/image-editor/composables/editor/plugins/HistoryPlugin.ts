import { Canvas } from 'fabric';
import { BaseFabricPlugin, FabricEditor } from '../FabricEditor';

export class HistoryPlugin extends BaseFabricPlugin {
    static readonly pluginName = 'history';
    override readonly pluginName = 'history';

    private history: string[] = [];
    private redoStack: string[] = [];
    private isProcessing: boolean = false;

    override readonly exposedMethods = [
        'undo',
        'redo',
        'clearHistory'
    ];

    protected init() {}

    override onCanvasInit(canvas: Canvas) {
        this.canvas = canvas;
        this.canvas.on('object:added', () => this.saveState());
        this.canvas.on('object:removed', () => this.saveState());
        this.canvas.on('object:modified', () => this.saveState());

        // Initial state
        this.saveState();
    }

    private saveState() {
        if (this.isProcessing) return;
        const json = JSON.stringify(this.canvas.toObject(['id']));
        if (this.history.length > 0 && this.history[this.history.length - 1] === json) return;

        this.history.push(json);
        this.redoStack = [];
        if (this.history.length > 50) this.history.shift();
    }

    async undo() {
        if (this.history.length > 1) {
            this.isProcessing = true;
            const currentState = this.history.pop()!;
            this.redoStack.push(currentState);
            const previousState = this.history[this.history.length - 1];

            await this.canvas.loadFromJSON(previousState);
            this.canvas.requestRenderAll();
            this.isProcessing = false;
        }
    }

    async redo() {
        if (this.redoStack.length > 0) {
            this.isProcessing = true;
            const nextState = this.redoStack.pop()!;
            this.history.push(nextState);

            await this.canvas.loadFromJSON(nextState);
            this.canvas.requestRenderAll();
            this.isProcessing = false;
        }
    }

    clearHistory() {
        this.history = [];
        this.redoStack = [];
        this.saveState();
    }
}

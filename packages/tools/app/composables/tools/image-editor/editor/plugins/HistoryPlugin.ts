import type { Canvas } from 'fabric';
import { BaseFabricPlugin, FabricEditor } from '../FabricEditor';
import { OBJECT_CUSTOM_PROPS, ensureObjectProperties } from '../../../../../../shared/image-editor/studio-canvas';

/**
 * Undo/redo history.
 *
 * Snapshots are debounced (font pairs add two layers in one tick) and long
 * image sources (data: URLs from uploads/cut-outs) are stored once in a side
 * table and referenced by token. Serializing the full base64 payload into
 * every one of 50 history entries made the canvas balloon into hundreds of MB.
 */
export class HistoryPlugin extends BaseFabricPlugin {
    static readonly pluginName = 'history';
    override readonly pluginName = 'history';

    private static readonly MAX_STATES = 30;
    private static readonly ASSET_THRESHOLD = 4096;
    private static readonly SAVE_DELAY_MS = 80;

    private history: string[] = [];
    private redoStack: string[] = [];
    private isProcessing: boolean = false;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private assetByToken = new Map<string, string>();
    private tokenByAsset = new Map<string, string>();

    override readonly exposedMethods = [
        'undo',
        'redo',
        'clearHistory'
    ];

    protected init() {}

    override onCanvasInit(canvas: Canvas) {
        this.canvas = canvas;
        ensureObjectProperties();
        this.canvas.on('object:added', () => this.scheduleSave());
        this.canvas.on('object:removed', () => this.scheduleSave());
        this.canvas.on('object:modified', () => this.scheduleSave());

        // Initial state
        this.saveState();
    }

    /** Serialize the canvas, replacing large data URLs with stable tokens. */
    private encodeState(): string {
        const object = this.canvas.toObject([...OBJECT_CUSTOM_PROPS]);
        return JSON.stringify(object, (key, value) => {
            if (key !== 'src' || typeof value !== 'string' || value.length < HistoryPlugin.ASSET_THRESHOLD) return value;
            const existing = this.tokenByAsset.get(value);
            if (existing) return existing;
            const token = `history-src-${this.tokenByAsset.size}`;
            this.tokenByAsset.set(value, token);
            this.assetByToken.set(token, value);
            return token;
        });
    }

    private decodeState(state: string): Record<string, unknown> | null {
        const parsed = JSON.parse(state, (_key, value) => {
            if (typeof value === 'string' && this.assetByToken.has(value)) return this.assetByToken.get(value);
            return value;
        }) as unknown;
        if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { objects?: unknown }).objects)) return null;
        return parsed as Record<string, unknown>;
    }

    private saveState() {
        if (this.isProcessing) return;
        const json = this.encodeState();
        if (this.history.length > 0 && this.history[this.history.length - 1] === json) return;

        this.history.push(json);
        this.redoStack = [];
        if (this.history.length > HistoryPlugin.MAX_STATES) this.history.shift();
    }

    private scheduleSave() {
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            this.saveState();
        }, HistoryPlugin.SAVE_DELAY_MS);
    }

    /** Commit a pending debounced snapshot (undo/redo must see the latest). */
    private flush() {
        if (!this.saveTimer) return;
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
        this.saveState();
    }

    async undo() {
        this.flush();
        if (this.history.length <= 1) return;
        this.isProcessing = true;
        const currentState = this.history.pop()!;
        this.redoStack.push(currentState);
        const previousState = this.history[this.history.length - 1];
        const decoded = this.decodeState(previousState);

        if (decoded) {
            await this.canvas.loadFromJSON(decoded);
            this.canvas.requestRenderAll();
        }
        this.isProcessing = false;
    }

    async redo() {
        if (this.redoStack.length === 0) return;
        this.isProcessing = true;
        const nextState = this.redoStack.pop()!;
        this.history.push(nextState);
        const decoded = this.decodeState(nextState);

        if (decoded) {
            await this.canvas.loadFromJSON(decoded);
            this.canvas.requestRenderAll();
        }
        this.isProcessing = false;
    }

    clearHistory() {
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = null;
        this.history = [];
        this.redoStack = [];
        this.saveState();
    }
}

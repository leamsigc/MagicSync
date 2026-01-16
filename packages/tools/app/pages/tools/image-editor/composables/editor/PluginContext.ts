import type { Canvas, FabricObject } from 'fabric';
import type { FabricEditor, FabricObjectWithName } from './FabricEditor';
import type { EditorStateInstance } from './EditorState';

/**
 * Editor Context - Provides centralized access to editor state and methods
 * This context is passed to all plugins for consistent API access
 */
export interface EditorContext {
    // Core canvas reference
    canvas: Canvas;

    // Editor instance
    editor: FabricEditor;

    // Centralized state
    state: EditorStateInstance;

    // Active selection
    getActiveObject(): FabricObjectWithName | null;
    getActiveObjects(): FabricObjectWithName[];

    // Event system
    on(event: string, handler: Function): void;
    off(event: string, handler?: Function): void;
    emit(event: string, ...args: any[]): void;

    // Utility methods
    requestRender(): void;
    getWorkspace(): FabricObject | undefined;

    // Plugin access
    getPlugin<T = any>(name: string): T | undefined;
}

/**
 * Creates an Editor Context from an editor instance
 */
export function createEditorContext(
    editor: FabricEditor,
    canvas: Canvas,
    state: EditorStateInstance
): EditorContext {
    return {
        canvas,
        editor,
        state,

        // Selection methods
        getActiveObject() {
            return canvas.getActiveObject() as FabricObjectWithName | null;
        },

        getActiveObjects() {
            return canvas.getActiveObjects() as FabricObjectWithName[];
        },

        // Event methods
        on(event: string, handler: Function) {
            editor.on(event, handler as any);
        },

        off(event: string, handler?: Function) {
            editor.off(event, handler as any);
        },

        emit(event: string, ...args: any[]) {
            editor.emit(event, ...args);
        },

        // Utility methods
        requestRender() {
            canvas.requestRenderAll();
        },

        getWorkspace() {
            return canvas.getObjects().find((obj: any) => obj.id === 'workspace');
        },

        // Plugin access
        getPlugin<T = any>(name: string): T | undefined {
            return editor.getPlugin(name) as T;
        },
    };
}

/**
 * Plugin Registration Options
 */
export interface PluginRegistrationOptions {
    /**
     * Plugin configuration
     */
    config?: Record<string, any>;

    /**
     * Plugin dependencies (other plugin names that must be loaded first)
     */
    depends?: string[];

    /**
     * Plugin load priority (higher = loads first)
     */
    priority?: number;
}

/**
 * Extended Plugin Metadata
 */
export interface PluginMetadata {
    name: string;
    version?: string;
    description?: string;
    author?: string;
    dependencies?: string[];
    priority?: number;
}

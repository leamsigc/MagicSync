import { reactive, computed, ref, type Ref } from 'vue';
import type { FabricObjectWithName } from './FabricEditor';

/**
 * Canvas Settings
 */
export interface CanvasSettings {
    width: number;
    height: number;
    backgroundColor: string;
    zoom: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
}

/**
 * Selection State
 */
export interface SelectionState {
    active: FabricObjectWithName | null;
    multiple: FabricObjectWithName[];
    count: number;
}

/**
 * UI State
 */
export interface UIState {
    sidebarTab: 'templates' | 'elements' | 'text' | 'uploads' | 'layers';
    propertiesTab: 'design' | 'export';
    showRulers: boolean;
    showGuides: boolean;
    snapToGuides: boolean;
    snapToObjects: boolean;
    showGrid: boolean;
}

/**
 * History State
 */
export interface HistoryState {
    canUndo: boolean;
    canRedo: boolean;
    maxHistory: number;
}

/**
 * Editor State Schema
 */
export interface EditorStateSchema {
    canvas: CanvasSettings;
    selection: SelectionState;
    ui: UIState;
    history: HistoryState;
    layers: FabricObjectWithName[];
    isInitialized: boolean;
    isLoading: boolean;
}

/**
 * Default Editor State
 */
const defaultState: EditorStateSchema = {
    canvas: {
        width: 1242,
        height: 1660,
        backgroundColor: '#ffffff',
        zoom: 1,
        fill: '#1DA1F2',
        stroke: '#cccccc',
        strokeWidth: 1,
    },
    selection: {
        active: null,
        multiple: [],
        count: 0,
    },
    ui: {
        sidebarTab: 'elements',
        propertiesTab: 'design',
        showRulers: false,
        showGuides: true,
        snapToGuides: true,
        snapToObjects: false,
        showGrid: false,
    },
    history: {
        canUndo: false,
        canRedo: false,
        maxHistory: 50,
    },
    layers: [],
    isInitialized: false,
    isLoading: false,
};

/**
 * Centralized Editor State Management
 */
export function useEditorState() {
    const state = reactive<EditorStateSchema>({ ...defaultState });

    // Computed properties
    const hasSelection = computed(() => !!state.selection.active);
    const hasMultipleSelection = computed(() => state.selection.count > 1);
    const canUndo = computed(() => state.history.canUndo);
    const canRedo = computed(() => state.history.canRedo);
    const isReady = computed(() => state.isInitialized && !state.isLoading);

    // Selection helpers
    const setActiveSelection = (obj: FabricObjectWithName | null) => {
        state.selection.active = obj;
        state.selection.count = obj ? 1 : 0;
    };

    const setMultipleSelection = (objects: FabricObjectWithName[]) => {
        state.selection.multiple = objects;
        state.selection.count = objects.length;
        state.selection.active = objects[0] || null;
    };

    const clearSelection = () => {
        state.selection.active = null;
        state.selection.multiple = [];
        state.selection.count = 0;
    };

    // Canvas helpers
    const updateCanvasSize = (width: number, height: number) => {
        state.canvas.width = width;
        state.canvas.height = height;
    };

    const updateZoom = (zoom: number) => {
        state.canvas.zoom = Math.max(0.1, Math.min(5, zoom));
    };

    const setBackgroundColor = (color: string) => {
        state.canvas.backgroundColor = color;
    };

    // UI helpers
    const setSidebarTab = (tab: UIState['sidebarTab']) => {
        state.ui.sidebarTab = tab;
    };

    const setPropertiesTab = (tab: UIState['propertiesTab']) => {
        state.ui.propertiesTab = tab;
    };

    const toggleRulers = () => {
        state.ui.showRulers = !state.ui.showRulers;
    };

    const toggleGuides = () => {
        state.ui.showGuides = !state.ui.showGuides;
    };

    const toggleSnap = () => {
        state.ui.snapToGuides = !state.ui.snapToGuides;
    };

    // History helpers
    const setHistoryState = (canUndo: boolean, canRedo: boolean) => {
        state.history.canUndo = canUndo;
        state.history.canRedo = canRedo;
    };

    // Layer helpers
    const setLayers = (layers: FabricObjectWithName[]) => {
        state.layers = layers;
    };

    const addLayer = (layer: FabricObjectWithName) => {
        state.layers.push(layer);
    };

    const removeLayer = (id: string) => {
        state.layers = state.layers.filter(l => l.id !== id);
    };

    // Initialization
    const initialize = () => {
        state.isInitialized = true;
        state.isLoading = false;
    };

    const reset = () => {
        Object.assign(state, defaultState);
    };

    return {
        state,
        // Computed
        hasSelection,
        hasMultipleSelection,
        canUndo,
        canRedo,
        isReady,
        // Selection
        setActiveSelection,
        setMultipleSelection,
        clearSelection,
        // Canvas
        updateCanvasSize,
        updateZoom,
        setBackgroundColor,
        // UI
        setSidebarTab,
        setPropertiesTab,
        toggleRulers,
        toggleGuides,
        toggleSnap,
        // History
        setHistoryState,
        // Layers
        setLayers,
        addLayer,
        removeLayer,
        // Lifecycle
        initialize,
        reset,
    };
}

export type EditorStateInstance = ReturnType<typeof useEditorState>;

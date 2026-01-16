import EventEmitter from 'events';

/**
 * Event Bus for decoupled communication between editor components
 * Provides a centralized event system separate from the main editor
 */
export class EventBus extends EventEmitter {
    private static instance: EventBus;

    private constructor() {
        super();
        this.setMaxListeners(100); // Increase for many plugins
    }

    /**
     * Get singleton instance
     */
    static getInstance(): EventBus {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }

    /**
     * Emit event with type safety helper
     */
    emitEvent<T = any>(event: EditorEvent, data?: T): void {
        this.emit(event, data);
    }

    /**
     * Subscribe to event with type safety
     */
    onEvent<T = any>(event: EditorEvent, handler: (data?: T) => void): void {
        this.on(event, handler);
    }

    /**
     * Unsubscribe from event
     */
    offEvent(event: EditorEvent, handler?: Function): void {
        if (handler) {
            this.off(event, handler as any);
        } else {
            this.removeAllListeners(event);
        }
    }

    /**
     * Subscribe to event once
     */
    onceEvent<T = any>(event: EditorEvent, handler: (data?: T) => void): void {
        this.once(event, handler);
    }
}

/**
 * Editor Events Enum
 */
export enum EditorEvent {
    // Lifecycle events
    BEFORE_INIT = 'editor:beforeInit',
    AFTER_INIT = 'editor:afterInit',
    BEFORE_DESTROY = 'editor:beforeDestroy',
    AFTER_DESTROY = 'editor:afterDestroy',

    // State events
    STATE_CHANGED = 'editor:stateChanged',

    // Canvas events
    CANVAS_READY = 'canvas:ready',
    CANVAS_RESIZE = 'canvas:resize',
    CANVAS_ZOOM = 'canvas:zoom',
    CANVAS_PAN = 'canvas:pan',

    // Object events
    OBJECT_ADDED = 'object:added',
    OBJECT_REMOVED = 'object:removed',
    OBJECT_MODIFIED = 'object:modified',
    OBJECT_SELECTED = 'object:selected',
    OBJECT_DESELECTED = 'object:deselected',

    // Selection events
    SELECTION_CREATED = 'selection:created',
    SELECTION_UPDATED = 'selection:updated',
    SELECTION_CLEARED = 'selection:cleared',

    // Layer events
    LAYER_ADDED = 'layer:added',
    LAYER_REMOVED = 'layer:removed',
    LAYER_REORDERED = 'layer:reordered',
    LAYER_RENAMED = 'layer:renamed',
    LAYER_LOCKED = 'layer:locked',
    LAYER_UNLOCKED = 'layer:unlocked',
    LAYER_VISIBILITY_CHANGED = 'layer:visibilityChanged',

    // History events
    HISTORY_UNDO = 'history:undo',
    HISTORY_REDO = 'history:redo',
    HISTORY_SAVE = 'history:save',
    HISTORY_CLEAR = 'history:clear',

    // File events
    FILE_IMPORT_START = 'file:importStart',
    FILE_IMPORT_SUCCESS = 'file:importSuccess',
    FILE_IMPORT_ERROR = 'file:importError',
    FILE_EXPORT_START = 'file:exportStart',
    FILE_EXPORT_SUCCESS = 'file:exportSuccess',
    FILE_EXPORT_ERROR = 'file:exportError',

    // Template events
    TEMPLATE_LOADED = 'template:loaded',
    TEMPLATE_SAVED = 'template:saved',

    // UI events
    UI_TAB_CHANGED = 'ui:tabChanged',
    UI_PANEL_OPENED = 'ui:panelOpened',
    UI_PANEL_CLOSED = 'ui:panelClosed',
    UI_CONTEXT_MENU_OPENED = 'ui:contextMenuOpened',
    UI_DIALOG_OPENED = 'ui:dialogOpened',
    UI_DIALOG_CLOSED = 'ui:dialogClosed',

    // Plugin events
    PLUGIN_LOADED = 'plugin:loaded',
    PLUGIN_UNLOADED = 'plugin:unloaded',
    PLUGIN_ERROR = 'plugin:error',
}

/**
 * Convenient composable for using EventBus
 */
export function useEventBus() {
    const bus = EventBus.getInstance();

    return {
        emit: bus.emitEvent.bind(bus),
        on: bus.onEvent.bind(bus),
        off: bus.offEvent.bind(bus),
        once: bus.onceEvent.bind(bus),
    };
}

export default EventBus;

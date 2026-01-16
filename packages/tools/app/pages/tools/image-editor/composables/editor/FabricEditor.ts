import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { Canvas, FabricObject, InteractiveFabricObject, type CanvasEvents, type TClassProperties } from 'fabric';
import EventEmitter from 'events';
import { useEditorState, type EditorStateInstance } from './EditorState';
import { createEditorContext, type EditorContext, type PluginRegistrationOptions, type PluginMetadata } from './PluginContext';
import EventBus, { EditorEvent } from './EventBus';

// Define a type that extends FabricObject to include a 'name' property
export interface FabricObjectWithName extends FabricObject {
  name?: string;
  id?: string;
}

export type EditorState = 'Init' | 'New' | 'Editing' | 'Export';

/**
 * Extended Editor Hook Types
 */
export type EditorHookType =
  | 'beforeInit' | 'afterInit'
  | 'beforeSave' | 'afterSave'
  | 'beforeLoad' | 'afterLoad'
  | 'beforeExport' | 'afterExport'
  | 'beforeRender' | 'afterRender'
  | 'objectAdded' | 'objectRemoved' | 'objectModified'
  | 'selectionCreated' | 'selectionUpdated' | 'selectionCleared';

/**
 * Enhanced Fabric Plugin Interface
 */
export interface FabricPlugin {
  // Basic properties
  readonly pluginName: string;
  readonly metadata?: PluginMetadata;
  readonly events?: string[];
  readonly hooks?: EditorHookType[];
  readonly exposedMethods?: string[];

  // Lifecycle hooks
  onRegister?(editor: FabricEditor, context: EditorContext): void;
  onDestroy?(): void;

  // Canvas hooks
  onCanvasInit?(canvas: Canvas): void;

  // Selection hooks
  onSelectionCreated?(activeObject: FabricObject): void;
  onSelectionUpdated?(activeObject: FabricObject): void;
  onSelectionCleared?(): void;

  // Object hooks
  onObjectAdded?(obj: FabricObject): void;
  onObjectRemoved?(obj: FabricObject): void;
  onObjectModified?(obj: FabricObject): void;

  // Render hooks
  onBeforeRender?(): void;
  onAfterRender?(): void;
}

/**
 * Interface for the plugin constructor to include static properties
 */
export interface FabricPluginConstructor {
  new(canvas: Canvas, editor: FabricEditor, context: EditorContext, options?: any): BaseFabricPlugin;
  pluginName: string;
  metadata?: PluginMetadata;
}

/**
 * Base Fabric Plugin with Enhanced Features
 */
export abstract class BaseFabricPlugin implements FabricPlugin {
  abstract readonly pluginName: string;
  public canvas: Canvas;
  public editor: FabricEditor;
  public context: EditorContext;
  public exposedMethods?: string[] | undefined;
  public metadata?: PluginMetadata;
  [key: string]: any;

  // Optional hook implementations
  onRegister?(editor: FabricEditor, context: EditorContext): void;
  onDestroy?(): void;
  onSelectionCreated?(activeObject: FabricObject): void;
  onSelectionUpdated?(activeObject: FabricObject): void;
  onSelectionCleared?(): void;
  onObjectAdded?(obj: FabricObject): void;
  onObjectRemoved?(obj: FabricObject): void;
  onObjectModified?(obj: FabricObject): void;
  onBeforeRender?(): void;
  onAfterRender?(): void;

  onCanvasInit(canvas: Canvas): void {
    this.canvas = canvas;
  }

  constructor(canvas: Canvas, editor: FabricEditor, context: EditorContext, options?: any) {
    this.canvas = canvas;
    this.editor = editor;
    this.context = context;
    this.init(options);
  }

  protected abstract init(options?: any): void;

  /**
   * Emit event through editor
   */
  protected emit(event: string, ...args: any[]) {
    this.editor.emit(event, ...args);
  }

  /**
   * Emit event through global event bus
   */
  protected emitGlobal(event: EditorEvent, data?: any) {
    EventBus.getInstance().emitEvent(event, data);
  }

  /**
   * Subscribe to canvas event
   */
  protected onCanvasEvent<K extends keyof CanvasEvents>(event: K, handler: (options: CanvasEvents[K]) => any) {
    this.canvas?.on(event, handler);
  }

  /**
   * Subscribe to editor event
   */
  protected onEditorEvent(event: string, handler: Function) {
    this.editor.on(event, handler as any);
  }

  /**
   * Subscribe to global event bus
   */
  protected onGlobalEvent(event: EditorEvent, handler: (data?: any) => void) {
    EventBus.getInstance().onEvent(event, handler);
  }
}

/**
 * Plugin Registration Entry
 */
interface PluginEntry {
  instance: FabricPlugin;
  options: PluginRegistrationOptions;
}

/**
 * Enhanced Fabric Editor
 */
export class FabricEditor extends EventEmitter {
  private canvas: Canvas | null = null;
  private plugins: Map<string, PluginEntry> = new Map();
  private eventBus: EventBus;

  public state: Ref<EditorState> = ref('Init');
  public editorState: EditorStateInstance;
  public context: EditorContext | null = null;

  [key: string]: any;

  public activeLayer: Ref<FabricObjectWithName | null> = ref(null);

  public globalSettings: Ref<{ width: number; height: number, fill: string, stroke: string, strokeWidth: number }> = ref({
    width: 1242,
    height: 1660,
    fill: '#1DA1F2',
    stroke: '#ccc',
    strokeWidth: 1,
  });

  public interactiveDefaults: Partial<TClassProperties<InteractiveFabricObject>> = {
    cornerStyle: 'circle',
    cornerStrokeColor: 'blue',
    cornerColor: 'lightblue',
    padding: 10,
    transparentCorners: false,
    cornerDashArray: [2, 2],
    borderColor: 'orange',
    borderDashArray: [3, 1, 3],
    borderScaleFactor: 2,
  };

  constructor(elementRef: Ref<HTMLCanvasElement | null>) {
    super();

    // Initialize state management
    this.editorState = useEditorState();
    this.eventBus = EventBus.getInstance();

    // Attempt immediate initialization if ref is populated
    if (elementRef.value) {
      this.init(elementRef.value);
    } else {
      onMounted(async () => {
        if (elementRef.value) {
          this.init(elementRef.value);
        }
      });
    }

    onUnmounted(() => {
      this.destroy();
    });
  }

  private init(canvasElement: HTMLCanvasElement) {
    // Emit before init hook
    this.eventBus.emitEvent(EditorEvent.BEFORE_INIT);
    this.emit('beforeInit');

    this.canvas = new Canvas(canvasElement, {
      backgroundColor: "rgba(0,0,0,.1)",
      fireRightClick: true,
      stopContextMenu: true,
      controlsAboveOverlay: true,
      imageSmoothingEnabled: false,
      preserveObjectStacking: true,
    });

    // Create editor context
    this.context = createEditorContext(this, this.canvas, this.editorState);

    InteractiveFabricObject.ownDefaults = {
      ...InteractiveFabricObject.ownDefaults,
      ...this.interactiveDefaults
    };

    this.state.value = 'New';

    // Setup canvas event listeners
    this.setupCanvasEvents();

    // Initialize all registered plugins
    this.plugins.forEach(entry => entry.instance.onCanvasInit?.(this.canvas!));

    // Mark as initialized
    this.editorState.initialize();

    // Emit after init hook
    this.emit('afterInit');
    this.eventBus.emitEvent(EditorEvent.AFTER_INIT);
    this.eventBus.emitEvent(EditorEvent.CANVAS_READY);
  }

  /**
   * Setup canvas event listeners with hook triggers
   */
  private setupCanvasEvents() {
    if (!this.canvas) return;

    // Selection created
    this.canvas.on('selection:created' as keyof CanvasEvents, (e: any) => {
      const selectedObject = e.selected?.[0];
      if (selectedObject) {
        this.activeLayer.value = selectedObject as FabricObjectWithName;
        this.editorState.setActiveSelection(selectedObject as FabricObjectWithName);

        selectedObject.set({
          borderColor: '#020420',
          cornerColor: '#00DC82',
          cornerSize: 10,
          transparentCorners: false,
        });

        this.canvas?.requestRenderAll();

        // Trigger hooks
        this.plugins.forEach(entry => entry.instance.onSelectionCreated?.(selectedObject));
        this.eventBus.emitEvent(EditorEvent.SELECTION_CREATED, selectedObject);
      }
    });

    // Selection updated
    this.canvas.on('selection:updated' as keyof CanvasEvents, (e: any) => {
      const selectedObject = e.selected?.[0];
      if (selectedObject) {
        this.activeLayer.value = selectedObject as FabricObjectWithName;
        this.editorState.setActiveSelection(selectedObject as FabricObjectWithName);
        this.plugins.forEach(entry => entry.instance.onSelectionUpdated?.(selectedObject));
        this.eventBus.emitEvent(EditorEvent.SELECTION_UPDATED, selectedObject);
      }
    });

    // Selection cleared
    this.canvas.on('selection:cleared' as keyof CanvasEvents, () => {
      this.activeLayer.value = null;
      this.editorState.clearSelection();
      this.plugins.forEach(entry => entry.instance.onSelectionCleared?.());
      this.eventBus.emitEvent(EditorEvent.SELECTION_CLEARED);
    });

    // Object added
    this.canvas.on('object:added', (e: any) => {
      this.plugins.forEach(entry => entry.instance.onObjectAdded?.(e.target));
      this.eventBus.emitEvent(EditorEvent.OBJECT_ADDED, e.target);
    });

    // Object removed
    this.canvas.on('object:removed', (e: any) => {
      this.plugins.forEach(entry => entry.instance.onObjectRemoved?.(e.target));
      this.eventBus.emitEvent(EditorEvent.OBJECT_REMOVED, e.target);
    });

    // Object modified
    this.canvas.on('object:modified', (e: any) => {
      this.plugins.forEach(entry => entry.instance.onObjectModified?.(e.target));
      this.eventBus.emitEvent(EditorEvent.OBJECT_MODIFIED, e.target);
    });

    // Before render
    this.canvas.on('before:render', () => {
      this.plugins.forEach(entry => entry.instance.onBeforeRender?.());
    });

    // After render
    this.canvas.on('after:render', () => {
      this.plugins.forEach(entry => entry.instance.onAfterRender?.());
    });
  }

  initEditor() {
    if (this.canvas) {
      this.canvas.clear();
      this.state.value = 'Init';
      this.editorState.reset();
      this.canvas.requestRenderAll();
    }
  }

  /**
   * Enhanced plugin registration with dependency resolution
   */
  use(pluginClass: FabricPluginConstructor, options?: PluginRegistrationOptions): this {
    const pluginName = pluginClass.pluginName;

    if (this.plugins.has(pluginName)) {
      console.warn(`Plugin ${pluginName} already registered, skipping`);
      return this;
    }

    // Check dependencies
    if (options?.depends) {
      for (const dep of options.depends) {
        if (!this.plugins.has(dep)) {
          throw new Error(`Plugin ${pluginName} depends on ${dep}, but it is not registered`);
        }
      }
    }

    // Create plugin instance
    const plugin = new pluginClass(
      this.canvas!,
      this,
      this.context!,
      options?.config
    );

    // Store plugin with options
    this.plugins.set(pluginName, { instance: plugin, options: options || {} });

    // Call onRegister hook
    plugin.onRegister?.(this, this.context!);

    // Expose methods
    const exposedMethods = plugin.exposedMethods || [];
    exposedMethods.forEach(method => {
      if (!plugin[method]) {
        throw new Error(`Method ${method} not found on plugin ${pluginName}`);
      }
      this[method] = plugin[method].bind(plugin);
    });

    // If canvas is already initialized, trigger onCanvasInit
    if (this.canvas) {
      plugin.onCanvasInit?.(this.canvas);
    }

    this.eventBus.emitEvent(EditorEvent.PLUGIN_LOADED, { pluginName });

    return this;
  }

  /**
   * Register multiple plugins with automatic dependency sorting
   */
  registerPlugins(
    plugins: Array<{ plugin: FabricPluginConstructor; options?: PluginRegistrationOptions }>
  ): this {
    // Sort by priority (higher first)
    const sorted = plugins.sort((a, b) => {
      const aPriority = a.options?.priority ?? 0;
      const bPriority = b.options?.priority ?? 0;
      return bPriority - aPriority;
    });

    // Register each plugin
    for (const { plugin, options } of sorted) {
      this.use(plugin, options);
    }

    return this;
  }

  newEditor() {
    this.initEditor();
  }

  getPlugin(name: string): FabricPlugin | undefined {
    return this.plugins.get(name)?.instance;
  }

  get fabricCanvas(): Canvas | null {
    return this.canvas;
  }

  destroy() {
    this.eventBus.emitEvent(EditorEvent.BEFORE_DESTROY);
    this.emit('beforeDestroy');

    this.plugins.forEach(entry => entry.instance.onDestroy?.());
    this.canvas?.dispose();
    this.canvas = null;

    this.eventBus.emitEvent(EditorEvent.AFTER_DESTROY);
    console.log('FabricEditor destroyed');
  }
}

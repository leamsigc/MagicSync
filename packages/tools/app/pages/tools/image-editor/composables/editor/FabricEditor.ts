import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { Canvas, FabricObject, InteractiveFabricObject, type FabricObjectProps, type CanvasEvents, type TClassProperties } from 'fabric';
import EventEmitter from 'events';

// Define a type that extends FabricObject to include a 'name' property
export interface FabricObjectWithName extends FabricObject {
  name?: string;
  id?: string;
}

export type EditorState = 'Init' | 'New' | 'Editing' | 'Export';

export interface FabricPlugin {
  // Static property for the plugin class
  readonly pluginName: string;
  readonly events?: string[];
  readonly hooks?: EditorHookType[];
  readonly exposedMethods?: string[];

  onRegister?(editor: FabricEditor): void;
  onDestroy?(): void;

  onCanvasInit?(canvas: Canvas): void;
  onSelectionCreated?(activeObject: FabricObject): void;
  onSelectionCleared?(): void;
}

// Interface for the plugin constructor to include static properties
export interface FabricPluginConstructor {
  new(canvas: Canvas, editor: FabricEditor, options?: any): BaseFabricPlugin;
  pluginName: string; // Static property
}

export abstract class BaseFabricPlugin implements FabricPlugin {
  // Instance property for plugin name, matching the interface
  abstract readonly pluginName: string;
  public canvas: Canvas;
  public editor: FabricEditor;
  public exposedMethods?: string[] | undefined;
  [key: string]: any; // Add index signature

  // Explicitly declare optional methods from FabricPlugin
  onRegister?(editor: FabricEditor): void;
  onDestroy?(): void;
  onCanvasInit?(canvas: Canvas): void;
  onSelectionCreated?(activeObject: FabricObject): void;
  onSelectionCleared?(): void;

  constructor(canvas: Canvas, editor: FabricEditor, options?: any) {

    this.canvas = canvas;
    this.editor = editor;
    this.init(options);
  }

  protected abstract init(options?: any): void;

  protected emit(event: string, ...args: any[]) {
    this.editor.emit(event, ...args);
  }

  protected onCanvasEvent<K extends keyof CanvasEvents>(event: K, handler: (options: CanvasEvents[K]) => any) {
    this.canvas?.on(event, handler);
  }
}

export type EditorHookType = 'beforeSave' | 'afterSave' | 'beforeLoad' | 'afterLoad' | 'beforeExport' | 'afterExport';

export class FabricEditor extends EventEmitter {
  private canvas: Canvas | null = null;
  private plugins: Map<string, FabricPlugin> = new Map();
  public state: Ref<EditorState> = ref('Init');
  [key: string]: any;

  public activeLayer: Ref<FabricObjectWithName | null> = ref(null);
  public globalSettings: Ref<{ width: number; height: number, fill: string, stroke: string, strokeWidth: number }> = ref({
    width: 1242,
    height: 1660,
    fill: '#1DA1F2',
    stroke: '#ccc',
    strokeWidth: 1,
  });
  public interactiveDefaults: Partial<
    TClassProperties<InteractiveFabricObject>
  > = {
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

    // Attempt immediate initialization if the ref is already populated (e.g., in onMounted)
    if (elementRef.value) {
      this.init(elementRef.value);
    } else {
      // Fallback for setup() usage where ref is not yet populated
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
    this.canvas = new Canvas(canvasElement, {
      backgroundColor: "rgba(0,0,0,.1)",
      fireRightClick: true,
      stopContextMenu: true,
      controlsAboveOverlay: true,
      imageSmoothingEnabled: false,
      preserveObjectStacking: true,
    });

    InteractiveFabricObject.ownDefaults = {
      ...InteractiveFabricObject.ownDefaults,
      ...this.interactiveDefaults
    };

    this.state.value = 'New';

    this.canvas.on('selection:created' as keyof CanvasEvents, (e: any) => { // Cast to any to access 'selected'
      const selectedObject = e.selected?.[0];
      if (selectedObject) {
        this.activeLayer.value = selectedObject as FabricObjectWithName;
        selectedObject.set({
          borderColor: '#020420',
          cornerColor: '#00DC82',
          cornerSize: 10,
          transparentCorners: false,
        });
        this.canvas?.requestRenderAll();
        this.plugins.forEach(plugin => plugin.onSelectionCreated?.(selectedObject));
      }
    });
    this.canvas.on('selection:cleared' as keyof CanvasEvents, () => {
      this.activeLayer.value = null;
      this.plugins.forEach(plugin => plugin.onSelectionCleared?.());
    });
    this.plugins.forEach(plugin => plugin.onCanvasInit?.(this.canvas!));

  }

  initEditor() {
    if (this.canvas) {
      this.canvas.clear();
      this.state.value = 'Init';
      this.canvas.requestRenderAll();
    }
  }

  use(pluginClass: FabricPluginConstructor, options?: any): this {
    const pluginName = pluginClass.pluginName;
    if (this.plugins.has(pluginName)) {
      throw new Error(`Plugin ${pluginName} already registered`);
    }

    const plugin = new pluginClass(this.canvas!, this, options);
    this.plugins.set(pluginName, plugin);
    plugin.onRegister?.(this);

    const exposedMethods = plugin.exposedMethods || [];
    exposedMethods.forEach(method => {
      // Check if the method exists on the plugin
      if (!plugin[method]) {
        throw new Error(`Method ${method} not found on plugin ${pluginName}`);
      }
      this[method] = plugin[method].bind(plugin);
    });

    // If canvas is already initialized, trigger onCanvasInit for this new plugin
    if (this.canvas) {
      plugin.onCanvasInit?.(this.canvas);
    }

    return this;
  }

  newEditor() {
    this.initEditor();
  }

  getPlugin(name: string): FabricPlugin | undefined {
    return this.plugins.get(name);
  }

  get fabricCanvas(): Canvas | null {
    return this.canvas;
  }

  destroy() {
    this.plugins.forEach(plugin => plugin.onDestroy?.());
    this.canvas?.dispose();
    this.canvas = null;
    console.log('FabricEditor canvas disposed.');
  }
}

import { Canvas, iMatrix, Point, Rect, util } from 'fabric';
import { BaseFabricPlugin, FabricEditor, type FabricObjectWithName } from './FabricEditor';

// Custom throttle implementation
function customThrottle<T extends (...args: any[]) => any>(func: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: any[] | null = null;
  let lastThis: any = null;

  return function (this: any, ...args: any[]) {
    lastArgs = args;
    lastThis = this;

    if (!timeoutId) {
      timeoutId = setTimeout(() => {
        func.apply(lastThis, lastArgs!);
        timeoutId = null;
        lastArgs = null;
        lastThis = null;
      }, delay);
    }
  } as T;
}


export class CorePlugin extends BaseFabricPlugin {
  static readonly pluginName = 'core';
  override readonly pluginName = 'core';

  override readonly exposedMethods = [
    'big',
    'small',
    'auto',
    'one',
    'setSize',
    'getWorkspace',
    'getWorkspaceBg',
    'setCenterFromObject',
    'setWorkspaceBg',
  ];

  workspaceEl!: HTMLElement;
  workspace: null | Rect;
  resizeObserver!: ResizeObserver;
  zoomRatio: number;

  constructor(canvas: Canvas, editor: FabricEditor) {
    super(canvas, editor);

    this.workspace = null;
    this.zoomRatio = 0.85;

  }

  protected init() {
    this.workspace = null;
    this.zoomRatio = 0.85;
  }

  override onCanvasInit(canvas: Canvas) {
    this.canvas = canvas; // Ensure local reference is set if needed, though super should handle it.

    const workspaceEl = document.querySelector('#workspace') as HTMLElement;
    if (!workspaceEl) {
      throw new Error('element #workspace is missing, plz check!');
    }
    this.workspaceEl = workspaceEl;

    this._initBackground();
    this._initWorkspace();
    this._initResizeObserve();
    this._bindWheel();
  }

  _initBackground() {
    const { width, height } = this.editor.globalSettings.value;
    this.canvas.setDimensions({
      width,
      height,
    });
  }

  _initWorkspace() {
    const { width, height, fill } = this.editor.globalSettings.value;
    const workspace = new Rect({
      fill: fill,
      width,
      height,
      id: 'workspace',
      strokeWidth: 0,
    });
    workspace.set('selectable', false);
    workspace.set('hasControls', false);
    workspace.hoverCursor = 'default';
    this.canvas.add(workspace);
    this.canvas.renderAll();

    this.workspace = workspace;

    this.auto();
  }

  _initResizeObserve() {
    const resizeObserver = new ResizeObserver(
      customThrottle(() => { // Using customThrottle
        this.auto();
      }, 50)
    );
    this.resizeObserver = resizeObserver;
    this.resizeObserver.observe(this.workspaceEl);
  }

  _bindWheel() {
    this.canvas.on('mouse:wheel', (opt: any) => {
      const delta = opt.e.deltaY;

      let zoom = this.canvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 5) zoom = 5;
      if (zoom < 0.01) zoom = 0.1;

      this.canvas.zoomToPoint(new Point(opt.e.offsetX, opt.e.offsetY), zoom);
      this.canvas.requestRenderAll();
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });
  }

  getWorkspace() {
    return this.canvas.getObjects().find((item: FabricObjectWithName) => item.id === 'workspace') as Rect;
  }

  setCenterFromObject(obj: Rect) {
    const { canvas } = this;
    const objCenter = obj.getCenterPoint();
    const viewportTransform = canvas.viewportTransform;
    if (canvas.width === undefined || canvas.height === undefined || !viewportTransform) return;
    viewportTransform[4] = canvas.width / 2 - objCenter.x * viewportTransform[0];
    viewportTransform[5] = canvas.height / 2 - objCenter.y * viewportTransform[3];
    canvas.setViewportTransform(viewportTransform);
    canvas.renderAll();
  }

  setSize(width: number, height: number) {
    this.editor.globalSettings.value.width = width;
    this.editor.globalSettings.value.height = height;
    this._initBackground();
    this.workspace = this.canvas
      .getObjects()
      .find((item: FabricObjectWithName) => item.id === 'workspace') as Rect;
    if (this.workspace) {
      this.workspace.set('width', width);
      this.workspace.set('height', height);
      this.auto();
    } else {
      // Fallback if workspace not found?
      this._initWorkspace();
    }
  }

  async setZoomAuto(scale: number, cb?: (left?: number, top?: number) => void) {

    const { workspaceEl } = this;
    const width = workspaceEl.offsetWidth;
    const height = workspaceEl.offsetHeight;
    this.canvas.setDimensions({ width, height });
    const center = this.canvas.getCenterPoint();
    this.canvas.zoomToPoint(center, scale);
    if (!this.workspace) return;
    this.setCenterFromObject(this.workspace);

    const cloned = await this.workspace.clone();
    this.canvas.clipPath = cloned;
    this.canvas.requestRenderAll();

    if (cb) cb(this.workspace.left, this.workspace.top);
  }

  _getScale() {
    return util.findScaleToFit(this.getWorkspace(), {
      width: this.workspaceEl.offsetWidth,
      height: this.workspaceEl.offsetHeight,
    });
  }

  big() {
    let zoomRatio = this.canvas.getZoom();
    zoomRatio += 0.05;
    const center = this.canvas.getCenterPoint();
    this.canvas.zoomToPoint(center, zoomRatio);
    this.canvas.requestRenderAll();
  }

  small() {
    let zoomRatio = this.canvas.getZoom();
    zoomRatio -= 0.05;
    const center = this.canvas.getCenterPoint();
    this.canvas.zoomToPoint(
      center,
      zoomRatio < 0 ? 0.01 : zoomRatio
    );
    this.canvas.requestRenderAll();
  }

  auto() {
    const scale = this._getScale();
    this.setZoomAuto(scale * this.zoomRatio);
  }

  one() {
    this.setZoomAuto(1 * this.zoomRatio);
    this.canvas.requestRenderAll();
  }

  setWorkspaceBg(color: string) {
    const workspace = this.getWorkspace();
    workspace?.set('fill', color);
    this.canvas.requestRenderAll();
  }
  getWorkspaceBg() {
    const workspace = this.getWorkspace();
    return workspace?.get('fill');
  }

  override onDestroy() {
    // this.resizeObserver.disconnect();
    this.canvas.off(); // Disconnect all canvas events
    console.log('CorePlugin destroyed');
  }
}

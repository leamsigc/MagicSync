import { BaseFabricPlugin } from '../FabricEditor';

/**
 * Ruler + guides plugin.
 *
 * Draws real top/left rulers on a DOM overlay (canvas strips), keeps guide
 * lines in workspace pixels and lets the user drag them. Guides live outside
 * fabric, so they never leak into exports, documents or batch renders.
 *
 * Coordinates: guides are stored in *canvas* coordinates (0..frame width).
 * Screen position = canvasEl offset + vpt[4] + zoom * value.
 */

interface Guide {
  id: string;
  orientation: 'horizontal' | 'vertical';
  position: number;
}

interface GuideDrag {
  id: string;
  orientation: 'horizontal' | 'vertical';
  pointerId: number;
}

const RULER_SIZE = 20;

export class RulerPlugin extends BaseFabricPlugin {
  static readonly pluginName = 'ruler';
  override readonly pluginName = 'ruler';

  override readonly exposedMethods = [
    'addGuideline',
    'removeGuideline',
    'clearGuidelines',
    'getGuidelines',
    'toggleRulers',
    'toggleGuidelineSnap',
    'isGuidelineSnapEnabled',
  ];

  private rulersVisible = false;
  private snapEnabled = true;
  private guides: Guide[] = [];
  private drag: GuideDrag | null = null;

  private overlay: HTMLDivElement | null = null;
  private topRuler: HTMLCanvasElement | null = null;
  private leftRuler: HTMLCanvasElement | null = null;
  private guideLayer: HTMLDivElement | null = null;
  private frame = 0;
  private onViewportChange = () => this.scheduleDraw();

  protected init() { }

  toggleRulers(visible: boolean): void {
    this.rulersVisible = visible;
    if (visible) this.mount();
    else this.unmount();
  }

  toggleGuidelineSnap(enabled: boolean): void {
    this.snapEnabled = enabled;
  }

  isGuidelineSnapEnabled(): boolean {
    return this.snapEnabled;
  }

  /** Add a guide at a canvas-space coordinate (defaults to frame center). */
  addGuideline(orientation: 'horizontal' | 'vertical', position?: number): string | null {
    const canvas = this.canvas;
    if (!canvas) return null;
    const center = orientation === 'horizontal'
      ? this.frameSize().height / 2
      : this.frameSize().width / 2;
    const value = Math.round(position ?? center);
    const id = `guide-${orientation}-${Date.now().toString(36)}`;
    this.guides.push({ id, orientation, position: value });
    if (!this.overlay) this.mount();
    this.renderGuides();
    return id;
  }

  removeGuideline(id: string): void {
    this.guides = this.guides.filter(guide => guide.id !== id);
    this.renderGuides();
  }

  clearGuidelines(): void {
    this.guides = [];
    this.renderGuides();
  }

  getGuidelines(): Guide[] {
    return [...this.guides];
  }

  override onDestroy(): void {
    this.unmount();
  }

  /* ------------------------------------------------------------ mounting */

  private workspace(): HTMLElement | null {
    const canvas = this.canvas;
    return (canvas?.wrapperEl?.closest('#workspace') as HTMLElement | null) ?? null;
  }

  private mount(): void {
    if (this.overlay || !this.canvas) return;
    const workspace = this.workspace();
    if (!workspace) return;

    if (getComputedStyle(workspace).position === 'static') workspace.style.position = 'relative';

    this.overlay = document.createElement('div');
    this.overlay.dataset.rulerOverlay = 'true';
    this.overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:20;';

    this.topRuler = this.createRulerCanvas('top');
    this.leftRuler = this.createRulerCanvas('left');

    const corner = document.createElement('div');
    corner.style.cssText = `position:absolute;left:0;top:0;width:${RULER_SIZE}px;height:${RULER_SIZE}px;background:var(--ui-bg-elevated,#fff);border-right:1px solid var(--ui-border,#e5e7eb);border-bottom:1px solid var(--ui-border,#e5e7eb);z-index:2;`;

    this.guideLayer = document.createElement('div');
    this.guideLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;';

    this.overlay.append(this.topRuler, this.leftRuler, corner, this.guideLayer);
    workspace.appendChild(this.overlay);

    workspace.addEventListener('pointermove', this.handlePointerMove);
    workspace.addEventListener('pointerup', this.handlePointerUp);
    workspace.addEventListener('pointercancel', this.handlePointerUp);
    this.canvas.on('after:render', this.onViewportChange);
    window.addEventListener('resize', this.onViewportChange);

    this.renderGuides();
    this.scheduleDraw();
  }

  private createRulerCanvas(kind: 'top' | 'left'): HTMLCanvasElement {
    const element = document.createElement('canvas');
    const vertical = kind === 'left';
    element.style.cssText = vertical
      ? `position:absolute;left:0;top:${RULER_SIZE}px;bottom:0;width:${RULER_SIZE}px;height:calc(100% - ${RULER_SIZE}px);background:var(--ui-bg-elevated,#fff);border-right:1px solid var(--ui-border,#e5e7eb);`
      : `position:absolute;left:${RULER_SIZE}px;top:0;right:0;width:calc(100% - ${RULER_SIZE}px);height:${RULER_SIZE}px;background:var(--ui-bg-elevated,#fff);border-bottom:1px solid var(--ui-border,#e5e7eb);`;
    return element;
  }

  private unmount(): void {
    const workspace = this.workspace();
    workspace?.removeEventListener('pointermove', this.handlePointerMove);
    workspace?.removeEventListener('pointerup', this.handlePointerUp);
    workspace?.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas?.off('after:render', this.onViewportChange);
    window.removeEventListener('resize', this.onViewportChange);
    this.overlay?.remove();
    this.overlay = null;
    this.topRuler = null;
    this.leftRuler = null;
    this.guideLayer = null;
    cancelAnimationFrame(this.frame);
  }

  /* ------------------------------------------------------------ geometry */

  private frameSize(): { width: number; height: number } {
    const workspace = this.workspace();
    const canvas = this.canvas;
    if (!canvas) return { width: 0, height: 0 };
    const box = canvas.wrapperEl?.getBoundingClientRect();
    return { width: box?.width ?? workspace?.clientWidth ?? 0, height: box?.height ?? workspace?.clientHeight ?? 0 };
  }

  /** Canvas element offset inside the workspace. */
  private canvasOrigin(): { left: number; top: number } {
    const workspace = this.workspace();
    const wrapper = this.canvas?.wrapperEl;
    if (!workspace || !wrapper) return { left: 0, top: 0 };
    const ws = workspace.getBoundingClientRect();
    const box = wrapper.getBoundingClientRect();
    return { left: box.left - ws.left, top: box.top - ws.top };
  }

  private scheduleDraw(): void {
    if (!this.overlay) return;
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.draw());
  }

  private draw(): void {
    const canvas = this.canvas;
    if (!canvas || !this.topRuler || !this.leftRuler) return;

    const zoom = canvas.getZoom() || 1;
    const vpt = canvasViewport(canvas);
    const origin = this.canvasOrigin();
    const workspace = this.workspace();
    if (!workspace) return;

    const width = workspace.clientWidth;
    const height = workspace.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    const topCtx = this.prepareCanvas(this.topRuler, width - RULER_SIZE, RULER_SIZE, dpr);
    const leftCtx = this.prepareCanvas(this.leftRuler, RULER_SIZE, height - RULER_SIZE, dpr);
    if (!topCtx || !leftCtx) return;

    const style = getComputedStyle(document.documentElement);
    const ink = style.getPropertyValue('--ui-text-muted').trim() || '#6b7280';
    const border = style.getPropertyValue('--ui-border').trim() || '#e5e7eb';

    const step = this.pickStep(zoom);
    const startX = origin.left + vpt[4] - RULER_SIZE;
    const startY = origin.top + vpt[5] - RULER_SIZE;

    this.drawAxis(topCtx, {
      length: width - RULER_SIZE,
      origin: startX,
      zoom,
      step,
      ink,
      border,
      vertical: false,
    });
    this.drawAxis(leftCtx, {
      length: height - RULER_SIZE,
      origin: startY,
      zoom,
      step,
      ink,
      border,
      vertical: true,
    });

    this.positionGuides();
  }

  private prepareCanvas(element: HTMLCanvasElement, width: number, height: number, dpr: number): CanvasRenderingContext2D | null {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    if (element.width !== Math.round(w * dpr) || element.height !== Math.round(h * dpr)) {
      element.width = Math.round(w * dpr);
      element.height = Math.round(h * dpr);
    }
    const ctx = element.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return ctx;
  }

  private pickStep(zoom: number): number {
    let step = 10;
    while (zoom * step < 56) step *= 2;
    return step;
  }

  private drawAxis(ctx: CanvasRenderingContext2D, options: {
    length: number;
    origin: number;
    zoom: number;
    step: number;
    ink: string;
    border: string;
    vertical: boolean;
  }): void {
    const { length, origin, zoom, step, ink, border, vertical } = options;
    ctx.fillStyle = ink;
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
    ctx.textBaseline = 'top';

    const first = Math.floor((-origin) / (zoom * step)) * step;
    const last = Math.ceil((length - origin) / (zoom * step)) * step;

    for (let value = first; value <= last; value += step) {
      const screen = origin + zoom * value;
      if (screen < 0 || screen > length) continue;
      const major = value % (step * 5) === 0;
      ctx.beginPath();
      if (vertical) {
        ctx.moveTo(RULER_SIZE - (major ? 9 : 5), Math.round(screen) + 0.5);
        ctx.lineTo(RULER_SIZE, Math.round(screen) + 0.5);
      } else {
        ctx.moveTo(Math.round(screen) + 0.5, RULER_SIZE - (major ? 9 : 5));
        ctx.lineTo(Math.round(screen) + 0.5, RULER_SIZE);
      }
      ctx.stroke();

      if (major) {
        if (vertical) {
          ctx.save();
          ctx.translate(2, screen + 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(String(value), 0, 0);
          ctx.restore();
        } else {
          ctx.fillText(String(value), screen + 2, 2);
        }
      }
    }
  }

  /* ------------------------------------------------------------- guides */

  private positionGuides(): void {
    if (!this.guideLayer || !this.canvas) return;
    const zoom = this.canvas.getZoom() || 1;
    const vpt = canvasViewport(this.canvas);
    const origin = this.canvasOrigin();
    for (const node of this.guideLayer.querySelectorAll<HTMLElement>('[data-guide-id]')) {
      const id = node.dataset.guideId;
      const guide = this.guides.find(entry => entry.id === id);
      if (!guide) continue;
      if (guide.orientation === 'vertical') {
        const x = origin.left + vpt[4] + zoom * guide.position;
        node.style.left = `${x}px`;
        node.style.top = '0';
        node.style.height = '100%';
      } else {
        const y = origin.top + vpt[5] + zoom * guide.position;
        node.style.top = `${y}px`;
        node.style.left = '0';
        node.style.width = '100%';
      }
    }
  }

  private renderGuides(): void {
    if (!this.guideLayer) {
      if (this.guides.length > 0) this.mount();
      return;
    }
    this.guideLayer.innerHTML = '';
    for (const guide of this.guides) {
      const line = document.createElement('div');
      line.dataset.guideId = guide.id;
      line.style.cssText = guide.orientation === 'vertical'
        ? 'position:absolute;width:1px;background:#06b6d4;pointer-events:auto;cursor:col-resize;'
        : 'position:absolute;height:1px;background:#06b6d4;pointer-events:auto;cursor:row-resize;';
      line.addEventListener('pointerdown', event => this.startDrag(event, guide));
      line.addEventListener('dblclick', () => this.removeGuideline(guide.id));
      this.guideLayer.appendChild(line);
    }
    this.positionGuides();
  }

  private startDrag(event: PointerEvent, guide: Guide): void {
    event.preventDefault();
    event.stopPropagation();
    this.drag = { id: guide.id, orientation: guide.orientation, pointerId: event.pointerId };
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.drag || !this.canvas) return;
    const guide = this.guides.find(entry => entry.id === this.drag?.id);
    if (!guide) return;
    const canvas = this.canvas;
    const zoom = canvas.getZoom() || 1;
    const vpt = canvasViewport(canvas);
    const origin = this.canvasOrigin();
    const workspace = this.workspace();
    if (!workspace) return;
    const ws = workspace.getBoundingClientRect();
    const pointerX = event.clientX - ws.left - origin.left;
    const pointerY = event.clientY - ws.top - origin.top;
    guide.position = Math.round(this.drag.orientation === 'vertical'
      ? (pointerX - vpt[4]) / zoom
      : (pointerY - vpt[5]) / zoom);
    this.positionGuides();
  };

  private handlePointerUp = (): void => {
    this.drag = null;
  };
}

/** fabric v7 exposes the transform as a property, not a getter. */
function canvasViewport(canvas: { viewportTransform?: number[] }): number[] {
  return canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
}

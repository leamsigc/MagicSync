import type { Canvas, FabricObject } from 'fabric';
import { BaseFabricPlugin } from '../FabricEditor';

/**
 * Smart alignment guides.
 *
 * While an object moves, compares its edges and centers against every other
 * layer and the frame (edges + center), snaps within a screen-space threshold
 * and draws pink alignment lines on a DOM overlay. Snap respects the ruler
 * plugin's "snap to guides" switch.
 */

const THRESHOLD_PX = 6;
const COLOR = '#ec4899';

interface EdgeCandidate {
  value: number;
  orientation: 'vertical' | 'horizontal';
}

export class AlignGuidelinePlugin extends BaseFabricPlugin {
  static readonly pluginName = 'alignGuides';
  override readonly pluginName = 'alignGuides';

  override readonly exposedMethods = ['setAlignGuidesEnabled', 'isAlignGuidesEnabled'];

  private enabled = true;
  private layer: HTMLDivElement | null = null;
  private workspaceEl: HTMLElement | null = null;

  protected init() {
    this.canvas?.on('object:moving', this.handleMoving);
    this.canvas?.on('object:modified', this.clearLines);
    this.canvas?.on('mouse:up', this.clearLines);
  }

  setAlignGuidesEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clearLines();
  }

  isAlignGuidesEnabled(): boolean {
    return this.enabled;
  }

  override onDestroy(): void {
    this.canvas?.off('object:moving', this.handleMoving);
    this.canvas?.off('object:modified', this.clearLines);
    this.canvas?.off('mouse:up', this.clearLines);
    this.layer?.remove();
  }

  private workspace(): HTMLElement | null {
    if (this.workspaceEl?.isConnected) return this.workspaceEl;
    const wrapper = this.canvas?.wrapperEl;
    this.workspaceEl = (wrapper?.closest('#workspace') as HTMLElement | null) ?? null;
    return this.workspaceEl;
  }

  private ensureLayer(): HTMLDivElement | null {
    if (this.layer?.isConnected) return this.layer;
    const workspace = this.workspace();
    if (!workspace) return null;
    this.layer = document.createElement('div');
    this.layer.dataset.alignGuides = 'true';
    this.layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:19;';
    workspace.appendChild(this.layer);
    return this.layer;
  }

  private clearLines = (): void => {
    if (this.layer) this.layer.innerHTML = '';
  };

  private snapEnabled(): boolean {
    const ruler = this.editor.getPlugin('ruler') as { isGuidelineSnapEnabled?: () => boolean } | undefined;
    return ruler?.isGuidelineSnapEnabled?.() ?? true;
  }

  private handleMoving = (event: { target?: FabricObject }): void => {
    if (!this.enabled || !event.target) return;
    const target = event.target;
    const canvas = this.canvas as Canvas | undefined;
    if (!canvas) return;

    const moving = target.getBoundingRect();
    const frame = canvas.getObjects().find(obj => (obj as { id?: string }).id === 'workspace');
    const frameWidth = Math.round(frame?.width ?? 0);
    const frameHeight = Math.round(frame?.height ?? 0);

    const vertical: number[] = [0, frameWidth / 2, frameWidth];
    const horizontal: number[] = [0, frameHeight / 2, frameHeight];

    for (const object of canvas.getObjects()) {
      if (object === target) continue;
      const id = (object as { id?: string }).id;
      if (!id || id === 'workspace') continue;
      const rect = object.getBoundingRect();
      vertical.push(rect.left, rect.left + rect.width / 2, rect.left + rect.width);
      horizontal.push(rect.top, rect.top + rect.height / 2, rect.top + rect.height);
    }

    const zoom = canvas.getZoom() || 1;
    const threshold = THRESHOLD_PX / zoom;

    const vMatch = nearest(this.movingVertical(moving), vertical, threshold);
    const hMatch = nearest(this.movingHorizontal(moving), horizontal, threshold);

    if (this.snapEnabled()) {
      if (vMatch) this.snapAxis(target, 'x', vMatch.delta);
      if (hMatch) this.snapAxis(target, 'y', hMatch.delta);
    }

    this.drawLines(vMatch?.line, hMatch?.line, frameWidth, frameHeight);
  };

  private movingVertical(rect: { left: number; width: number }): Array<{ value: number; offset: number }> {
    return [
      { value: rect.left, offset: 0 },
      { value: rect.left + rect.width / 2, offset: rect.width / 2 },
      { value: rect.left + rect.width, offset: rect.width },
    ];
  }

  private movingHorizontal(rect: { top: number; height: number }): Array<{ value: number; offset: number }> {
    return [
      { value: rect.top, offset: 0 },
      { value: rect.top + rect.height / 2, offset: rect.height / 2 },
      { value: rect.top + rect.height, offset: rect.height },
    ];
  }

  private snapAxis(target: FabricObject, axis: 'x' | 'y', delta: number): void {
    if (axis === 'x') target.set({ left: (target.left ?? 0) + delta });
    else target.set({ top: (target.top ?? 0) + delta });
    target.setCoords();
  }

  private drawLines(vLine: number | undefined, hLine: number | undefined, frameWidth: number, frameHeight: number): void {
    const layer = this.ensureLayer();
    const canvas = this.canvas;
    if (!layer || !canvas) return;
    layer.innerHTML = '';

    const zoom = canvas.getZoom() || 1;
    const vpt = canvasViewport(canvas);
    const workspace = this.workspace();
    const wrapper = canvas.wrapperEl;
    if (!workspace || !wrapper) return;
    const ws = workspace.getBoundingClientRect();
    const box = wrapper.getBoundingClientRect();
    const originX = box.left - ws.left;
    const originY = box.top - ws.top;

    if (vLine !== undefined) {
      const x = originX + vpt[4] + zoom * vLine;
      const line = document.createElement('div');
      line.style.cssText = `position:absolute;left:${x}px;top:${originY}px;width:1px;height:${zoom * frameHeight}px;background:${COLOR};opacity:.8;`;
      layer.appendChild(line);
    }
    if (hLine !== undefined) {
      const y = originY + vpt[5] + zoom * hLine;
      const line = document.createElement('div');
      line.style.cssText = `position:absolute;top:${y}px;left:${originX}px;height:1px;width:${zoom * frameWidth}px;background:${COLOR};opacity:.8;`;
      layer.appendChild(line);
    }
  }
}

/** Closest candidate to any moving edge/center; returns the line + delta. */
function nearest(
  moving: Array<{ value: number; offset: number }>,
  candidates: number[],
  threshold: number,
): { line: number; delta: number } | null {
  let best: { line: number; delta: number } | null = null;
  let bestDistance = threshold;
  for (const edge of moving) {
    for (const candidate of candidates) {
      const distance = Math.abs(candidate - edge.value);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = { line: candidate, delta: candidate - edge.value };
      }
    }
  }
  return best;
}

/** fabric v7 exposes the transform as a property, not a getter. */
function canvasViewport(canvas: { viewportTransform?: number[] }): number[] {
  return canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
}

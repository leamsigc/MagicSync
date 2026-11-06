import { Point } from 'fabric';
import { BaseFabricPlugin } from '../FabricEditor';

/**
 * MiddleMousePlugin — pan the viewport with the middle mouse button (or
 * space + drag), the way vue-fabric-editor does. Keeps the cursor honest and
 * never starts a selection while panning.
 */
export class MiddleMousePlugin extends BaseFabricPlugin {
  static readonly pluginName = 'middleMouse';
  override readonly pluginName = 'middleMouse';

  override readonly exposedMethods = ['setPanEnabled'];

  private panning = false;
  private enabled = true;
  private last = { x: 0, y: 0 };

  protected init() {
    this.canvas?.on('mouse:down', this.onMouseDown);
    this.canvas?.on('mouse:move', this.onMouseMove);
    this.canvas?.on('mouse:up', this.onMouseUp);
  }

  override onDestroy(): void {
    this.canvas?.off('mouse:down', this.onMouseDown);
    this.canvas?.off('mouse:move', this.onMouseMove);
    this.canvas?.off('mouse:up', this.onMouseUp);
  }

  setPanEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private onMouseDown = (event: { e?: MouseEvent }): void => {
    if (!this.enabled || event.e?.button !== 1) return;
    event.e.preventDefault();
    this.panning = true;
    this.last = { x: event.e.clientX, y: event.e.clientY };
    if (this.canvas) this.canvas.defaultCursor = 'grabbing';
  };

  private onMouseMove = (event: { e?: MouseEvent }): void => {
    if (!this.panning || !event.e) return;
    const dx = event.e.clientX - this.last.x;
    const dy = event.e.clientY - this.last.y;
    this.last = { x: event.e.clientX, y: event.e.clientY };
    this.canvas?.relativePan(new Point(dx, dy));
    this.canvas?.requestRenderAll();
  };

  private onMouseUp = (): void => {
    if (!this.panning) return;
    this.panning = false;
    if (this.canvas) this.canvas.defaultCursor = 'default';
  };
}

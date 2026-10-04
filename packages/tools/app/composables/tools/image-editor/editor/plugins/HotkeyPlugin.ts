import { Canvas, FabricObject } from 'fabric';
import { BaseFabricPlugin, FabricEditor } from '../FabricEditor';

const FORM_CONTROL_SELECTOR = 'input, textarea, select, button, [role="slider"], [role="combobox"], [role="listbox"], [role="menu"], [role="dialog"], [contenteditable="true"]';

/**
 * Canvas hotkeys must stay out of the way while the user operates form
 * controls (sliders, selects, dialogs). Otherwise arrow keys nudge the
 * canvas object AND prevent UI widgets from receiving them.
 */
const isFormControlEvent = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement | null;
  if (!target || typeof target.closest !== 'function') return false;
  return target.closest(FORM_CONTROL_SELECTOR) !== null;
};

export class HotkeyPlugin extends BaseFabricPlugin {
  static readonly pluginName = 'hotkey';
  override readonly pluginName = 'hotkey';

  override readonly exposedMethods = [];

  protected init() {
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  override onDestroy() {
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (isFormControlEvent(e)) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      const activeObject = this.canvas?.getActiveObject();
      if (activeObject) {
        this.canvas?.remove(activeObject);
        this.canvas?.discardActiveObject();
        this.canvas?.requestRenderAll();
      }
    }

    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'c':
          const clipboardPlugin = this.editor.getPlugin('clipboard') as any;
          clipboardPlugin?.copy();
          break;
        case 'v':
          const clipboardPluginV = this.editor.getPlugin('clipboard') as any;
          clipboardPluginV?.paste();
          break;
        case 'z':
          const historyPlugin = this.editor.getPlugin('history') as any;
          historyPlugin?.undo();
          break;
        case 'y':
          const historyPluginY = this.editor.getPlugin('history') as any;
          historyPluginY?.redo();
          break;
      }
    }

    // Arrow movement
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      const activeObject = this.canvas?.getActiveObject();
      if (activeObject) {
        const step = e.shiftKey ? 10 : 1;
        switch (e.key) {
          case 'ArrowLeft': activeObject.set('left', activeObject.left! - step); break;
          case 'ArrowRight': activeObject.set('left', activeObject.left! + step); break;
          case 'ArrowUp': activeObject.set('top', activeObject.top! - step); break;
          case 'ArrowDown': activeObject.set('top', activeObject.top! + step); break;
        }
        activeObject.setCoords();
        this.canvas?.requestRenderAll();
        e.preventDefault();
      }
    }
  }
}

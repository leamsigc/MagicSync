import { Canvas, Group, ActiveSelection, FabricObject } from 'fabric';
import { BaseFabricPlugin, FabricEditor } from './FabricEditor';
import type { EditorContext } from './PluginContext';

// Simple uuid generator for now
const uuid = () => Math.random().toString(36).substring(2, 9);

// Type guards
function isActiveSelection(object: FabricObject | undefined): object is ActiveSelection {
  return object?.type === 'activeSelection';
}

function isGroup(object: FabricObject | undefined): object is Group {
  return object?.type === 'group';
}

export class GroupPlugin extends BaseFabricPlugin {
  static readonly pluginName = 'GroupPlugin';
  readonly pluginName = 'GroupPlugin';

  constructor(canvas: Canvas, editor: FabricEditor, context: EditorContext, options?: any) {
    super(canvas, editor, context, options);
  }

  protected init() {
    // Initialization logic if any
  }

  // Ungroup elements
  unGroup() {
    const activeObject = this.canvas.getActiveObject() as Group;
    if (!activeObject) return;
    // Get currently selected objects, then ungroup
    const activeObjectList = activeObject.getObjects();
    (activeObject as any).toActiveSelection(); // Cast to any for toActiveSelection
    for (const item of activeObjectList) {
      item.set('id', uuid());
    }
    this.canvas.discardActiveObject();
    this.canvas.renderAll();
  }

  // Group elements
  group() {
    const activeObj = this.canvas.getActiveObject() as ActiveSelection;
    if (!activeObj) return;
    const activegroup = (activeObj as any).toGroup(); // Cast to any for toGroup
    const objectsInGroup = activegroup.getObjects();
    activegroup.clone((newgroup: Group) => {
      newgroup.set('id', uuid());
      this.canvas.remove(activegroup);
      objectsInGroup.forEach((object: FabricObject) => { // Explicitly type object
        this.canvas.remove(object);
      });
      this.canvas.add(newgroup);
      this.canvas.setActiveObject(newgroup);
    });
  }



  override onDestroy() {
    console.log('GroupPlugin destroyed');
  }
}

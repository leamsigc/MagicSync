import { BaseFabricPlugin, FabricEditor, type EditorHookType } from './FabricEditor';

export class HooksPlugin extends BaseFabricPlugin {
  static readonly pluginName = 'hooks';
  override readonly pluginName = 'hooks';

  private hooks: Record<EditorHookType, Function[]> = {
    beforeSave: [],
    afterSave: [],
    beforeLoad: [],
    afterLoad: [],
    beforeExport: [],
    afterExport: []
  };

  protected init() { }

  registerHook(hookType: EditorHookType, callback: Function) {
    this.hooks[hookType].push(callback);
  }

  async executeHook(hookType: EditorHookType, data?: any): Promise<any> {
    for (const hook of this.hooks[hookType]) {
      data = await hook(data);
    }
    return data;
  }
}

import { Canvas, IText } from 'fabric';
import { BaseFabricPlugin, FabricEditor } from '../FabricEditor';

export class FontPlugin extends BaseFabricPlugin {
  static readonly pluginName = 'font';
  override readonly pluginName = 'font';

  static readonly GOOGLE_FONTS = [
    'Arial',
    'Roboto',
    'Open Sans',
    'Lato',
    'Montserrat',
    'Oswald',
    'Source Sans Pro',
    'Slabo 27px',
    'Raleway',
    'PT Sans',
    'Merriweather',
    'Nunito',
    'Concert One',
    'Prompt',
    'Work Sans',
    'Chewy',
  ];

  override readonly exposedMethods = [
    'addTextLayer',
    'updateTextProperties',
    'updateTextShadow',
    'getFontList'
  ];

  protected init() { }

  getFontList() {
    return FontPlugin.GOOGLE_FONTS;
  }
  addTextLayer(text: string = 'New Text', options?: any) {
    console.log('addTextLayer called', text, options);
    if (this.canvas) {
      const center = this.canvas.getVpCenter();
      console.log('Center:', center);
      const textObject = new IText(text, {
        left: center.x,
        top: center.y,
        originX: 'center',
        originY: 'center',
        fontSize: 16,
        fontFamily: 'Arial',
        fill: '#000000',
        ...options,
      });
      console.log('Created text object:', textObject);
      this.canvas.add(textObject);
      this.canvas.setActiveObject(textObject);
      this.canvas.requestRenderAll();
      this.editor.state.value = 'Editing';
    } else {
      console.error('Canvas not initialized in addTextLayer');
    }
  }

  updateTextProperties(props: {
    fontSize?: number;
    fontFamily?: string;
    fill?: string;
    fontWeight?: string | number;
    fontStyle?: string;
    underline?: boolean;
    linethrough?: boolean;
    textAlign?: string;
    letterSpacing?: number;
    lineHeight?: number
  }) {
    if (this.canvas) {
      const activeObject = this.canvas.getActiveObject();
      if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'text' || activeObject.type === 'textbox')) {
        // Handle native Fabric props
        const fabricProps: any = { ...props };

        // Map custom props
        if (props.letterSpacing !== undefined) {
          fabricProps.charSpacing = props.letterSpacing; // Fabric uses charSpacing (thousands-based often, but basic works)
          delete fabricProps.letterSpacing;
        }

        // Apply
        activeObject.set(fabricProps);

        // If font family changed, we might need to load it?
        // For now assuming WebFontLoader handles it or system fonts.
        // In a real app, we'd use WebFontLoader here.

        this.canvas.requestRenderAll();
      }
    }
  }

  updateTextShadow(shadow: { offsetX?: number; offsetY?: number; blur?: number; color?: string }) {
    const shadowPlugin = this.editor.getPlugin('shadow') as any;
    if (shadowPlugin) {
      shadowPlugin.updateShadow(shadow);
    }
  }
}

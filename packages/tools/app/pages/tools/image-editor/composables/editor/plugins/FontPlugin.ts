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
    if (this.canvas) {
      const textObject = new IText(text, {
        left: this.canvas.width! / 2,
        top: this.canvas.height! / 2,
        fontSize: 40,
        fontFamily: 'Inter',
        fill: '#333333',
        ...options,
      });
      textObject.setControlsVisibility({
          mt: true, mb: true, ml: true, mr: true,
          bl: true, br: true, tl: true, tr: true,
          mtr: true,
      });
      this.canvas.add(textObject);
      this.canvas.setActiveObject(textObject);
      this.canvas.requestRenderAll();
      this.editor.state.value = 'Editing';
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

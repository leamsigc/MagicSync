import { Canvas, FabricObject, FabricImage, Point, Gradient, Pattern } from 'fabric';
import { BaseFabricPlugin, FabricEditor, type FabricObjectWithName } from '../FabricEditor';

export class WorkspacePlugin extends BaseFabricPlugin {
  static readonly pluginName = 'workspace';
  override readonly pluginName = 'workspace';

  override readonly exposedMethods = [
    'updateFrameSettings',
    'updateFrameSettingsToImageDimension',
    'setBackgroundColor',
    'setBackgroundGradient',
    'setBackgroundImage',
    'clearBackground',
    'updateCanvasDimensions',
    'zoomIn',
    'zoomOut',
    'one',
    'auto'
  ];

  protected init() { }

  updateFrameSettings(settings: {
    width?: number;
    height?: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
  }) {
    const core = this.editor.getPlugin('core') as any;
    if (!core) return;

    const width = settings.width || this.editor.globalSettings.value.width;
    const height = settings.height || this.editor.globalSettings.value.height;

    core.setSize(width, height);

    const workspace = core.getWorkspace();
    if (workspace) {
      if (settings.fill) workspace.set('fill', settings.fill);
      if (settings.stroke) workspace.set('stroke', settings.stroke);
      if (settings.strokeWidth !== undefined) workspace.set('strokeWidth', settings.strokeWidth);
      this.canvas?.requestRenderAll();
    }

    this.editor.globalSettings.value = {
      ...this.editor.globalSettings.value,
      ...settings,
      width,
      height
    };
  }

  updateFrameSettingsToImageDimension() {
    if (this.canvas) {
      const activeObject = this.canvas.getActiveObject();
      if (activeObject instanceof FabricImage) {
        this.updateFrameSettings({
          width: Math.round((activeObject.width || 0) * (activeObject.scaleX || 1)),
          height: Math.round((activeObject.height || 0) * (activeObject.scaleY || 1)),
        });
      }
    }
  }

  setBackgroundColor(color: string) {
    const core = this.editor.getPlugin('core') as any;
    const workspace = core?.getWorkspace();
    if (workspace) {
      workspace.set('fill', color);
      this.canvas?.requestRenderAll();
    }
  }

  setBackgroundGradient(gradient: { type: 'linear' | 'radial'; colors: string[]; angle?: number; centerX?: number; centerY?: number }) {
    const core = this.editor.getPlugin('core') as any;
    const workspace = core?.getWorkspace();
    if (!workspace) return;

    const width = workspace.width;
    const height = workspace.height;

    const stops = gradient.colors.map((color, index) => ({
      offset: index / (gradient.colors.length - 1),
      color
    }));

    let coords: any = { x1: 0, y1: 0, x2: 0, y2: height }; // Default vertical

    if (gradient.type === 'linear') {
      const angleRad = ((gradient.angle ?? 90) * Math.PI) / 180; // 90 degrees = vertical (top to bottom)
      const centerX = width / 2;
      const centerY = height / 2;
      const length = Math.sqrt(width * width + height * height);

      coords = {
        x1: centerX - length * Math.cos(angleRad),
        y1: centerY - length * Math.sin(angleRad),
        x2: centerX + length * Math.cos(angleRad),
        y2: centerY + length * Math.sin(angleRad)
      };
    } else {
      coords = {
        r1: 0,
        r2: Math.max(width, height) / 2,
        x1: width / 2,
        y1: height / 2,
        x2: width / 2,
        y2: height / 2,
      };
    }

    const bgGradient = new Gradient({
      type: gradient.type,
      coords: coords,
      colorStops: stops
    });

    workspace.set('fill', bgGradient);
    this.canvas?.requestRenderAll();
  }

  async setBackgroundImage(url: string) {
    const core = this.editor.getPlugin('core') as any;
    const workspace = core?.getWorkspace();
    if (!workspace) return;

    try {
      const img = await FabricImage.fromURL(url);
      if (!img) return;

      // Resize image to cover the workspace (cover mode)
      const scaleX = workspace.width / img.width;
      const scaleY = workspace.height / img.height;
      const scale = Math.max(scaleX, scaleY);

      img.scale(scale);

      // Center pattern
      const pattern = new Pattern({
        source: img.getElement() as HTMLImageElement,
        repeat: 'no-repeat',
      });

      // Fabric Pattern doesn't natively support "cover" scaling easily without transforming the pattern matrix.
      // A simpler approach for "workspace background" (since it's a specific Rect) might be to set 'fill' to a Pattern, but handling the matrix is annoying.
      // Alternative: Just use the image as the fill via Pattern but we need to ensure it scales.

      // Actually, for a specific "Design" tool, often the background image is just an image object locked at the bottom of the stack inside the group,
      // OR we use the Pattern. Let's try Pattern with a PatternTransform if Fabric v6 supports it, or just standard Pattern.
      // For now, let's just use the Pattern.

      workspace.set('fill', pattern);
      this.canvas?.requestRenderAll();

    } catch (e) {
      console.error('Failed to set background image', e);
    }
  }

  clearBackground() {
    const core = this.editor.getPlugin('core') as any;
    const workspace = core?.getWorkspace();
    if (workspace) {
      workspace.set('fill', 'transparent');
      this.canvas?.requestRenderAll();
    }
  }

  updateCanvasDimensions(width: number, height: number) {
    if (this.canvas) {
      this.canvas.setDimensions({ width, height });
      this.canvas.requestRenderAll();
    }
  }

  zoomIn() {
    if (this.canvas) {
      const center = this.canvas.getCenterPoint();
      this.canvas.zoomToPoint(center, this.canvas.getZoom() * 1.1);
      this.canvas.requestRenderAll();
    }
  }

  zoomOut() {
    if (this.canvas) {
      const center = this.canvas.getCenterPoint();
      this.canvas.zoomToPoint(center, this.canvas.getZoom() / 1.1);
      this.canvas.requestRenderAll();
    }
  }

  one() {
    const core = this.editor.getPlugin('core') as any;
    core?.one();
  }

  auto() {
    const core = this.editor.getPlugin('core') as any;
    core?.auto();
  }
}

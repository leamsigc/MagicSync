import { type Ref } from 'vue';
import { FabricEditor } from './editor/FabricEditor';
import { ToolsPlugin } from './editor/ToolsPlugin';
import { HistoryPlugin } from './editor/HistoryPlugin';
import { FabricImage, FabricObject } from 'fabric'; // Import FabricImage and FabricObject

const { start, run: imageRun } = useImageTransformer();

const editor = shallowRef<FabricEditor | null>(null);
export const useFabricJs = () => {

  const run = (elementRef: Ref<HTMLCanvasElement | null>) => {
    editor.value = new FabricEditor(elementRef);
  };

  const triggerRemoveBackground = () => {
    if (!editor.value?.fabricCanvas) {
      console.warn('Canvas or background remover worker not initialized.');
      return;
    }
    const activeObject = editor.value.fabricCanvas.getActiveObject();
    if (activeObject && activeObject instanceof FabricImage) { // Added null check for activeObject
      const imageElement = activeObject.getElement();
      if (imageElement instanceof HTMLImageElement && imageElement.src) {
        fetch(imageElement.src)
          .then((res) => res.blob())
          .then((blob) => {
            const file = new File([blob], 'image_for_bg_removal.png', {
              type: blob.type,
            });
            console.log("Removing image background");
            imageRun(file);
          })
          .catch((error) =>
            console.error(
              'Error fetching image for background removal:',
              error,
            ),
          );
      } else {
        console.warn(
          'Active object is not a simple image or its source is not directly accessible for background removal.',
        );
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = activeObject.width!;
        tempCanvas.height = activeObject.height!;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          activeObject.render(tempCtx);
          tempCanvas.toBlob(async (blob) => {
            if (blob) {
              const file = new File([blob], 'image_for_bg_removal.png', {
                type: 'image/png',
              });
              await imageRun(file);
            }
          }, 'image/png');
        }
      }
    } else {
      console.warn('No active image object selected for background removal.');
    }
  };

  const getCanvasPlugin = (pluginName: string) => {
    if (editor.value) {
      return editor.value.getPlugin(pluginName);
    }
  };

  const updateFrameSettingsToImageDimension = () => {
    if (editor.value) {

      const toolsPlugin = editor.value.getPlugin('tools') as ToolsPlugin;
      // Get image size
      const imageSize = toolsPlugin
      // toolsPlugin.updateFrameSettings(
      //   {
      //     width: ,
      //     height:,
      //   },
      // );
    }
  };

  return {
    editor,
    run,
    // Expose methods from plugins
    initEditor: () => editor.value?.initEditor(),
    newEditor: () => editor.value?.newEditor(),
    getCanvasPlugin,
    setEditingState: () => { if (editor.value) editor.value.state.value = 'Editing'; },
    setExportState: () => { if (editor.value) editor.value.state.value = 'Export'; },
    selectLayer: () => (editor.value?.getPlugin('tools') as ToolsPlugin)?.selectLayer(),
    setActiveLayer: (layer: FabricObject) => (editor.value?.getPlugin('tools') as ToolsPlugin)?.setActiveLayer(layer),
    deleteLayer: (layer?: FabricObject) => (editor.value?.getPlugin('tools') as ToolsPlugin)?.deleteLayer(layer),
    cropLayer: () => (editor.value?.getPlugin('tools') as ToolsPlugin)?.cropLayer(),
    rotateLayer: (angle: number) => (editor.value?.getPlugin('tools') as ToolsPlugin)?.rotateLayer(angle),
    addBrushLayer: (color?: string, width?: number) => (editor.value?.getPlugin('tools') as ToolsPlugin)?.addBrushLayer(color, width),
    addTextLayer: (text?: string, options?: any) => (editor.value?.getPlugin('tools') as ToolsPlugin)?.addTextLayer(text, options),
    addShapeLayer: (type: 'rect' | 'circle' | 'triangle', options?: any) => (editor.value?.getPlugin('tools') as ToolsPlugin)?.addShapeLayer(type, options),
    eraseLayer: (width?: number) => (editor.value?.getPlugin('tools') as ToolsPlugin)?.eraseLayer(width),
    undo: () => (editor.value?.getPlugin('history') as HistoryPlugin)?.undo(),
    redo: () => (editor.value?.getPlugin('history') as HistoryPlugin)?.redo(),
    clearCanvas: () => (editor.value?.getPlugin('tools') as ToolsPlugin)?.clearCanvas(),
    updateFrameSettings: (settings: { width?: number; height?: number; fill?: string; stroke?: string; strokeWidth?: number; }) => (editor.value?.getPlugin('tools') as ToolsPlugin)?.updateFrameSettings(settings),
    flipHorizontal: () => (editor.value?.getPlugin('tools') as ToolsPlugin)?.flipHorizontal(),
    flipVertical: () => (editor.value?.getPlugin('tools') as ToolsPlugin)?.flipVertical(),
    rotateLeft: () => (editor.value?.getPlugin('tools') as ToolsPlugin)?.rotateLeft(),
    rotateRight: () => (editor.value?.getPlugin('tools') as ToolsPlugin)?.rotateRight(),
    arrangeFront: () => (editor.value?.getPlugin('tools') as ToolsPlugin)?.arrangeFront(),
    arrangeBack: () => (editor.value?.getPlugin('tools') as ToolsPlugin)?.arrangeBack(),
    setPosition: (x?: number, y?: number) => (editor.value?.getPlugin('tools') as ToolsPlugin)?.setPosition(x, y),
    getLayers: () => (editor.value?.getPlugin('tools') as ToolsPlugin)?.getLayers(),
    toggleLayerVisibility: (layer: FabricObject, visible: boolean) => (editor.value?.getPlugin('tools') as ToolsPlugin)?.toggleLayerVisibility(layer, visible),
    addImageLayer: (imageFile: File) => (editor.value?.getPlugin('tools') as ToolsPlugin)?.addImageLayer(imageFile),
    addImageLayerFromUrl: (url: string) => (editor.value?.getPlugin('tools') as ToolsPlugin)?.addImageLayerFromUrl(url),
    applyImageAdjustment: (filterType: 'Brightness' | 'Contrast' | 'Saturation' | 'Hue' | 'Blur' | 'Sharpen' | 'Invert', value: number) => (editor.value?.getPlugin('tools') as ToolsPlugin)?.applyImageAdjustment(filterType, value),
    applyOpacity: (opacity: number) => (editor.value?.getPlugin('tools') as ToolsPlugin)?.applyOpacity(opacity),
    applyPresetFilter: (preset: string) => (editor.value?.getPlugin('tools') as ToolsPlugin)?.applyPresetFilter(preset),
    triggerRemoveBackground, // Keep this local for now as it uses imageRun
    downloadCanvasImage: (format?: 'png' | 'jpeg', quality?: number) => (editor.value?.getPlugin('tools') as ToolsPlugin)?.downloadCanvasImage(format, quality),
    updateCanvasDimensions: (width: number, height: number) => (editor.value?.getPlugin('tools') as ToolsPlugin)?.updateCanvasDimensions(width, height),
    zoomIn: () => (editor.value?.getPlugin('tools') as ToolsPlugin)?.zoomIn(),
    zoomOut: () => (editor.value?.getPlugin('tools') as ToolsPlugin)?.zoomOut(),
    loadTemplateFromJson: (json: string) => (editor.value?.getPlugin('tools') as ToolsPlugin)?.loadTemplateFromJson(json),
    exportCurrentCanvas: () => (editor.value?.getPlugin('tools') as ToolsPlugin)?.exportCurrentCanvas(),
    groupLayers: () => (editor.value?.getPlugin('tools') as ToolsPlugin)?.groupLayers(),
    updateFrameSettingsToImageDimension
  };
};

import { type Ref } from 'vue';
import { FabricEditor } from './editor/FabricEditor';
import { CorePlugin } from './editor/CorePlugin';
import { HooksPlugin } from './editor/HooksPlugin';
import { HistoryPlugin } from './editor/plugins/HistoryPlugin';
import { AlignPlugin } from './editor/plugins/AlignPlugin';
import { WorkspacePlugin } from './editor/plugins/WorkspacePlugin';
import { LayerPlugin } from './editor/plugins/LayerPlugin';
import { AddBaseTypePlugin } from './editor/plugins/AddBaseTypePlugin';
import { FontPlugin } from './editor/plugins/FontPlugin';
import { FilterPlugin } from './editor/plugins/FilterPlugin';
import { ShadowPlugin } from './editor/plugins/ShadowPlugin';
import { DrawPlugin } from './editor/plugins/DrawPlugin';
import { ExportPlugin } from './editor/plugins/ExportPlugin';
import { ClipboardPlugin } from './editor/plugins/ClipboardPlugin';
import { HotkeyPlugin } from './editor/plugins/HotkeyPlugin';
import { GroupPlugin } from './editor/plugins/GroupPlugin';
import { LockPlugin } from './editor/plugins/LockPlugin';
import { RulerPlugin } from './editor/plugins/RulerPlugin';
import { FabricImage, FabricObject } from 'fabric';

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
    if (activeObject && activeObject instanceof FabricImage) {
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

  return {
    editor,
    run,
    // Base methods
    initEditor: () => editor.value?.initEditor(),
    newEditor: () => editor.value?.newEditor(),
    getCanvasPlugin,
    setEditingState: () => { if (editor.value) editor.value.state.value = 'Editing'; },
    setExportState: () => { if (editor.value) editor.value.state.value = 'Export'; },

    // Proxy methods to plugins
    selectLayer: () => (editor.value as any)?.selectLayer?.(),
    setActiveLayer: (layer: FabricObject) => (editor.value as any)?.setActiveLayer?.(layer),
    deleteLayer: (layer?: FabricObject) => (editor.value as any)?.deleteLayer?.(layer),
    cropLayer: () => (editor.value as any)?.cropLayer?.(),
    cropSquare: () => (editor.value as any)?.cropSquare?.(),
    rotateLayer: (angle: number) => (editor.value as any)?.rotateLayer?.(angle),
    addBrushLayer: (color?: string, width?: number) => (editor.value as any)?.addBrushLayer?.(color, width),
    addTextLayer: (text?: string, options?: any) => (editor.value as any)?.addTextLayer?.(text, options),
    addShapeLayer: (type: 'rect' | 'circle' | 'triangle', options?: any) => (editor.value as any)?.addShapeLayer?.(type, options),
    eraseLayer: (width?: number) => (editor.value as any)?.eraseLayer?.(width),
    undo: () => (editor.value as any)?.undo?.(),
    redo: () => (editor.value as any)?.redo?.(),
    clearCanvas: () => (editor.value as any)?.clearCanvas?.(),
    updateFrameSettings: (settings: any) => (editor.value as any)?.updateFrameSettings?.(settings),
    flipHorizontal: () => (editor.value as any)?.flipHorizontal?.(),
    flipVertical: () => (editor.value as any)?.flipVertical?.(),
    rotateLeft: () => (editor.value as any)?.rotateLeft?.(),
    rotateRight: () => (editor.value as any)?.rotateRight?.(),
    arrangeFront: () => (editor.value as any)?.arrangeFront?.(),
    arrangeBack: () => (editor.value as any)?.arrangeBack?.(),
    setPosition: (x?: number, y?: number) => (editor.value as any)?.setPosition?.(x, y),
    getLayers: () => (editor.value as any)?.getLayers?.() || [],
    toggleLayerVisibility: (layer: FabricObject, visible: boolean) => (editor.value as any)?.toggleLayerVisibility?.(layer, visible),
    addImageLayer: (imageFile: File) => (editor.value as any)?.addImageLayer?.(imageFile),
    addImageLayerFromUrl: (url: string) => (editor.value as any)?.addImageLayerFromUrl?.(url),
    applyImageAdjustment: (filterType: string, value: number) => (editor.value as any)?.applyImageAdjustment?.(filterType, value),
    applyOpacity: (opacity: number) => (editor.value as any)?.applyOpacity?.(opacity),
    applyPresetFilter: (preset: string) => (editor.value as any)?.applyPresetFilter?.(preset),
    triggerRemoveBackground,
    downloadCanvasImage: (format?: string, quality?: number) => (editor.value as any)?.downloadCanvasImage?.(format, quality),
    updateCanvasDimensions: (width: number, height: number) => (editor.value as any)?.updateCanvasDimensions?.(width, height),
    zoomIn: () => (editor.value as any)?.zoomIn?.(),
    zoomOut: () => (editor.value as any)?.zoomOut?.(),
    loadTemplateFromJson: (json: string) => (editor.value as any)?.loadTemplateFromJson?.(json),
    exportCurrentCanvas: () => (editor.value as any)?.exportCurrentCanvas?.(),
    groupLayers: () => (editor.value as any)?.groupLayers?.(),
    updateFrameSettingsToImageDimension: () => (editor.value as any)?.updateFrameSettingsToImageDimension?.(),
    updateShadow: (options: any) => (editor.value as any)?.updateShadow?.(options),
    removeShadow: () => (editor.value as any)?.removeShadow?.(),
    setBackgroundColor: (color: string) => (editor.value as any)?.setBackgroundColor?.(color),
    setBackgroundGradient: (gradient: any) => (editor.value as any)?.setBackgroundGradient?.(gradient),
    setBackgroundImage: (url: string) => (editor.value as any)?.setBackgroundImage?.(url),
    clearBackground: () => (editor.value as any)?.clearBackground?.(),
    updateTextProperties: (props: any) => (editor.value as any)?.updateTextProperties?.(props),
    getFontList: () => (editor.value as any)?.getFontList?.() || [],
    updateBrushSettings: (options: any) => (editor.value as any)?.updateBrushSettings?.(options),
    stopDrawingMode: () => (editor.value as any)?.stopDrawingMode?.(),
    updateTextShadow: (shadow: any) => (editor.value as any)?.updateTextShadow?.(shadow),
    updateStroke: (options: any) => (editor.value as any)?.updateStroke?.(options),
    alignObjects: (alignment: string) => (editor.value as any)?.alignObjects?.(alignment),
    distributeObjects: (distribution: string) => (editor.value as any)?.distributeObjects?.(distribution),
    addGuideline: (orientation: string, position: number) => (editor.value as any)?.addGuideline?.(orientation, position),
    removeGuideline: (id: string) => (editor.value as any)?.removeGuideline?.(id),
    toggleRulers: (visible: boolean) => (editor.value as any)?.toggleRulers?.(visible),
    toggleGuidelineSnap: (enabled: boolean) => (editor.value as any)?.toggleGuidelineSnap?.(enabled),

    // NEW methods
    copy: () => (editor.value as any)?.copy?.(),
    paste: () => (editor.value as any)?.paste?.(),
    clone: () => (editor.value as any)?.clone?.(),
    group: () => (editor.value as any)?.group?.(),
    ungroup: () => (editor.value as any)?.ungroup?.(),
    lock: (layer?: FabricObject) => (editor.value as any)?.lock?.(layer),
    unlock: (layer: FabricObject) => (editor.value as any)?.unlock?.(layer),
  };
};

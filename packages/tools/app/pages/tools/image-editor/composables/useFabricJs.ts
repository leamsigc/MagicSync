import { type Ref, shallowRef, ref, watch } from 'vue';
import { FabricEditor, type FabricPluginConstructor } from './editor/FabricEditor';
import { FabricImage } from 'fabric';

const editor = shallowRef<FabricEditor | null>(null);

/**
 * Reactive mirror of the fabric canvas zoom (percentage).
 * fabric.js state is not reactive, so we refresh it here whenever
 * a zoom action runs or the canvas mutates.
 */
const zoomPercent = ref(100);

/**
 * Shared right-panel tab so the header Export action can reveal
 * the export panel. Module-scoped like the editor instance.
 */
const propertiesTab = ref('design');

const setPropertiesTab = (tab: string) => {
  propertiesTab.value = tab;
};

function refreshZoomPercent() {
  const canvas = editor.value?.fabricCanvas;
  if (canvas) {
    zoomPercent.value = Math.round(canvas.getZoom() * 100);
  }
}

export type BgRemovalOutcome =
  | 'started'
  | 'no-canvas'
  | 'no-selection'
  | 'no-source'
  | 'failed';

const fetchImageFile = async (src: string): Promise<File | null> => {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return new File([blob], 'image_for_bg_removal.png', { type: blob.type });
  } catch {
    return null;
  }
};

const renderObjectToFile = (activeObject: FabricImage): Promise<File | null> => {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = activeObject.width ?? 0;
  tempCanvas.height = activeObject.height ?? 0;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return Promise.resolve(null);
  activeObject.render(tempCtx);
  return new Promise((resolve) => {
    tempCanvas.toBlob((blob) => {
      if (blob) resolve(new File([blob], 'image_for_bg_removal.png', { type: 'image/png' }));
      else resolve(null);
    }, 'image/png');
  });
};

export const useFabricJs = () => {

  const { run: imageRun, result, status: bgStatus, error: bgError, progress: bgProgress, isBusy: isBgBusy, isLoaded: isBgLoaded } = useImageTransformer();


  const run = (elementRef: Ref<HTMLCanvasElement | null>, plugins: FabricPluginConstructor[] = []) => {
    editor.value = new FabricEditor(elementRef);
    if (editor.value) {
      plugins.forEach(plugin => editor.value?.use(plugin));
      // Sync the zoom display once the workspace has been initialised
      requestAnimationFrame(refreshZoomPercent);
      const canvas = editor.value.fabricCanvas;
      canvas?.on('wheel', refreshZoomPercent);
      canvas?.on('touch:gesture', refreshZoomPercent);
    }

    // Watch for background removal results (Single initialization)
    watch(result, (newFiles) => {
      if (newFiles && newFiles.length > 0) {
        const file = newFiles[0];
        const url = URL.createObjectURL(file as Blob);
        editor.value?.addImageLayerFromUrl?.(url);
      }
    });
  };


  const isRemovableImage = (obj: unknown): obj is FabricImage => !!obj && obj instanceof FabricImage;

  const runWithFetchedFile = async (src: string): Promise<BgRemovalOutcome> => {
    const file = await fetchImageFile(src);
    if (!file) return 'failed';
    await imageRun(file);
    return 'started';
  };

  const runWithRenderedFile = async (activeObject: FabricImage): Promise<BgRemovalOutcome> => {
    const fallbackFile = await renderObjectToFile(activeObject);
    if (!fallbackFile) return 'no-source';
    await imageRun(fallbackFile);
    return 'started';
  };

  const runRemovalFor = async (activeObject: FabricImage): Promise<BgRemovalOutcome> => {
    const imageElement = activeObject.getElement();
    if (imageElement instanceof HTMLImageElement && imageElement.src) return runWithFetchedFile(imageElement.src);
    return runWithRenderedFile(activeObject);
  };

  const triggerRemoveBackground = async (): Promise<BgRemovalOutcome> => {
    if (!editor.value?.fabricCanvas) return 'no-canvas';
    const activeObject = editor.value.fabricCanvas.getActiveObject();
    if (!isRemovableImage(activeObject)) return 'no-selection';
    return runRemovalFor(activeObject);
  };

  const undo = () => {
    if (editor.value) {
      editor.value.undo();
    }
  };

  const redo = () => {
    if (editor.value) {
      editor.value.redo();
    }
  };

  const zoomIn = () => {
    if (editor.value) {
      editor.value.zoomIn();
      refreshZoomPercent();
    }
  };

  const zoomOut = () => {
    if (editor.value) {
      editor.value.zoomOut();
      refreshZoomPercent();
    }
  };

  const downloadCanvasImage = () => {
    if (editor.value) {
      editor.value.downloadCanvasImage();
    }
  };

  const getFrameDataUrl = (): string | null => {
    if (!editor.value) return null;
    return editor.value.getFrameDataUrl?.() ?? null;
  };

  const exportCurrentCanvas = () => {
    if (editor.value) {
      editor.value.exportCurrentCanvas();
    }
  };

  return {
    editor,
    zoomPercent,
    propertiesTab,
    setPropertiesTab,
    undo,
    redo,
    zoomIn,
    zoomOut,
    downloadCanvasImage,
    getFrameDataUrl,
    exportCurrentCanvas,
    run,
    triggerRemoveBackground,
    bgStatus,
    bgError,
    bgProgress,
    isBgBusy,
    isBgLoaded
  };
};

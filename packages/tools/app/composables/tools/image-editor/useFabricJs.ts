import { type Ref, shallowRef, ref, watch } from 'vue';
import { FabricEditor, type FabricPluginConstructor } from './editor/FabricEditor';
import { FabricImage } from 'fabric';
import { fileToDataUrl } from '../../../../shared/image-editor/file-to-data-url';

const editor = shallowRef<FabricEditor | null>(null);

/**
 * Image layer the in-flight removal belongs to. Module scope because the
 * header/properties panel trigger the run while the canvas mounts the watcher.
 */
let bgTarget: FabricImage | null = null;

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

/** Shared left-rail tab (properties can jump to the Fonts panel). */
const sidebarTab = ref('layers');
const setSidebarTab = (tab: string) => {
  sidebarTab.value = tab;
};

/**
 * Shared bulk-generation modal visibility — the header action opens it,
 * the page shell mounts StudioBulkModal against this ref.
 */
const bulkModalOpen = ref(false);

/** Bottom timeline strip visibility (Polotno-style edit-as-video). */
const timelineOpen = ref(false);

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
  // blob:/data: sources are already local. Fetching them trips the CSP
  // (`connect-src 'self' https:`) — read the element instead.
  if (src.startsWith('blob:') || src.startsWith('data:')) return null;
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return new File([blob], 'image_for_bg_removal.png', { type: blob.type });
  } catch {
    return null;
  }
};

const firstPositive = (...values: Array<number | undefined>): number => {
  for (const value of values) {
    if (value && value > 0) return value;
  }
  return 0;
};

const renderObjectToFile = async (activeObject: FabricImage): Promise<File | null> => {
  const element = activeObject.getElement() as CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  const width = firstPositive(element.naturalWidth, element.width, activeObject.width);
  const height = firstPositive(element.naturalHeight, element.height, activeObject.height);
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return null;
  try {
    tempCtx.drawImage(element, 0, 0, width, height);
  } catch {
    return null;
  }
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
      const file = newFiles?.[0];
      if (file) void applyBackgroundResult(file as File);
    });
  };

  /**
   * Swap the selected image's element for the cutout. Replacing in place keeps
   * the layer's position, size, rotation and place in the stack; only drop a
   * new layer when the original object is gone (undo, page switch).
   *
   * The document stores image sources, so the cutout is embedded as a data URL
   * — a blob: URL would break the saved design and every batch render.
   */
  const applyBackgroundResult = async (file: File): Promise<void> => {
    const src = await fileToDataUrl(file).catch(() => null);
    if (!src) return;
    const canvas = editor.value?.fabricCanvas;
    const target = bgTarget;
    bgTarget = null;
    if (target && canvas?.getObjects().includes(target)) {
      try {
        await target.setSrc(src);
        target.set({ videoUrl: undefined, poster: undefined });
        canvas.requestRenderAll();
        return;
      } catch {
        // fall through to adding a separate layer
      }
    }
    editor.value?.addImageLayerFromUrl?.(src);
  };


  const isRemovableImage = (obj: unknown): obj is FabricImage => !!obj && obj instanceof FabricImage;

  const runWithFetchedFile = async (src: string): Promise<BgRemovalOutcome | null> => {
    const file = await fetchImageFile(src);
    if (!file) return null;
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
    const fetched = imageElement instanceof HTMLImageElement && imageElement.src
      ? await runWithFetchedFile(imageElement.src)
      : null;
    return fetched ?? runWithRenderedFile(activeObject);
  };

  const triggerRemoveBackground = async (): Promise<BgRemovalOutcome> => {
    if (!editor.value?.fabricCanvas) return 'no-canvas';
    const activeObject = editor.value.fabricCanvas.getActiveObject();
    if (!isRemovableImage(activeObject)) return 'no-selection';
    bgTarget = activeObject;
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
    sidebarTab,
    setSidebarTab,
    bulkModalOpen,
    openBulkModal: () => {
      bulkModalOpen.value = true;
    },
    timelineOpen,
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

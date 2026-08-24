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

function refreshZoomPercent() {
  const canvas = editor.value?.fabricCanvas;
  if (canvas) {
    zoomPercent.value = Math.round(canvas.getZoom() * 100);
  }
}

export const useFabricJs = () => {

  const { run: imageRun, result } = useImageTransformer();


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
    undo,
    redo,
    zoomIn,
    zoomOut,
    downloadCanvasImage,
    getFrameDataUrl,
    exportCurrentCanvas,
    run,
    triggerRemoveBackground
  };
};

import { type Ref, shallowRef, watch } from 'vue';
import { FabricEditor } from './editor/FabricEditor';
import { FabricImage } from 'fabric';

const editor = shallowRef<FabricEditor | null>(null);

export const useFabricJs = () => {

  const { run: imageRun, result } = useImageTransformer();


  const run = (elementRef: Ref<HTMLCanvasElement | null>, plugins: any[] = []) => {
    editor.value = new FabricEditor(elementRef);
    if (editor.value) {
      plugins.forEach(plugin => editor.value?.use(plugin));
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
    }
  };

  const zoomOut = () => {
    if (editor.value) {
      editor.value.zoomOut();
    }
  };

  const downloadCanvasImage = () => {
    if (editor.value) {
      editor.value.downloadCanvasImage();
    }
  };

  const exportCurrentCanvas = () => {
    if (editor.value) {
      editor.value.exportCurrentCanvas();
    }
  };

  return {
    editor,
    undo,
    redo,
    zoomIn,
    zoomOut,
    downloadCanvasImage,
    exportCurrentCanvas,
    run,
    triggerRemoveBackground
  };
};

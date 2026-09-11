import { pipeline } from '@huggingface/transformers';

// NOTE: the model MUST have a `model_type` supported by the installed
// transformers version for the `background-removal` task
// (see MODEL_FOR_*_SEGMENTATION mappings + CUSTOM_ARCHITECTURES).
// `briaai/RMBG-1.4` fails with:
//   Unsupported model type "SegformerForSemanticSegmentation"
// `Xenova/modnet` is this version's documented pipeline default.
const BASE_MODEL = 'Xenova/modnet';
let extractor = null;

const reportFileProgress = (fileProgress) => {
  const fractions = Object.values(fileProgress);
  if (fractions.length === 0) return;
  const average = fractions.reduce((sum, value) => sum + value, 0) / fractions.length;
  self.postMessage({ type: 'status', status: 'loading', progress: Math.round(average * 100) });
};

self.onmessage = async (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'loadModel':
      try {
        self.postMessage({ type: 'status', status: 'loading', progress: 0 });
        const fileProgress = {};
        extractor = await pipeline(
          'background-removal',
          payload.model || BASE_MODEL,
          {
            progress_callback: (data) => {
              if (data.status !== 'progress' || !data.total) return;
              fileProgress[data.file] = (data.loaded ?? 0) / data.total;
              reportFileProgress(fileProgress);
            },
          },
        );
        self.postMessage({ type: 'status', status: 'loaded', progress: 100 });
      } catch (error) {
        self.postMessage({ type: 'error', error: error.message });
      }
      break;

    case 'run':
      if (!extractor) {
        self.postMessage({ type: 'error', error: 'Model not loaded' });
        return;
      }
      try {
        self.postMessage({ type: 'status', status: 'processing', progress: 0 });
        const { image } = payload;

        let imageInput = image;
        if (image instanceof File || image instanceof Blob) {
          imageInput = URL.createObjectURL(image);
        }
        // Single input -> single RawImage (not an array)
        const output = await extractor(imageInput);
        const cutout = Array.isArray(output) ? output[0] : output;
        const blob = await cutout.toBlob('image/png');
        if (imageInput !== image && typeof imageInput === 'string') URL.revokeObjectURL(imageInput);
        const name = typeof image?.name === 'string' && image.name
          ? image.name.replace(/\.[^.]+$/, '') + '-no-bg.png'
          : 'no-background.png';
        const file = new File([blob], name, { type: 'image/png' });
        self.postMessage({ type: 'status', status: 'done', progress: 100 });
        self.postMessage({ type: 'result', result: file });
      } catch (error) {
        self.postMessage({ type: 'error', error: error.message });
      }
      break;

    case 'unloadModel':
      extractor = null;
      self.postMessage({ type: 'status', status: 'unloaded', progress: 100 });
      break;

    default:
      self.postMessage({ type: 'error', error: `Unknown command ${type}` });
      break;
  }
};

import { env, pipeline } from '@huggingface/transformers';

// transformers.js points ONNX Runtime at its CDN by default and then "caches"
// the WASM factory by fetching it, wrapping it in a `blob:` URL and dynamic-
// importing that blob. The app CSP has no `blob:` in `script-src`, so that
// import is rejected (`Failed to fetch dynamically imported module: blob:…`)
// and the pipeline dies with `no available backend found`.
//
// Clearing `wasmPaths` makes ORT fall back to the factory and `.wasm` that Vite
// already bundled next to this worker (same-origin, allowed by `'self'`).
// Single-threaded keeps it working without SharedArrayBuffer/cross-origin
// isolation, which `/tools/**` routes don't get (only `/app/tools/**` does).
const onnxWasm = env.backends.onnx?.wasm;
if (onnxWasm) {
  delete onnxWasm.wasmPaths;
  onnxWasm.numThreads = 1;
}
env.useWasmCache = false;

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

        // Pass the File/Blob straight to the pipeline. Turning it into an
        // object URL makes transformers `fetch()` a blob:, which the app CSP
        // blocks (`connect-src 'self' https: ...`). RawImage reads Blobs with
        // createImageBitmap instead — no network, no CSP entry needed.
        const output = await extractor(image);
        const cutout = Array.isArray(output) ? output[0] : output;
        const blob = await cutout.toBlob('image/png');
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

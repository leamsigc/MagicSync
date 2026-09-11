import { ref, computed } from 'vue';
import ImageBackgroundTransformer from '@/assets/workers/imageBackgroundRemoverWorker?worker';
type WorkerStatus =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'processing'
  | 'done'
  | 'unloaded'
  | 'error';

export const BG_BUSY_CODE = 'ERR_BG_BUSY';

const worker = ref<Worker | null>(null);
const status = ref<WorkerStatus>('idle');
const progress = ref<number>(0);
const error = ref<string | null>(null);
const result = ref<File[]>([]);
// Must stay a `model_type` supported by the installed transformers
// `background-removal` pipeline (see worker note). `briaai/RMBG-1.4`
// fails to resolve — `Xenova/modnet` is this version's default.
const selectedModel = ref<string>('Xenova/modnet');

let loadPromise: Promise<void> | null = null;
let resolveLoad: (() => void) | null = null;
let rejectLoad: ((reason?: unknown) => void) | null = null;

const settleLoadSuccess = () => {
  resolveLoad?.();
  clearLoadHandles();
};

const settleLoadError = (message: string) => {
  error.value = message;
  rejectLoad?.(new Error(message));
  clearLoadHandles();
};

function clearLoadHandles() {
  resolveLoad = null;
  rejectLoad = null;
}

const isLoadInFlight = () => status.value === 'loading';

const isModelReady = () =>
  status.value === 'loaded' || status.value === 'done';

const handleWorkerStatus = (workerStatus: WorkerStatus, workerProgress?: number) => {
  if (workerStatus === 'unloaded') status.value = 'idle';
  else status.value = workerStatus;
  if (workerProgress !== undefined) progress.value = workerProgress;
  if (workerStatus === 'loaded' || workerStatus === 'done') settleLoadSuccess();
};

const handleWorkerResult = (workerResult: File) => {
  result.value = [workerResult];
};

const handleWorkerError = (message: string) => {
  status.value = 'error';
  if (loadPromise) settleLoadError(message);
  else error.value = message;
};

export const useImageTransformer = () => {
  const initWorker = () => {
    if (worker.value) return;
    worker.value = new ImageBackgroundTransformer();

    worker.value.onmessage = (event) => {
      const {
        type,
        status: workerStatus,
        progress: workerProgress,
        error: workerError,
        result: workerResult,
      } = event.data;

      if (type === 'status') handleWorkerStatus(workerStatus, workerProgress);
      else if (type === 'result') handleWorkerResult(workerResult);
      else handleWorkerError(workerError);
    };
  };

  const start = (): Promise<void> => {
    initWorker();
    if (isModelReady() || isLoadInFlight()) return loadPromise ?? Promise.resolve();
    error.value = null;
    status.value = 'loading';
    loadPromise = new Promise<void>((resolve, reject) => {
      resolveLoad = resolve;
      rejectLoad = reject;
    });
    worker.value?.postMessage({
      type: 'loadModel',
      payload: { model: selectedModel.value },
    });
    return loadPromise;
  };
  const startWithModel = (): Promise<void> => {
    initWorker();
    worker.value?.postMessage({ type: 'unloadModel' });
    status.value = 'idle';
    loadPromise = null;
    return start();
  };

  const run = async (image: File): Promise<void> => {
    initWorker();
    if (status.value === 'processing') {
      error.value = BG_BUSY_CODE;
      return;
    }
    error.value = null;
    try {
      await start();
      worker.value?.postMessage({
        type: 'run',
        payload: {
          image,
          model: selectedModel.value,
        },
      });
    } catch (err) {
      error.value = (err as Error).message;
      status.value = 'error';
    }
  };

  const handleChangeModel = (model: string) => {
    selectedModel.value = model;
    startWithModel();
  };

  return {
    start,
    run,
    status,
    progress,
    error,
    result,
    isLoaded: computed(
      () => status.value === 'loaded' || status.value === 'done',
    ),
    isRunning: computed(() => status.value === 'processing'),
    isLoading: computed(() => status.value === 'loading'),
    isBusy: computed(() => status.value === 'loading' || status.value === 'processing'),
    selectedModel,
    changeModel: handleChangeModel,
  };
};

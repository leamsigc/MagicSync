import { pipeline, env, AutomaticSpeechRecognitionPipeline, WhisperTextStreamer } from '@huggingface/transformers';

// Disable local models
env.allowLocalModels = false;

export const MODEL_CONFIGS = [
  { id: 'onnx-community/whisper-tiny', name: 'Whisper Tiny', lang: 'en', isMultilingual: true, size: 'small' },
  { id: 'onnx-community/whisper-tiny.en', name: 'Whisper Tiny (English)', lang: null, isMultilingual: false, size: 'small' },
  { id: 'onnx-community/whisper-base', name: 'Whisper Base', lang: 'en', isMultilingual: true, size: 'small' },
  { id: 'onnx-community/whisper-base.en', name: 'Whisper Base (English)', lang: null, isMultilingual: false, size: 'small' },
  { id: 'onnx-community/whisper-small', name: 'Whisper Small', lang: 'en', isMultilingual: true, size: 'small' },
  { id: 'onnx-community/whisper-small.en', name: 'Whisper Small (English)', lang: null, isMultilingual: false, size: 'small' },
  { id: 'onnx-community/whisper-medium', name: 'Whisper Medium', lang: 'en', isMultilingual: true, size: 'large' },
  { id: 'onnx-community/whisper-medium.en', name: 'Whisper Medium (English)', lang: null, isMultilingual: false, size: 'large' },
  { id: 'onnx-community/whisper-large', name: 'Whisper Large', lang: 'en', isMultilingual: true, size: 'large' },
  { id: 'onnx-community/whisper-large-v2', name: 'Whisper Large v2', lang: 'en', isMultilingual: true, size: 'large' },
  { id: 'onnx-community/whisper-large-v3', name: 'Whisper Large v3', lang: 'en', isMultilingual: true, size: 'large' },
  { id: 'distil-whisper/distil-medium.en', name: 'Distil Whisper Medium (English)', lang: null, isMultilingual: false, size: 'large' },
  { id: 'distil-whisper/distil-large-v2', name: 'Distil Whisper Large v2', lang: null, isMultilingual: false, size: 'large' },
  { id: 'onnx-community/whisper-base_timestamped', name: 'Whisper Base (Timestamped)', lang: null, isMultilingual: true, size: 'small' },
];

class TranscriptionPipeline {
  private static instance: TranscriptionPipeline;
  private transcriber: AutomaticSpeechRecognitionPipeline | null = null;
  private currentModel: string = '';
  private hasWebGPU: boolean | null = null;

  private constructor() { }

  public static getInstance(): TranscriptionPipeline {
    if (!TranscriptionPipeline.instance) {
      TranscriptionPipeline.instance = new TranscriptionPipeline();
    }
    return TranscriptionPipeline.instance;
  }

  public async checkWebGPU() {
    if (this.hasWebGPU !== null) return this.hasWebGPU;
    try {
      if ('gpu' in navigator) {
        const adapter = await (navigator as any).gpu.requestAdapter();
        this.hasWebGPU = !!adapter;
      } else {
        this.hasWebGPU = false;
      }
    } catch (e) {
      this.hasWebGPU = false;
    }
    return this.hasWebGPU;
  }

  public async getAvailableModels() {
    const webgpuSupported = await this.checkWebGPU();

    return MODEL_CONFIGS.filter(model => {
      // If WebGPU is not supported, only return small models to prevent browser crashing/freezing
      if (!webgpuSupported && model.size === 'large') {
        return false;
      }
      return true;
    }).map(m => ({ id: m.id, name: m.name, isMultilingual: m.isMultilingual }));
  }

  public async loadModel(modelId: string) {
    if (this.currentModel === modelId && this.transcriber) {
      return this.transcriber;
    }

    const webgpuSupported = await this.checkWebGPU();

    // Load new model
    this.transcriber = await (pipeline as any)('automatic-speech-recognition', modelId, {
      device: webgpuSupported ? 'webgpu' : 'wasm',
      dtype: webgpuSupported ? 'fp32' : 'q8',
      progress_callback: (progress: any) => {
        self.postMessage({ type: 'progress', progress: progress.progress, status: progress.status });
      },
    });
    this.currentModel = modelId;

    return this.transcriber;
  }

  public async transcribe(audio: Float32Array, language: string, id: string) {
    if (!this.transcriber) {
      throw new Error('Transcriber not initialized. Call loadModel first.');
    }

    const modelConfig = MODEL_CONFIGS.find(m => m.id === this.currentModel);
    const isMultilingual = modelConfig ? modelConfig.isMultilingual : true;

    const segments: any[] = [];
    let partialText = '';
    let currentChunkStart = 0;

    const tokenizer = (this.transcriber as any).tokenizer || (this.transcriber as any).processor?.tokenizer;

    const streamer = new WhisperTextStreamer(tokenizer, {
      time_precision: 0.02,
      on_chunk_start: (time: number) => {
        currentChunkStart = time;
      },
      on_chunk_end: (time: number) => {
        segments.push({
          id: segments.length,
          start: currentChunkStart,
          end: time,
          text: partialText.trim(),
        });
        partialText = '';
        self.postMessage({ type: 'chunk', id, segments });
      },
      callback_function: (text: string) => {
        partialText += text;
        self.postMessage({ type: 'partial', id, text: partialText });
      }
    });

    const result = await this.transcriber(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: isMultilingual ? (language === 'auto' ? null : language) : 'english',
      task: 'transcribe',
      return_timestamps: true,
      streamer: streamer,
    } as any) as any;

    return result.chunks.map((chunk: any, index: number) => ({
      id: index,
      start: chunk.timestamp[0],
      end: chunk.timestamp[1] || chunk.timestamp[0] + 5,
      text: chunk.text,
    }));
  }
}

const pipelineInstance = TranscriptionPipeline.getInstance();

let isProcessing = false;
const messageQueue: MessageEvent[] = [];

const processNextMessage = async () => {
  if (isProcessing || messageQueue.length === 0) return;

  isProcessing = true;
  const e = messageQueue.shift()!;

  const { type, audio, model, language } = e.data;

  try {
    switch (type) {
      case 'get_models':
        const models = await pipelineInstance.getAvailableModels();
        self.postMessage({ type: 'models_list', models });
        break;

      case 'init':
      case 'change_model':
      case 'loadModel':
        await pipelineInstance.loadModel(model || 'onnx-community/whisper-tiny');
        self.postMessage({ type: 'ready' });
        break;

      case 'transcribe':
        const finalSegments = await pipelineInstance.transcribe(audio, language, e.data.id);
        self.postMessage({ type: 'complete', id: e.data.id, segments: finalSegments });
        break;

      default:
        console.warn(`Unknown message type: ${type}`);
    }
  } catch (err: any) {
    self.postMessage({ type: 'error', id: e.data.id, error: err.message });
  } finally {
    isProcessing = false;
    processNextMessage();
  }
};

self.onmessage = (e: MessageEvent) => {
  messageQueue.push(e);
  processNextMessage();
};

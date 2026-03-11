/**
 * Whisper Transcription Worker
 * Handles audio transcription using Transformers.js with streaming results
 *
 * Key features:
 * - Model caching with singleton pattern
 * - Streaming partial results via callbacks
 * - Proper chunk handling with timestamps
 * - Support for multiple model configurations
 */

import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

type DynamicAny = any

env.allowLocalModels = false
env.useBrowserCache = true
;(env as DynamicAny).logLevel = 'error'

const PER_DEVICE_CONFIG = {
  webgpu: {
    dtype: {
      encoder_model: 'fp32',
      decoder_model_merged: 'q4',
    },
    device: 'webgpu',
  },
  wasm: {
    dtype: 'q8',
    device: 'wasm',
  },
}

const MODEL_CONFIGS = {
  tiny: { name: 'Xenova/whisper-tiny', lang: 'en', isMultilingual: true },
  tinyEn: { name: 'Xenova/whisper-tiny.en', lang: null, isMultilingual: false },
  base: { name: 'Xenova/whisper-base', lang: 'en', isMultilingual: true },
  baseEn: { name: 'Xenova/whisper-base.en', lang: null, isMultilingual: false },
  small: { name: 'Xenova/whisper-small', lang: 'en', isMultilingual: true },
  smallEn: { name: 'Xenova/whisper-small.en', lang: null, isMultilingual: false },
  medium: { name: 'Xenova/whisper-medium', lang: 'en', isMultilingual: true },
  mediumEn: { name: 'Xenova/whisper-medium.en', lang: null, isMultilingual: false },
  large: { name: 'Xenova/whisper-large', lang: 'en', isMultilingual: true },
  largeV2: { name: 'Xenova/whisper-large-v2', lang: 'en', isMultilingual: true },
  largeV3: { name: 'Xenova/whisper-large-v3', lang: 'en', isMultilingual: true },
  distilMediumEn: { name: 'distil-whisper/distil-medium.en', lang: null, isMultilingual: false },
  distilLargeV2: { name: 'distil-whisper/distil-large-v2', lang: null, isMultilingual: false },
  timestamped: { name: 'onnx-community/whisper-base_timestamped', lang: null, isMultilingual: true },
}

class PipelineSingleton {
  static instance: AutomaticSpeechRecognitionPipeline | null = null
  static currentModelId: string = 'tiny'
  static currentModelConfig: { isMultilingual: boolean } | null = null

  static async getInstance(
    modelId: string,
    progressCallback: ((progress: DynamicAny) => void) | null = null,
    device: 'webgpu' | 'wasm' = 'wasm',
    modelKey: string = 'tiny'
  ): Promise<AutomaticSpeechRecognitionPipeline> {
    const modelConfig = MODEL_CONFIGS[modelKey as keyof typeof MODEL_CONFIGS] || MODEL_CONFIGS.tiny
    this.currentModelConfig = { isMultilingual: modelConfig.isMultilingual }

    if (!this.instance || this.currentModelId !== modelId) {
      this.currentModelId = modelId
      this.instance = null

      const progressCallbackFn = progressCallback
        ? (p: DynamicAny) => {
            const value = Math.min((p?.progress ?? 0) * 100, 100)
            progressCallback({ progress: Math.round(value) })
          }
        : undefined

      const deviceConfig = PER_DEVICE_CONFIG[device as keyof typeof PER_DEVICE_CONFIG]
      const options: DynamicAny = {
        ...deviceConfig,
        progress_callback: progressCallbackFn,
      }

      this.instance = await pipeline('automatic-speech-recognition', modelId, options) as unknown as AutomaticSpeechRecognitionPipeline
    }

    return this.instance
  }

  static async warmup(device: 'webgpu' | 'wasm', language: string | null): Promise<void> {
    if (!this.instance || device !== 'wasm') return

    const warmupLanguage = language || 'en'
    // await this.instance(new Float32Array(1000), { language: warmupLanguage })
  }

  static reset(): void {
    this.instance = null
    this.currentModelId = ''
    this.currentModelConfig = null
  }
}

function sendStatus(status: string, progress = 0, message = ''): void {
  self.postMessage({ type: 'status', status, progress, message })
}

function sendResult(result: DynamicAny): void {
  self.postMessage({ type: 'result', result })
}

function sendError(error: string): void {
  self.postMessage({ type: 'error', error })
}

async function loadModel(data: { model?: string; device?: string }): Promise<void> {
  const device = (data.device as 'webgpu' | 'wasm') || 'wasm'
  const modelKey = data.model || 'tiny'
  const modelConfig = MODEL_CONFIGS[modelKey as keyof typeof MODEL_CONFIGS] || MODEL_CONFIGS.timestamped
  const modelId = modelConfig.name

  sendStatus('loading', 0, `Loading model (${device})...`)

  try {
    const transcriber = await PipelineSingleton.getInstance(
      modelId,
      (progress) => {
        console.log(progress)

        sendStatus('loading', progress.progress, `Loading model: ${progress.progress}%`)
      },
      device,
      modelKey
    )

    sendStatus('loading', 90, 'Warming up model...')
    await PipelineSingleton.warmup(device, modelConfig.lang)

    sendStatus('loaded', 100, 'Model ready')
  } catch (error: DynamicAny) {
    console.error('Failed to load model:', error)
    sendError(error.message || 'Failed to load model')
  }
}

async function runTranscription(data: { audio: number[]; language?: string | null; subtask?: string }): Promise<void> {
  const audioData = new Float32Array(data.audio || [])
  const language = data.language
  const subtask = data.subtask || 'transcribe'

  sendStatus('transcribing', 0)

  try {
    const transcriber = await PipelineSingleton.getInstance(
      PipelineSingleton.currentModelId,
      null,
      'wasm',
      'timestamped'
    )

    const isMultilingual = PipelineSingleton.currentModelConfig?.isMultilingual ?? true

    const options: DynamicAny = {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    }

    if (isMultilingual && language) {
      options.language = language
      options.task = subtask
    }

    const result = await transcriber(audioData, options)

    if (result) {
      const processedResult = processResult(result)
      sendStatus('done', 100)
      sendResult(processedResult)
    }
  } catch (error: DynamicAny) {
    console.error('Transcription error:', error)
    sendError(error.message || 'Transcription failed')
  }
}

function processResult(result: DynamicAny) {
  const text = result.text || ''
  const chunks = []

  if (result.chunks) {
    for (const chunk of result.chunks) {
      if (chunk.timestamp && chunk.text?.trim()) {
        const start = Array.isArray(chunk.timestamp) ? chunk.timestamp[0] : chunk.timestamp
        const end = Array.isArray(chunk.timestamp) ? chunk.timestamp[1] : chunk.timestamp
        chunks.push({ text: chunk.text.trim(), start, end })
      }
    }
  }

  return { text: text.trim(), chunks }
}

async function unloadModel(): Promise<void> {
  PipelineSingleton.reset()
  sendStatus('unloaded', 100)
}

self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data

  switch (type) {
    case 'loadModel':
      await loadModel(payload)
      break

    case 'transcribe':
      await runTranscription(payload)
      break

    case 'unloadModel':
      await unloadModel()
      break

    default:
      sendError(`Unknown message type: ${type}`)
  }
}

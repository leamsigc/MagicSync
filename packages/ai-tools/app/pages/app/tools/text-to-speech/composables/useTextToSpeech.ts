/**
 * useTextToSpeech Composable
 *
 * Supertonic-3 ONNX TTS with dual-mode support:
 *   - Web worker (default): offloads inference — non-blocking UI
 *   - Main thread (opt-in): direct call — simpler, no worker overhead
 *
 * @author MagicSync Team
 * @version 0.3.0
 */
import TtsWorker from '@/assets/workers/ttsWorker?worker'
import {
  AVAILABLE_LANGUAGES as ENGINE_LANGS,
  AVAILABLE_VOICES as ENGINE_VOICES,
  loadAllModels as engineLoadModels,
  synthesize as engineSynthesize,
  setEngineVoice,
  isModelLoaded as engineIsLoaded,
  type EngineProgressEvent,
} from './ttsEngine'

// ── Types ──────────────────────────────────────────────────────────
export type TTSStatus = 'idle' | 'loading' | 'ready' | 'synthesizing' | 'done' | 'error'

export interface VoiceOption {
  id: string; name: string; gender: 'male' | 'female'
}
export interface LanguageOption {
  code: string; name: string
}

export interface SynthesisResult {
  text: string
  voiceId: string
  language: string
  speed: number
  quality: number
  audio: Float32Array
  sampleRate: number
  wavBuffer: ArrayBuffer
  duration: number
  detectedLanguage: string | null
}

// ── Re-export constants ───────────────────────────────────────────
export const AVAILABLE_VOICES: VoiceOption[] = [...ENGINE_VOICES]
export const AVAILABLE_LANGUAGES: LanguageOption[] = (ENGINE_LANGS as readonly string[]).map((code) => ({
  code,
  name: {
    en: 'English', ko: 'Korean', ja: 'Japanese', ar: 'Arabic', bg: 'Bulgarian', cs: 'Czech',
    da: 'Danish', de: 'German', el: 'Greek', es: 'Spanish', et: 'Estonian', fi: 'Finnish',
    fr: 'French', hi: 'Hindi', hr: 'Croatian', hu: 'Hungarian', id: 'Indonesian',
    it: 'Italian', lt: 'Lithuanian', lv: 'Latvian', nl: 'Dutch', pl: 'Polish',
    pt: 'Portuguese', ro: 'Romanian', ru: 'Russian', sk: 'Slovak', sl: 'Slovenian',
    sv: 'Swedish', tr: 'Turkish', uk: 'Ukrainian', vi: 'Vietnamese',
  }[code] || code.toUpperCase(),
}))

// ── Module-level Singleton State ──────────────────────────────────
const useWorker = ref(true) // default: web worker (non-blocking UI)
const worker = ref<Worker | null>(null)
const status = ref<TTSStatus>('idle')
const loadingProgress = ref(0)
const loadingText = ref('')
const currentVoiceId = ref<string>('M1')
const currentLanguage = ref<string>('en')
const currentSpeed = ref(1.0)
const currentQuality = ref(8)
const synthesisProgress = ref(0)
const resultAudio = ref<Float32Array | null>(null)
const resultSampleRate = ref(44100)
const resultWavBuffer = ref<ArrayBuffer | null>(null)
const resultDuration = ref(0)
const detectedLanguage = ref<string | null>(null)
const errorMessage = ref('')
const loadedVoiceIds = ref<string[]>([])
const failedVoiceIds = ref<string[]>([])

// Tracks in-flight synthesis so synthesize() can await completion/error/cancel.
let pendingSynthResolve: ((result: SynthesisResult | null) => void) | null = null
let pendingSynthReject: ((err: Error) => void) | null = null
let pendingSynthId: string | null = null

// Main-thread abort controller (mirrors the worker's internal one)
let mainAbortController: AbortController | null = null

// ── Computed ──────────────────────────────────────────────────────
const isReady = computed(() => status.value === 'ready')
const isSynthesizing = computed(() => status.value === 'synthesizing')
const isLoadingModel = computed(() => status.value === 'loading')
const hasResult = computed(() => status.value === 'done' && resultWavBuffer.value !== null)
const canDownload = computed(() => hasResult.value)

const availableVoices = computed(() => {
  if (failedVoiceIds.value.length === 0) return AVAILABLE_VOICES
  return AVAILABLE_VOICES.filter((v) => !failedVoiceIds.value.includes(v.id))
})

const progressPercent = computed(() => {
  if (status.value === 'loading') return loadingProgress.value
  if (status.value === 'synthesizing') return synthesisProgress.value
  return 0
})

// ── Worker Management ─────────────────────────────────────────────
function initWorker() {
  if (worker.value) return
  worker.value = new TtsWorker()

  worker.value.onmessage = (e: MessageEvent) => {
    const data = e.data || {}
    const { type, progress, status: msgStatus, text, error, audio, sampleRate, wavBuffer, duration, detectedLanguage: detLang, voiceId, id: msgId } = data as Record<string, unknown>

    if (type === 'ready' || type === 'complete' || type === 'error' || type === 'cancelled') {
      console.log('[useTTS] Worker message:', type, msgId || '')
    }

    switch (type) {
      case 'status':
        if (msgStatus === 'loading') {
          status.value = 'loading'
          if (progress !== undefined) loadingProgress.value = progress as number
          if (text) loadingText.value = text as string
        }
        break
      case 'ready':
        status.value = 'ready'
        loadingProgress.value = 100
        if (Array.isArray(data.loadedVoices)) loadedVoiceIds.value = data.loadedVoices as string[]
        if (Array.isArray(data.failedVoices)) failedVoiceIds.value = data.failedVoices as string[]
        break
      case 'progress':
        if (msgStatus === 'synthesizing') {
          status.value = 'synthesizing'
          synthesisProgress.value = progress as number
        }
        break
      case 'complete': {
        status.value = 'done'
        synthesisProgress.value = 100
        resultAudio.value = audio as Float32Array
        resultSampleRate.value = (sampleRate as number) || 44100
        resultWavBuffer.value = wavBuffer as ArrayBuffer
        resultDuration.value = duration as number
        detectedLanguage.value = (detLang as string) || null
        if (voiceId) currentVoiceId.value = voiceId as string
        // Resolve the awaiting synthesize() Promise with the engine-side
        // output. synthesize() enriches this with the text/voiceId/language/
        // speed/quality captured from caller-scoped refs.
        if (pendingSynthResolve) {
          const r = pendingSynthResolve
          pendingSynthResolve = pendingSynthReject = null
          pendingSynthId = null
          r({
            text: '', // enriched in synthesize()
            voiceId: '', // enriched in synthesize()
            language: '',
            speed: 0,
            quality: 0,
            audio: audio as Float32Array,
            sampleRate: (sampleRate as number) || 44100,
            wavBuffer: wavBuffer as ArrayBuffer,
            duration: duration as number,
            detectedLanguage: (detLang as string) || null,
          })
        }
        break
      }
      case 'cancelled':
        // User cancelled — restore ready state, resolve with null (not an error)
        status.value = 'ready'
        synthesisProgress.value = 0
        errorMessage.value = ''
        if (pendingSynthResolve) {
          const r = pendingSynthResolve
          pendingSynthResolve = pendingSynthReject = null
          pendingSynthId = null
          r(null)
        }
        break
      case 'error':
        console.error('[useTTS] Worker ERROR:', (error as string)?.substring(0, 200))
        status.value = 'error'
        errorMessage.value = (error as string) || 'Unknown error'
        if (pendingSynthReject) {
          const r = pendingSynthReject
          pendingSynthResolve = pendingSynthReject = null
          pendingSynthId = null
          r(new Error(errorMessage.value))
        }
        break
    }
  }

  worker.value.onerror = (err) => {
    status.value = 'error'
    errorMessage.value = 'Worker error: ' + (err.message || 'Unknown')
    if (pendingSynthReject) {
      const r = pendingSynthReject
      pendingSynthResolve = pendingSynthReject = null
      pendingSynthId = null
      r(new Error(errorMessage.value))
    }
  }
}

// ── Main-Thread Progress Handler ──────────────────────────────────
function handleEngineProgress(e: EngineProgressEvent) {
  switch (e.type) {
    case 'status':
      if (e.status === 'loading') {
        status.value = 'loading'
        if (e.progress !== undefined) loadingProgress.value = e.progress
        if (e.text) loadingText.value = e.text
      }
      break
    case 'ready':
      status.value = 'ready'
      loadingProgress.value = 100
      if (e.loadedVoices) loadedVoiceIds.value = e.loadedVoices
      if (e.failedVoices) failedVoiceIds.value = e.failedVoices
      break
    case 'progress':
      status.value = 'synthesizing'
      if (e.progress !== undefined) synthesisProgress.value = e.progress
      break
    case 'error':
      status.value = 'error'
      errorMessage.value = e.error || 'Unknown error'
      break
  }
}

// ── Model Loading ─────────────────────────────────────────────────
function loadModel() {
  status.value = 'loading'
  loadingProgress.value = 0
  errorMessage.value = ''

  if (useWorker.value) {
    initWorker()
    worker.value?.postMessage({ type: 'load' })
  }
  else {
    engineLoadModels(handleEngineProgress).catch((err: Error) => {
      status.value = 'error'
      errorMessage.value = err?.message || 'Failed to load models'
    })
  }
}

// ── Synthesis ─────────────────────────────────────────────────────
let synthesisId = 0

async function synthesize(text: string): Promise<SynthesisResult | null> {
  console.log('[useTTS] synthesize() — mode:', useWorker.value ? 'worker' : 'main', 'textLen:', text?.length)
  if (!text.trim()) return null

  // Snapshot the inputs the caller used so we can return them in the result
  const reqVoiceId = currentVoiceId.value
  const reqLanguage = currentLanguage.value
  const reqSpeed = currentSpeed.value
  const reqQuality = currentQuality.value

  if (useWorker.value) {
    initWorker()
    if (!worker.value) throw new Error('Worker failed to initialize')

    // Only wait when actually loading. After a successful synthesis status
    // flips to 'done' (or 'error' on failure) — those still mean the model is
    // loaded, so a subsequent synthesize() should proceed immediately. The
    // worker doesn't re-emit 'ready' when loadAllModels is idempotent, which
    // caused a 120s timeout on regenerate after the first synthesis.
    if (isLoadingModel.value || status.value === 'idle') {
      await new Promise<void>((resolve, reject) => {
        loadModel()
        let settled = false
        const timeout = setTimeout(() => {
          if (settled) return
          settled = true
          clearInterval(check)
          reject(new Error('Model load timed out after 120s'))
        }, 120000)
        const check = setInterval(() => {
          if (settled) return
          if (status.value === 'ready') {
            settled = true
            clearInterval(check); clearTimeout(timeout)
            resolve()
          }
          else if (status.value === 'error') {
            settled = true
            clearInterval(check); clearTimeout(timeout)
            reject(new Error(errorMessage.value || 'Model load failed'))
          }
        }, 200)
      })
    }

    status.value = 'synthesizing'
    synthesisProgress.value = 0
    errorMessage.value = ''

    const result = await new Promise<SynthesisResult | null>((resolve, reject) => {
      pendingSynthResolve = resolve
      pendingSynthReject = reject
      const synthId = `synth-${++synthesisId}`
      pendingSynthId = synthId
      worker.value!.postMessage({
        type: 'synthesize',
        id: synthId,
        text,
        voiceId: reqVoiceId,
        speed: reqSpeed,
        quality: reqQuality,
        language: reqLanguage,
      })
    })

    // null = cancelled. Empty state already cleaned up by onmessage handler.
    if (!result) return null
    return {
      ...result,
      text,
      voiceId: reqVoiceId,
      language: reqLanguage,
      speed: reqSpeed,
      quality: reqQuality,
    }
  }

  // Main thread
  if (!engineIsLoaded()) {
    console.log('[useTTS] Engine not loaded, loading now...')
    await engineLoadModels(handleEngineProgress)
  }

  status.value = 'synthesizing'
  synthesisProgress.value = 0
  errorMessage.value = ''

  mainAbortController = new AbortController()
  const signal = mainAbortController.signal

  try {
    const r = await engineSynthesize(text, {
      voiceId: reqVoiceId,
      speed: reqSpeed,
      quality: reqQuality,
      language: reqLanguage,
    }, handleEngineProgress, signal)

    status.value = 'done'
    synthesisProgress.value = 100
    resultAudio.value = r.audio
    resultSampleRate.value = r.sampleRate
    resultWavBuffer.value = r.wavBuffer
    resultDuration.value = r.duration
    detectedLanguage.value = r.detectedLanguage

    return {
      text,
      voiceId: reqVoiceId,
      language: reqLanguage,
      speed: reqSpeed,
      quality: reqQuality,
      audio: r.audio,
      sampleRate: r.sampleRate,
      wavBuffer: r.wavBuffer,
      duration: r.duration,
      detectedLanguage: r.detectedLanguage,
    }
  }
  catch (err: any) {
    if (err?.name === 'AbortError' || signal.aborted) {
      status.value = 'ready'
      synthesisProgress.value = 0
      return null
    }
    status.value = 'error'
    errorMessage.value = err?.message || 'Synthesis failed'
    throw err
  }
  finally {
    mainAbortController = null
  }
}

// ── Cancel ────────────────────────────────────────────────────────
function cancel(): boolean {
  // Worker mode: post cancel message
  if (useWorker.value && worker.value) {
    worker.value.postMessage({ type: 'cancel', id: pendingSynthId || undefined })
    return true
  }
  // Main thread: abort the in-flight controller
  if (mainAbortController) {
    mainAbortController.abort()
    return true
  }
  return false
}

// ── Audio Playback ────────────────────────────────────────────────
let audioContext: AudioContext | null = null
let currentSource: AudioBufferSourceNode | null = null

function stopPlayback() {
  if (currentSource) { try { currentSource.stop() } catch { /* already stopped */ } currentSource = null }
}

async function playAudio(audio?: Float32Array, sampleRate?: number) {
  const data = audio || resultAudio.value
  const rate = sampleRate || resultSampleRate.value
  if (!data) return
  stopPlayback()
  if (!audioContext) audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  const buffer = audioContext.createBuffer(1, data.length, rate)
  buffer.getChannelData(0).set(data)
  const src = audioContext.createBufferSource()
  src.buffer = buffer
  src.connect(audioContext.destination)
  src.onended = () => {
    if (currentSource === src) currentSource = null
  }
  currentSource = src
  src.start(0)
}

function isAudioPlaying(): boolean {
  return currentSource !== null
}

// ── Download ──────────────────────────────────────────────────────
function downloadAudio(filename: string, wavBuffer: ArrayBuffer | null = null) {
  const buf = wavBuffer || resultWavBuffer.value
  if (!buf) return
  const blob = new Blob([buf], { type: 'audio/wav' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Reset / Cleanup ───────────────────────────────────────────────
function resetResult() {
  status.value = 'ready'
  resultAudio.value = null; resultWavBuffer.value = null
  resultDuration.value = 0; synthesisProgress.value = 0
  errorMessage.value = ''; detectedLanguage.value = null
}

function cleanup() {
  stopPlayback()
  cancel()
  if (worker.value) { worker.value.terminate(); worker.value = null }
  if (audioContext) { audioContext.close(); audioContext = null }
  pendingSynthResolve = pendingSynthReject = null
  pendingSynthId = null
  status.value = 'idle'
  resultAudio.value = null; resultWavBuffer.value = null
  resultDuration.value = 0; synthesisProgress.value = 0
}

// ── Setters ───────────────────────────────────────────────────────
function setVoice(id: string) {
  currentVoiceId.value = id
  if (useWorker.value) {
    worker.value?.postMessage({ type: 'setVoice', voiceId: id })
  }
  else {
    setEngineVoice(id)
  }
}

function setLanguage(code: string) { currentLanguage.value = code }
function setSpeed(speed: number) { currentSpeed.value = Math.max(0.8, Math.min(1.3, speed)) }
function setQuality(quality: number) { currentQuality.value = Math.max(2, Math.min(16, Math.round(quality))) }

// ── Toggle Mode ───────────────────────────────────────────────────
function toggleWorker() {
  useWorker.value = !useWorker.value
  cleanup()
  status.value = 'idle'
  errorMessage.value = ''
  loadModel()
}

// ── Lifecycle ─────────────────────────────────────────────────────
onUnmounted(() => { cleanup() })

// ── Public API ────────────────────────────────────────────────────
export function useTextToSpeech() {
  return {
    // Mode
    useWorker,
    toggleWorker,

    // State
    status, isReady, isSynthesizing, isLoadingModel, hasResult, canDownload,
    progressPercent, loadingProgress, loadingText, synthesisProgress,
    resultAudio, resultSampleRate, resultWavBuffer, resultDuration,
    detectedLanguage, errorMessage,
    currentVoiceId, currentLanguage, currentSpeed, currentQuality,

    // Options
    AVAILABLE_VOICES, availableVoices, AVAILABLE_LANGUAGES,
    loadedVoiceIds, failedVoiceIds,

    // Actions
    loadModel, synthesize, cancel, playAudio, stopPlayback, isAudioPlaying, downloadAudio,
    resetResult, setVoice, setLanguage, setSpeed, setQuality, cleanup,
  }
}

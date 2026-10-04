import type {
  CropLayer, VideoMetadata, ExportSettings, ExportProgress,
  CustomAudioTrack, SubtitleCue, SubtitleStyle,
} from '../../../../utils/ai-tools/tools/video-cropper/types'
import {
  BlobSource, Input, Output, BufferTarget, Mp4OutputFormat,
  ALL_FORMATS, VideoSample, Conversion,
  getFirstEncodableVideoCodec, getFirstEncodableAudioCodec,
} from 'mediabunny'
import { computeTrimEnd, getActiveCue, drawCue } from './subtitles'
import { mixAudio, type MixedPcm } from './audioMix'
import { muxVideoWithAudio } from './muxExport'

// ── Module-level singleton state ──────────────────────────────────

let worker: Worker | null = null
let activeConversion: any = null
let activeId = 0
let muxCancelled = false

const exportProgress = ref<ExportProgress>({
  status: 'idle',
  statusText: '',
  processedFrames: 0,
  totalFrames: 0,
  percentage: 0,
  elapsedTime: 0,
  estimatedTimeRemaining: 0,
})
const isExporting = computed(() => exportProgress.value.status === 'processing')

function interpolateCropBox(
  time: number,
  keyframes: { time: number; x: number; y: number; width: number; height: number }[],
  mode: 'linear' | 'ease' | 'step',
) {
  if (keyframes.length === 0) return { x: 0, y: 0, width: 1, height: 1 }
  const sorted = [...keyframes].sort((a, b) => a.time - b.time)
  if (sorted.length === 1) return { x: sorted[0].x, y: sorted[0].y, width: sorted[0].width, height: sorted[0].height }
  if (time <= sorted[0].time) return { x: sorted[0].x, y: sorted[0].y, width: sorted[0].width, height: sorted[0].height }
  if (time >= sorted[sorted.length - 1].time) { const last = sorted[sorted.length - 1]; return { x: last.x, y: last.y, width: last.width, height: last.height } }
  let prev = sorted[0]; let next = sorted[1]
  for (let i = 0; i < sorted.length - 1; i++) {
    if (time >= sorted[i].time && time <= sorted[i + 1].time) { prev = sorted[i]; next = sorted[i + 1]; break }
  }
  const dur = next.time - prev.time
  const t = dur === 0 ? 0 : (time - prev.time) / dur
  let val = t
  if (mode === 'ease') val = t * t * (3 - 2 * t)
  else if (mode === 'step') val = t < 0.5 ? 0 : 1
  return { x: prev.x + (next.x - prev.x) * val, y: prev.y + (next.y - prev.y) * val, width: prev.width + (next.width - prev.width) * val, height: prev.height + (next.height - prev.height) * val }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`
}

interface DrawFrameContext {
  ctx: OffscreenCanvasRenderingContext2D
  exportWidth: number
  exportHeight: number
  timestamp: number
  videoW: number
  videoH: number
  layersData: CropLayer[]
  stackingDirection: 'vertical' | 'horizontal'
  currentFit: 'cover' | 'contain' | 'fill'
  interpolation: 'linear' | 'ease' | 'step'
}

/** Draws all crop layers + the active subtitle cue for one frame. */
function drawFrame({ ctx, exportWidth, exportHeight, timestamp, videoW, videoH, layersData, stackingDirection, currentFit, interpolation }: DrawFrameContext, sample: VideoSample, subtitleCues: SubtitleCue[], subtitleStyle: SubtitleStyle) {
  ctx.fillStyle = '#0a0a0b'
  ctx.fillRect(0, 0, exportWidth, exportHeight)
  layersData.forEach((layer, index) => {
    const crop = interpolateCropBox(timestamp, layer.keyframes, interpolation)
    const sx = crop.x * videoW; const sy = crop.y * videoH
    const sW = crop.width * videoW; const sH = crop.height * videoH
    if (sW <= 0 || sH <= 0) return
    let dx = 0; let dy = 0; let dW = exportWidth; let dH = exportHeight
    if (stackingDirection === 'vertical') { dH = exportHeight / layersData.length; dy = index * dH }
    else { dW = exportWidth / layersData.length; dx = index * dW }
    let fSx = sx; let fSy = sy; let fSW = sW; let fSH = sH
    let dX = dx; let dY = dy; let dW2 = dW; let dH2 = dH
    if (currentFit === 'cover') {
      const srcA = sW / sH; const dstA = dW / dH
      if (srcA > dstA) { fSW = sH * dstA; fSx = sx + (sW - fSW) / 2 }
      else if (srcA < dstA) { fSH = sW / dstA; fSy = sy + (sH - fSH) / 2 }
    } else if (currentFit === 'contain') {
      const srcA = sW / sH; const dstA = dW / dH
      if (srcA > dstA) { const aH = dW / srcA; dY += (dH - aH) / 2; dH2 = aH }
      else { const aW = dH * srcA; dX += (dW - aW) / 2; dW2 = aW }
    }
    sample.draw(ctx, fSx, fSy, fSW, fSH, dX, dY, dW2, dH2)
    if (index > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3.5; ctx.beginPath()
      if (stackingDirection === 'vertical') { ctx.moveTo(0, dy); ctx.lineTo(exportWidth, dy) }
      else { ctx.moveTo(dx, 0); ctx.lineTo(dx, exportHeight) }
      ctx.stroke()
    }
  })
  if (subtitleCues.length > 0 && subtitleStyle) {
    const cue = getActiveCue(subtitleCues, timestamp)
    if (cue) drawCue(ctx, exportWidth, exportHeight, cue, subtitleStyle)
  }
}

// ── Inline (main thread) pipeline ────────────────────────────────

async function runExportInline(
  inputBlob: Blob,
  videoMetadata: VideoMetadata,
  layers: CropLayer[],
  settings: ExportSettings,
  fitMode: 'cover' | 'contain' | 'fill',
  finalVideoAspectRatio: number | null,
  subtitleCues: SubtitleCue[],
  subtitleStyle: SubtitleStyle,
  audioMode: 'source' | 'discard',
  onProgress: (pct: number, processedTime: number) => void,
): Promise<Blob | null> {
  const ratio = finalVideoAspectRatio !== null ? finalVideoAspectRatio : videoMetadata.aspectRatio
  const maxDim = 1080
  let exportWidth = videoMetadata.width
  let exportHeight = videoMetadata.height

  if (finalVideoAspectRatio !== null) {
    if (ratio < videoMetadata.aspectRatio) { exportHeight = videoMetadata.height; exportWidth = exportHeight * ratio }
    else { exportWidth = videoMetadata.width; exportHeight = exportWidth / ratio }
  }

  if (exportWidth > maxDim || exportHeight > maxDim) {
    const scale = maxDim / Math.max(exportWidth, exportHeight)
    exportWidth = Math.round(exportWidth * scale)
    exportHeight = Math.round(exportHeight * scale)
  }

  exportWidth = Math.round(exportWidth / 2) * 2
  exportHeight = Math.round(exportHeight / 2) * 2

  const fps = settings.fps
  const interpolation = settings.interpolation
  const stackingDirection = settings.stackingDirection
  const currentFit = fitMode
  const trimEndTime = computeTrimEnd(layers, videoMetadata.duration)
  const trim = trimEndTime > 0 && trimEndTime < videoMetadata.duration ? { end: trimEndTime } : undefined

  const source = new BlobSource(inputBlob)
  const input = new Input({ source, formats: ALL_FORMATS })
  const target = new BufferTarget()
  const output = new Output({ target, format: new Mp4OutputFormat() })

  const layersData = JSON.parse(JSON.stringify(layers)) as CropLayer[]
  const videoW = videoMetadata.width
  const videoH = videoMetadata.height

  exportProgress.value = { ...exportProgress.value, statusText: 'Detecting supported video encoder...' }
  const containableCodecs = output.format.getSupportedVideoCodecs()
  // Probe at the real output size: mediabunny defaults to 1280x720, so probing
  // without dimensions can select a codec that then fails to configure at the
  // actual frame size and surfaces as "The given encoding is not supported".
  const supportedCodec = await getFirstEncodableVideoCodec(containableCodecs, {
    width: exportWidth,
    height: exportHeight,
    frameRate: fps,
  })
  if (!supportedCodec) throw new Error('No supported video encoder found')

  const containableAudioCodecs = output.format.getSupportedAudioCodecs()
  const supportedAudioCodec = await getFirstEncodableAudioCodec(containableAudioCodecs)

  const audioOptions = audioMode === 'source'
    ? supportedAudioCodec ? { codec: supportedAudioCodec, forceTranscode: true } : {}
    : { discard: true }

  const conversionOptions: any = {
    input, output,
    trim,
    video: {
      frameRate: fps,
      codec: supportedCodec,
      forceTranscode: true,
      process: async (sample: VideoSample) => {
        const canvas = new OffscreenCanvas(exportWidth, exportHeight)
        const ctx = canvas.getContext('2d')
        if (ctx) {
          drawFrame({ ctx, exportWidth, exportHeight, timestamp: sample.timestamp, videoW, videoH, layersData, stackingDirection, currentFit, interpolation }, sample, subtitleCues, subtitleStyle)
        }
        return canvas
      },
      processedWidth: exportWidth,
      processedHeight: exportHeight,
    },
    audio: audioOptions,
  }

  const conversion = await Conversion.init(conversionOptions)
  activeConversion = conversion

  conversion.onProgress = (progress: number, processedTime: number) => {
    const pct = Math.round(progress * 100)
    exportProgress.value = {
      ...exportProgress.value,
      statusText: `Rendering frame timeline (${processedTime.toFixed(1)}s)...`,
      percentage: pct,
      processedFrames: Math.round(processedTime * fps),
      totalFrames: Math.round(videoMetadata.duration * fps),
      elapsedTime: processedTime * 1000,
    }
    onProgress(pct, processedTime)
  }

  await conversion.execute()

  const finalBuffer = target.buffer
  if (!finalBuffer) throw new Error('Transcoder yielded an empty output buffer')

  return new Blob([finalBuffer], { type: 'video/mp4' })
}

// ── Worker pipeline ──────────────────────────────────────────────

async function runExportWorker(
  inputBlob: Blob,
  videoMetadata: VideoMetadata,
  layers: CropLayer[],
  settings: ExportSettings,
  fitMode: 'cover' | 'contain' | 'fill',
  finalVideoAspectRatio: number | null,
  subtitleCues: SubtitleCue[],
  subtitleStyle: SubtitleStyle,
  audioMode: 'source' | 'discard',
  awaitingMux: boolean,
  onProgress: (pct: number, processedTime: number) => void,
): Promise<{ blob: Blob; videoOnly: boolean } | null> {
  const id = ++activeId
  const payloadVideoData = await inputBlob.arrayBuffer()
  const payloadVideoFileType = inputBlob.type || 'video/mp4'

  return new Promise((resolve) => {
    worker = new Worker(new URL('./exportWorker.ts', import.meta.url), { type: 'module' })

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data
      if (msg.id !== id) return

      if (msg.type === 'progress') {
        const scaled = awaitingMux ? Math.round(msg.progress.percentage * 0.9) : msg.progress.percentage
        exportProgress.value = { ...exportProgress.value, ...msg.progress, percentage: scaled }
        onProgress(scaled, msg.progress.elapsedTime / 1000)
      } else if (msg.type === 'complete') {
        exportProgress.value = { ...exportProgress.value, status: 'completed', statusText: 'Completed successfully!', percentage: 100 }
        resolve({ blob: msg.blob, videoOnly: false })
        cleanupWorker()
      } else if (msg.type === 'pass1') {
        exportProgress.value = { ...exportProgress.value, statusText: 'Preparing final video...', percentage: 90 }
        resolve({ blob: msg.blob, videoOnly: true })
        cleanupWorker()
      } else if (msg.type === 'cancelled') {
        exportProgress.value = { ...exportProgress.value, status: 'idle', statusText: '' }
        resolve(null)
        cleanupWorker()
      } else if (msg.type === 'error') {
        exportProgress.value = { ...exportProgress.value, status: 'failed', statusText: msg.error, error: msg.error }
        resolve(null)
        cleanupWorker()
      }
    }

    worker.onerror = (err) => {
      exportProgress.value = { ...exportProgress.value, status: 'failed', statusText: err.message || 'Unknown worker error', error: err.message || 'Unknown worker error' }
      resolve(null)
      cleanupWorker()
    }

    const payload: any = {
      id,
      // ref() makes object values deeply reactive; reactive proxies can't be
      // structured-cloned, so serialize everything data-like to plain JSON.
      videoMetadata: JSON.parse(JSON.stringify(videoMetadata)),
      layers: JSON.parse(JSON.stringify(layers)),
      settings: { ...settings }, fitMode, finalVideoAspectRatio,
      subtitleCues: JSON.parse(JSON.stringify(subtitleCues)),
      subtitleStyle: JSON.parse(JSON.stringify(subtitleStyle)),
      audioMode,
      videoData: payloadVideoData,
      videoFileType: payloadVideoFileType,
    }

    worker.postMessage(payload, [payloadVideoData])
  })
}

// ── Final mux (audio) pass ───────────────────────────────────────

async function runMux(videoOnlyBlob: Blob, pcm: MixedPcm, fps: number): Promise<Blob | null> {
  muxCancelled = false
  exportProgress.value = { ...exportProgress.value, statusText: 'Muxing audio track...', percentage: 90 }
  try {
    const blob = await muxVideoWithAudio(videoOnlyBlob, pcm, fps, (pct, statusText) => {
      exportProgress.value = { ...exportProgress.value, statusText, percentage: 90 + Math.round(pct * 0.1) }
    }, () => muxCancelled)
    if (muxCancelled) {
      exportProgress.value = { status: 'idle', statusText: '', processedFrames: 0, totalFrames: 0, percentage: 0, elapsedTime: 0, estimatedTimeRemaining: 0 }
      return null
    }
    return blob
  } catch (err: any) {
    if (muxCancelled) {
      exportProgress.value = { status: 'idle', statusText: '', processedFrames: 0, totalFrames: 0, percentage: 0, elapsedTime: 0, estimatedTimeRemaining: 0 }
      return null
    }
    throw err
  }
}

// ── Public entry ─────────────────────────────────────────────────

async function runExport(
  videoFile: File | null,
  videoMetadata: VideoMetadata,
  layers: CropLayer[],
  settings: ExportSettings,
  fitMode: 'cover' | 'contain' | 'fill',
  finalVideoAspectRatio: number | null,
  subtitleCues: SubtitleCue[],
  subtitleStyle: SubtitleStyle,
  audioTracks: CustomAudioTrack[],
  onProgress: (pct: number, processedTime: number) => void,
): Promise<Blob | null> {
  exportProgress.value = { ...exportProgress.value, status: 'processing', statusText: 'Analyzing source tracks...', percentage: 0 }

  try {
    const exportDuration = computeTrimEnd(layers, videoMetadata.duration)
    const needsBgMix = settings.includeAudio && audioTracks.length > 0
    const audioMode: 'source' | 'discard' = (!settings.includeAudio || needsBgMix) ? 'discard' : 'source'

    let inputBlob: Blob
    if (videoFile) {
      inputBlob = videoFile
    } else {
      exportProgress.value = { ...exportProgress.value, statusText: 'Buffering video file...' }
      const res = await fetch(videoMetadata.url)
      inputBlob = await res.blob()
    }

    let pcm: MixedPcm | null = null
    if (needsBgMix) {
      exportProgress.value = { ...exportProgress.value, statusText: 'Mixing background audio...', percentage: 2 }
      pcm = await mixAudio(inputBlob, audioTracks, exportDuration)
    }

    let result: Blob | null
    if (settings.useWorker) {
      const workerResult = await runExportWorker(inputBlob, videoMetadata, layers, settings, fitMode, finalVideoAspectRatio, subtitleCues, subtitleStyle, audioMode, pcm !== null, onProgress)
      if (!workerResult) return null
      result = workerResult.blob
      if (workerResult.videoOnly && pcm) {
        result = await runMux(workerResult.blob, pcm, settings.fps)
      }
    } else {
      result = await runExportInline(inputBlob, videoMetadata, layers, settings, fitMode, finalVideoAspectRatio, subtitleCues, subtitleStyle, audioMode, onProgress)
      if (!result) return null
      if (audioMode === 'discard' && pcm) {
        result = await runMux(result, pcm, settings.fps)
      }
    }

    if (!result) return null
    exportProgress.value = { ...exportProgress.value, status: 'completed', statusText: 'Completed successfully!', percentage: 100 }
    return result
  } catch (err: any) {
    exportProgress.value = { ...exportProgress.value, status: 'failed', statusText: err.message || 'Export failed', error: err.message || 'Export failed' }
    return null
  }
}

function cancelExport() {
  muxCancelled = true
  if (activeConversion) {
    activeConversion.cancel()
    activeConversion = null
  }
  if (worker) {
    worker.terminate()
    worker = null
  }
  exportProgress.value = { status: 'idle', statusText: '', processedFrames: 0, totalFrames: 0, percentage: 0, elapsedTime: 0, estimatedTimeRemaining: 0 }
}

function cleanupWorker() {
  if (worker) {
    worker.terminate()
    worker = null
  }
}

export function useExport() {
  return {
    exportProgress,
    isExporting,
    runExport,
    cancelExport,
    interpolateCropBox,
    formatTime,
  }
}

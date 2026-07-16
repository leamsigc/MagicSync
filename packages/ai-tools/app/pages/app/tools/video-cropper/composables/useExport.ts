import type { CropLayer, VideoMetadata, ExportSettings, ExportProgress } from '../components/types'
import {
  BlobSource, Input, Output, BufferTarget, Mp4OutputFormat,
  ALL_FORMATS, VideoSample, Conversion,
  getFirstEncodableVideoCodec, getFirstEncodableAudioCodec,
} from 'mediabunny'

// ── Module-level singleton state ──────────────────────────────────

let worker: Worker | null = null
let activeConversion: any = null
let activeId = 0

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

function drawSubtitles(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number, height: number, text: string,
  style: { font: string; size: number; color: string; position: string; background: boolean; bgColor: string },
) {
  const fontSize = Math.round(style.size * (height / 1080))
  ctx.font = `bold ${fontSize}px ${style.font}`
  ctx.textAlign = 'center'
  const lines = text.split('\n')
  const lineHeight = fontSize * 1.4
  const totalHeight = lines.length * lineHeight
  let startY: number
  switch (style.position) {
    case 'top': startY = totalHeight + 40; break
    case 'middle': startY = height / 2 - totalHeight / 2; break
    default: startY = height - totalHeight - 40
  }
  lines.forEach((line, i) => {
    const y = startY + i * lineHeight
    if (style.background) {
      const metrics = ctx.measureText(line)
      const padX = 20; const padY = 8
      const bx = width / 2 - metrics.width / 2 - padX
      const by = y - fontSize - padY
      ctx.fillStyle = style.bgColor
      ctx.beginPath()
      ctx.roundRect(bx, by, metrics.width + padX * 2, fontSize + padY * 2, 8)
      ctx.fill()
    }
    ctx.fillStyle = style.color
    ctx.fillText(line, width / 2, y)
  })
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`
}

async function runExportInline(
  videoFile: File | null,
  videoMetadata: VideoMetadata,
  layers: CropLayer[],
  settings: ExportSettings,
  fitMode: 'cover' | 'contain' | 'fill',
  finalVideoAspectRatio: number | null,
  subtitleText: string,
  subtitleStyle: { font: string; size: number; color: string; position: string; background: boolean; bgColor: string },
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

  let trimEndTime: number | undefined
  let lastKeyframeTime = 0
  for (const layer of layers) {
    for (const kf of layer.keyframes) {
      if (kf.time > lastKeyframeTime) lastKeyframeTime = kf.time
    }
  }
  if (lastKeyframeTime > 0 && lastKeyframeTime < videoMetadata.duration) {
    trimEndTime = lastKeyframeTime
  }

  let inputBlob: Blob
  if (videoFile) {
    inputBlob = videoFile
  } else {
    exportProgress.value = { ...exportProgress.value, statusText: 'Buffering sample video file...' }
    const res = await fetch(videoMetadata.url)
    inputBlob = await res.blob()
  }

  exportProgress.value = { ...exportProgress.value, statusText: 'Opening WebCodecs decoder...' }
  const source = new BlobSource(inputBlob)
  const input = new Input({ source, formats: ALL_FORMATS })
  const target = new BufferTarget()
  const output = new Output({ target, format: new Mp4OutputFormat() })

  const layersData = JSON.parse(JSON.stringify(layers)) as CropLayer[]
  const videoW = videoMetadata.width
  const videoH = videoMetadata.height

  exportProgress.value = { ...exportProgress.value, statusText: 'Detecting supported video encoder...' }
  const containableCodecs = output.format.getSupportedVideoCodecs()
  const supportedCodec = await getFirstEncodableVideoCodec(containableCodecs)
  if (!supportedCodec) throw new Error('No supported video encoder found')

  const containableAudioCodecs = output.format.getSupportedAudioCodecs()
  const supportedAudioCodec = await getFirstEncodableAudioCodec(containableAudioCodecs)

  const audioOptions = settings.includeAudio
    ? supportedAudioCodec ? { codec: supportedAudioCodec, forceTranscode: true } : {}
    : { discard: true }

  const conversionOptions: any = {
    input, output,
    trim: trimEndTime ? { end: trimEndTime } : undefined,
    video: {
      frameRate: fps,
      codec: supportedCodec,
      forceTranscode: true,
      process: async (sample: VideoSample) => {
        const canvas = new OffscreenCanvas(exportWidth, exportHeight)
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#0a0a0b'
          ctx.fillRect(0, 0, exportWidth, exportHeight)
          const timestamp = sample.timestamp
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
          if (subtitleText && subtitleStyle) {
            drawSubtitles(ctx, exportWidth, exportHeight, subtitleText, subtitleStyle)
          }
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

async function runExportWorker(
  videoFile: File | null,
  videoMetadata: VideoMetadata,
  layers: CropLayer[],
  settings: ExportSettings,
  fitMode: 'cover' | 'contain' | 'fill',
  finalVideoAspectRatio: number | null,
  subtitleText: string,
  subtitleStyle: { font: string; size: number; color: string; position: string; background: boolean; bgColor: string },
  onProgress: (pct: number, processedTime: number) => void,
): Promise<Blob | null> {
  const id = ++activeId
  let payloadVideoData: ArrayBuffer | null = null
  let payloadVideoFileType = ''

  if (videoFile) {
    payloadVideoData = await videoFile.arrayBuffer()
    payloadVideoFileType = videoFile.type
  }

  return new Promise((resolve) => {
    worker = new Worker(new URL('./exportWorker.ts', import.meta.url), { type: 'module' })

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data
      if (msg.id !== id) return

      if (msg.type === 'progress') {
        exportProgress.value = { ...exportProgress.value, ...msg.progress }
        onProgress(msg.progress.percentage, msg.progress.elapsedTime / 1000)
      } else if (msg.type === 'complete') {
        exportProgress.value = { ...exportProgress.value, status: 'completed', statusText: 'Completed successfully!', percentage: 100 }
        resolve(msg.blob)
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
      id, videoMetadata,
      layers: JSON.parse(JSON.stringify(layers)),
      settings: { ...settings }, fitMode, finalVideoAspectRatio,
      subtitleText, subtitleStyle,
    }

    if (payloadVideoData) {
      payload.videoData = payloadVideoData
      payload.videoFileType = payloadVideoFileType
    } else {
      payload.videoUrl = videoMetadata.url
    }

    worker.postMessage(payload)
  })
}

async function runExport(
  videoFile: File | null,
  videoMetadata: VideoMetadata,
  layers: CropLayer[],
  settings: ExportSettings,
  fitMode: 'cover' | 'contain' | 'fill',
  finalVideoAspectRatio: number | null,
  subtitleText: string,
  subtitleStyle: { font: string; size: number; color: string; position: string; background: boolean; bgColor: string },
  onProgress: (pct: number, processedTime: number) => void,
): Promise<Blob | null> {
  exportProgress.value = { ...exportProgress.value, status: 'processing', statusText: 'Analyzing source tracks...', percentage: 0 }

  try {
    let result: Blob | null
    if (settings.useWorker) {
      result = await runExportWorker(videoFile, videoMetadata, layers, settings, fitMode, finalVideoAspectRatio, subtitleText, subtitleStyle, onProgress)
    } else {
      result = await runExportInline(videoFile, videoMetadata, layers, settings, fitMode, finalVideoAspectRatio, subtitleText, subtitleStyle, onProgress)
    }
    if (result) {
      exportProgress.value = { ...exportProgress.value, status: 'completed', statusText: 'Completed successfully!', percentage: 100 }
    }
    return result
  } catch (err: any) {
    exportProgress.value = { ...exportProgress.value, status: 'failed', statusText: err.message || 'Export failed', error: err.message || 'Export failed' }
    return null
  }
}

function cancelExport() {
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

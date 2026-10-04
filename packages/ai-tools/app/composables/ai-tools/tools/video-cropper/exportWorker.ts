import {
  BlobSource, Input, Output, BufferTarget, Mp4OutputFormat,
  ALL_FORMATS, VideoSample, Conversion,
  getFirstEncodableVideoCodec, getFirstEncodableAudioCodec,
} from 'mediabunny'
import { computeTrimEnd, getActiveCue, drawCue } from './subtitles'
import type { CropLayer, SubtitleCue, SubtitleStyle } from '../../../../utils/ai-tools/tools/video-cropper/types'

function interpolateCropBox(
  time: number,
  keyframes: { time: number; x: number; y: number; width: number; height: number }[],
  mode: string,
) {
  if (!keyframes.length) return { x: 0, y: 0, width: 1, height: 1 }
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

function drawFrame(
  ctx: OffscreenCanvasRenderingContext2D,
  exportWidth: number,
  exportHeight: number,
  timestamp: number,
  videoW: number,
  videoH: number,
  layersData: CropLayer[],
  stackingDirection: string,
  currentFit: string,
  interpolation: string,
  sample: VideoSample,
  subtitleCues: SubtitleCue[],
  subtitleStyle: SubtitleStyle,
) {
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

let activeConversion: any = null

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data
  const { id, videoData, videoFileType, videoMetadata, layers, settings, fitMode, finalVideoAspectRatio, subtitleCues, subtitleStyle, audioMode } = msg

  try {
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

    const inputBlob = new Blob([videoData], { type: videoFileType || 'video/mp4' })

    const source = new BlobSource(inputBlob)
    const input = new Input({ source, formats: ALL_FORMATS })
    const target = new BufferTarget()
    const output = new Output({ target, format: new Mp4OutputFormat() })

    const layersData = JSON.parse(JSON.stringify(layers)) as CropLayer[]
    const videoW = videoMetadata.width
    const videoH = videoMetadata.height

const containableCodecs = output.format.getSupportedVideoCodecs()
  // Probe at the real output size; mediabunny defaults to 1280x720, which can
  // pick a codec that then fails to configure at the actual frame size.
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
            drawFrame(ctx, exportWidth, exportHeight, sample.timestamp, videoW, videoH, layersData, stackingDirection, currentFit, interpolation, sample, subtitleCues, subtitleStyle)
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
      self.postMessage({
        id,
        type: 'progress',
        progress: {
          percentage: pct,
          processedFrames: Math.round(processedTime * fps),
          totalFrames: Math.round(videoMetadata.duration * fps),
          elapsedTime: processedTime * 1000,
        },
      })
    }

    await conversion.execute()

    const finalBuffer = target.buffer
    if (!finalBuffer) throw new Error('Transcoder yielded an empty output buffer')

    const exportedBlob = new Blob([finalBuffer], { type: 'video/mp4' })
    // When audio is discarded, the blob is only the video pass — the main thread muxes the
    // mixed audio afterwards (pass1). Otherwise this is the final file (complete).
    self.postMessage({ id, type: audioMode === 'discard' ? 'pass1' : 'complete', blob: exportedBlob })
  } catch (err: any) {
    if (err.name === 'ConversionCanceledError') {
      self.postMessage({ id, type: 'cancelled' })
    } else {
      self.postMessage({ id, type: 'error', error: err.message || String(err) })
    }
  }
}

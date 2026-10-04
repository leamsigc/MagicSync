/**
 * useCarouselVideoExport — animated carousel → MP4 via mediabunny (WebCodecs).
 *
 * Flow (patterns proven in useVideoRecorder.ts and video-cropper/useExport.ts):
 *  1. each slide is pre-rendered to PNG (modern-screenshot, via the caller)
 *  2. audio tracks are decoded + resampled + mixed to one stereo buffer
 *     (pure math in `audioMix.ts`) sized exactly to the video duration
 *  3. an OffscreenCanvas + CanvasSource push one frame per `1/fps` with the
 *     slide's motion transform interpolated from time
 *  4. only after the last video frame is written, the mixed audio buffer is
 *     fed to the AudioBufferSource with explicit 0→duration timestamps, then
 *     Output(Mp4OutputFormat) + finalize() → MP4 blob. Feeding audio last
 *     keeps the mux deterministic at every frame rate: at low fps the short
 *     video loop used to race ahead of the still-encoding upfront audio,
 *     cutting the tail.
 */
import {
  Output,
  BufferTarget,
  Mp4OutputFormat,
  CanvasSource,
  AudioBufferSource,
  getFirstEncodableVideoCodec,
  getFirstEncodableAudioCodec,
} from 'mediabunny'
import { mixTracksToStereo, resampleLinear } from './audioMix'

export type SlideMotionKey =
  | 'none' | 'fade' | 'zoom-in' | 'zoom-out'
  | 'pan-up' | 'pan-down' | 'pan-left' | 'pan-right'
  | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right'
  | 'blur-in'

export interface MotionPreset {
  key: SlideMotionKey
  label: string
}

export const MOTION_PRESETS: MotionPreset[] = [
  { key: 'none', label: 'None' },
  { key: 'fade', label: 'Fade in' },
  { key: 'zoom-in', label: 'Zoom in' },
  { key: 'zoom-out', label: 'Zoom out' },
  { key: 'pan-up', label: 'Pan up' },
  { key: 'pan-down', label: 'Pan down' },
  { key: 'pan-left', label: 'Pan left' },
  { key: 'pan-right', label: 'Pan right' },
  { key: 'slide-up', label: 'Slide up' },
  { key: 'slide-down', label: 'Slide down' },
  { key: 'slide-left', label: 'Slide left' },
  { key: 'slide-right', label: 'Slide right' },
  { key: 'blur-in', label: 'Blur in' },
]

export interface MusicTrack {
  id: string
  blob: Blob
  name: string
  volume: number
  loop: boolean
}

export interface VideoExportSettings {
  fps: number
  secondsPerSlide: number
  crossfade: boolean
  crossfadeSeconds: number
  motions: SlideMotionKey[]
  tracks: MusicTrack[]
  width: number
  height: number
}

function easeOut(p: number): number {
  return 1 - Math.pow(1 - p, 3)
}

function easeInOut(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
}

interface FrameTransform {
  scale: number
  tx: number
  ty: number
  alpha: number
  blur: number
}

const MOTION_FNS: Record<SlideMotionKey, (p: number, w: number, h: number) => FrameTransform> = {
  none: () => ({ scale: 1, tx: 0, ty: 0, alpha: 1, blur: 0 }),
  fade: (_p, _w, _h) => ({ scale: 1, tx: 0, ty: 0, alpha: Math.min(1, _p / 0.25), blur: 0 }),
  'zoom-in': (p, _w, _h) => ({ scale: 1 + 0.2 * easeInOut(p), tx: 0, ty: 0, alpha: 1, blur: 0 }),
  'zoom-out': (p, _w, _h) => ({ scale: 1.2 - 0.2 * easeInOut(p), tx: 0, ty: 0, alpha: 1, blur: 0 }),
  'pan-up': (_p, _w, h) => ({ scale: 1.18, tx: 0, ty: -0.06 * h * _p, alpha: 1, blur: 0 }),
  'pan-down': (_p, _w, h) => ({ scale: 1.18, tx: 0, ty: 0.06 * h * _p, alpha: 1, blur: 0 }),
  'pan-left': (_p, w, _h) => ({ scale: 1.18, tx: -0.06 * w * _p, ty: 0, alpha: 1, blur: 0 }),
  'pan-right': (_p, w, _h) => ({ scale: 1.18, tx: 0.06 * w * _p, ty: 0, alpha: 1, blur: 0 }),
  'slide-up': (p, _w, h) => ({ scale: 1, tx: 0, ty: h * (1 - easeOut(p)), alpha: 1, blur: 0 }),
  'slide-down': (p, _w, h) => ({ scale: 1, tx: 0, ty: -h * (1 - easeOut(p)), alpha: 1, blur: 0 }),
  'slide-left': (p, w, _h) => ({ scale: 1, tx: w * (1 - easeOut(p)), ty: 0, alpha: 1, blur: 0 }),
  'slide-right': (p, w, _h) => ({ scale: 1, tx: -w * (1 - easeOut(p)), ty: 0, alpha: 1, blur: 0 }),
  'blur-in': (p, _w, _h) => ({ scale: 1, tx: 0, ty: 0, alpha: 1, blur: (1 - easeOut(p)) * 28 }),
}

function motionAt(motion: SlideMotionKey, p: number, w: number, h: number): FrameTransform {
  return MOTION_FNS[motion](p, w, h)
}

async function decodeMusic(blob: Blob): Promise<AudioBuffer> {
  const ac = new AudioContext()
  try {
    const data = await blob.arrayBuffer()
    const buffer = await ac.decodeAudioData(data)
    return buffer
  } finally {
    void ac.close()
  }
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const resampledChannels = (buffer: AudioBuffer, targetRate: number, totalSamples: number): Float32Array[] => {
  const out: Float32Array[] = []
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    out.push(resampleLinear(buffer.getChannelData(ch), buffer.sampleRate, targetRate, totalSamples))
  }
  return out
};

/** Mixes decoded tracks to a stereo AudioBuffer of exactly `durationSec` (loop/trim + volume + fade-out). */
function mixTracksToBuffer(
  decoded: { buffer: AudioBuffer, volume: number, loop: boolean }[],
  durationSec: number,
): AudioBuffer | null {
  if (decoded.length === 0) return null
  const targetRate = Math.max(...decoded.map(entry => entry.buffer.sampleRate))
  const totalSamples = Math.max(1, Math.round(durationSec * targetRate))
  const { left, right } = mixTracksToStereo(
    decoded.map(entry => ({
      channels: resampledChannels(entry.buffer, targetRate, totalSamples),
      volume: clamp01(entry.volume),
      loop: entry.loop,
    })),
    totalSamples,
    Math.min(targetRate, totalSamples),
  )
  const out = new AudioBuffer({ length: totalSamples, sampleRate: targetRate, numberOfChannels: 2 })
  out.getChannelData(0).set(left)
  out.getChannelData(1).set(right)
  return out
}

export function useCarouselVideoExport() {
  const exporting = ref(false)
  const progress = ref(0)
  const statusText = ref('')
  const resultUrl = ref<string | null>(null)
  const error = ref('')
  let cancelled = false

  function cancel(): void {
    cancelled = true
  }

  async function renderAllSlides(
    renderSlidePng: (index: number) => Promise<string>,
    slideCount: number,
    report: (percent: number, status: string) => void,
  ): Promise<HTMLImageElement[] | null> {
    report(0.02, 'Rendering slides…')
    const images: HTMLImageElement[] = []
    for (let i = 0; i < slideCount; i++) {
      if (cancelled) return null
      const dataUrl = await renderSlidePng(i)
      const img = new Image()
      img.src = dataUrl
      await img.decode()
      images.push(img)
      report(0.02 + (0.18 * (i + 1) / slideCount), `Rendered slide ${i + 1}/${slideCount}`)
    }
    return images
  }

  async function openEncoder(width: number, height: number, fps: number): Promise<{
    canvas: OffscreenCanvas,
    ctx: OffscreenCanvasRenderingContext2D,
    output: Output,
    canvasSource: CanvasSource,
  }> {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')!
    const output = new Output({ target: new BufferTarget(), format: new Mp4OutputFormat({ fastStart: 'in-memory' }) })
    const videoCodec = await getFirstEncodableVideoCodec(output.format.getSupportedVideoCodecs(), { width, height, bitrate: 12e6 })
    if (!videoCodec) throw new Error('Your browser does not support video encoding.')
    const canvasSource = new CanvasSource(canvas, { codec: videoCodec, bitrate: 12e6, keyFrameInterval: 1 })
    output.addVideoTrack(canvasSource, { frameRate: fps })
    return { ctx, output, canvasSource }
  }

  async function prepareAudio(
    tracks: MusicTrack[],
    duration: number,
    report: (percent: number, status: string) => void,
  ): Promise<AudioBuffer | null> {
    if (tracks.length === 0) return null
    report(0.26, 'Preparing music…')
    const decoded = await Promise.all(tracks.map(async track => ({
      buffer: await decodeMusic(track.blob),
      volume: track.volume,
      loop: track.loop,
    })))
    return mixTracksToBuffer(decoded, duration)
  }

  async function createAudioTrack(output: Output, fitted: AudioBuffer): Promise<AudioBufferSource> {
    const audioCodec = await getFirstEncodableAudioCodec(
      output.format.getSupportedAudioCodecs(),
      { numberOfChannels: 2, sampleRate: fitted.sampleRate, bitrate: 192e3 },
    )
    const audioSource = new AudioBufferSource({
      codec: audioCodec ?? 'aac',
      bitrate: 192e3,
      sampleRate: fitted.sampleRate,
      numberOfChannels: 2,
    })
    output.addAudioTrack(audioSource)
    return audioSource
  }

  function drawFrame(
    ctx: OffscreenCanvasRenderingContext2D,
    images: HTMLImageElement[],
    slideIdx: number,
    slideCount: number,
    local: number,
    motion: SlideMotionKey,
    width: number,
    height: number,
    crossfade: boolean,
    crossfadeSeconds: number,
    secondsPerSlide: number,
  ): void {
    ctx.globalAlpha = 1
    ctx.filter = 'none'
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)

    const tf = motionAt(motion, local, width, height)
    ctx.save()
    if (tf.blur > 0.5) ctx.filter = `blur(${tf.blur}px)`
    ctx.globalAlpha = tf.alpha
    ctx.translate(width / 2 + tf.tx, height / 2 + tf.ty)
    ctx.scale(tf.scale, tf.scale)
    ctx.drawImage(images[slideIdx]!, -width / 2, -height / 2, width, height)
    ctx.restore()

    if (crossfade && slideIdx < slideCount - 1) {
      drawCrossfade(ctx, images, slideIdx, local, width, height, crossfadeSeconds, secondsPerSlide)
    }
  }

  function drawCrossfade(
    ctx: OffscreenCanvasRenderingContext2D,
    images: HTMLImageElement[],
    slideIdx: number,
    local: number,
    width: number,
    height: number,
    crossfadeSeconds: number,
    secondsPerSlide: number,
  ): void {
    const slideTime = local * secondsPerSlide
    const crossStart = secondsPerSlide - crossfadeSeconds
    if (slideTime <= crossStart) return
    const crossP = Math.min(1, (slideTime - crossStart) / crossfadeSeconds)
    ctx.save()
    ctx.globalAlpha = easeInOut(crossP)
    ctx.drawImage(images[slideIdx + 1]!, 0, 0, width, height)
    ctx.restore()
  }

  async function renderVideoFrames(
    io: {
      ctx: OffscreenCanvasRenderingContext2D,
      output: Output,
      canvasSource: CanvasSource,
      images: HTMLImageElement[],
      slideCount: number,
      width: number,
      height: number,
    },
    opts: {
      fps: number,
      secondsPerSlide: number,
      crossfade: boolean,
      crossfadeSeconds: number,
      motions: SlideMotionKey[],
    },
    report: (percent: number, status: string) => void,
  ): Promise<boolean> {
    const totalFrames = Math.round(io.slideCount * opts.secondsPerSlide * opts.fps)
    for (let f = 0; f < totalFrames; f++) {
      if (cancelled) {
        await io.output.cancel()
        return false
      }
      const t = f / opts.fps
      const slideIdx = Math.min(Math.floor(t / opts.secondsPerSlide), io.slideCount - 1)
      const local = (t - slideIdx * opts.secondsPerSlide) / opts.secondsPerSlide
      const motion = opts.motions[Math.min(slideIdx, opts.motions.length - 1)] ?? 'none'

      drawFrame(io.ctx, io.images, slideIdx, io.slideCount, local, motion, io.width, io.height, opts.crossfade, opts.crossfadeSeconds, opts.secondsPerSlide)
      await io.canvasSource.add(t, 1 / opts.fps)
      if (f % 5 === 0 || f === totalFrames - 1) {
        report(0.28 + (0.7 * (f + 1) / totalFrames), `Rendering frame ${f + 1}/${totalFrames}`)
      }
    }
    return true
  }

  async function exportCarouselVideo(
    renderSlidePng: (index: number) => Promise<string>,
    slideCount: number,
    settings: VideoExportSettings,
    onProgress?: (percent: number, status: string) => void,
  ): Promise<Blob | null> {
    cancelled = false
    exporting.value = true
    progress.value = 0
    error.value = ''
    resultUrl.value = null
    const { fps, secondsPerSlide, crossfade, crossfadeSeconds, motions, tracks, width, height } = settings

    const report = (percent: number, status: string): void => {
      progress.value = percent
      statusText.value = status
      onProgress?.(percent, status)
    }

    try {
      const images = await renderAllSlides(renderSlidePng, slideCount, report)
      if (!images) return null

      const { ctx, output, canvasSource } = await openEncoder(width, height, fps)
      const duration = slideCount * secondsPerSlide
      const fittedAudio = await prepareAudio(tracks, duration, report)
      if (cancelled) {
        await output.cancel()
        return null
      }
      const audioSource = fittedAudio ? await createAudioTrack(output, fittedAudio) : null
      await output.start()

      const completed = await renderVideoFrames(
        { ctx, output, canvasSource, images, slideCount, width, height },
        { fps, secondsPerSlide, crossfade, crossfadeSeconds, motions },
        report,
      )
      if (!completed) return null

      if (audioSource && fittedAudio) {
        report(0.98, 'Adding music…')
        await audioSource.add(fittedAudio)
      }
      return await finalizeExport(output, report)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Video export failed'
      return null
    } finally {
      exporting.value = false
    }
  }

  async function finalizeExport(output: Output, report: (percent: number, status: string) => void): Promise<Blob> {
    report(0.99, 'Finalizing…')
    await output.finalize()
    const buffer = output.target.buffer
    if (!buffer) throw new Error('Encoder produced an empty output')
    const blob = new Blob([buffer], { type: 'video/mp4' })
    if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
    resultUrl.value = URL.createObjectURL(blob)
    report(1, 'Done')
    return blob
  }

  function downloadResult(filename = 'carousel-animated.mp4'): void {
    if (!resultUrl.value) return
    const a = document.createElement('a')
    a.href = resultUrl.value
    a.download = filename
    a.click()
  }

  return {
    exporting,
    progress,
    statusText,
    resultUrl,
    error,
    exportCarouselVideo,
    cancel,
    downloadResult,
  }
}
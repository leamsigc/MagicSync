/**
 * useCarouselVideoExport — animated carousel → MP4 via mediabunny (WebCodecs).
 *
 * Flow (patterns proven in useVideoRecorder.ts and video-cropper/useExport.ts):
 *  1. each slide is pre-rendered to PNG (modern-screenshot, via the caller)
 *  2. an OffscreenCanvas + CanvasSource push one frame per `1/fps` with the
 *     slide's motion transform interpolated from time
 *  3. optional music: WebAudio decode → loop/trim to video duration into one
 *     AudioBuffer → AudioBufferSource → output.addAudioTrack()
 *  4. Output(Mp4OutputFormat) + finalize() → MP4 blob
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

export interface VideoExportSettings {
  fps: number
  secondsPerSlide: number
  crossfade: boolean
  crossfadeSeconds: number
  motions: SlideMotionKey[]
  music: { blob: Blob, volume: number } | null
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

/** Loops (or trims) the decoded music into an AudioBuffer of exactly `durationSec`, applies volume + fade-out. */
function fitAudioBuffer(decoded: AudioBuffer, durationSec: number, volume: number): AudioBuffer {
  const sampleRate = decoded.sampleRate
  const channels = Math.min(2, decoded.numberOfChannels)
  const totalSamples = Math.max(1, Math.round(durationSec * sampleRate))
  const out = new AudioBuffer({ length: totalSamples, sampleRate, numberOfChannels: 2 })

  for (let ch = 0; ch < 2; ch++) {
    const src = decoded.getChannelData(Math.min(ch, channels - 1))
    const dst = out.getChannelData(ch)
    let write = 0
    while (write < totalSamples) {
      const chunk = Math.min(src.length, totalSamples - write)
      dst.set(src.subarray(0, chunk), write)
      write += chunk
      if (src.length > totalSamples) break
    }
  }

  // volume + fade out over the final second
  const fadeSamples = Math.min(sampleRate, totalSamples)
  for (let ch = 0; ch < 2; ch++) {
    const dst = out.getChannelData(ch)
    for (let i = 0; i < totalSamples; i++) {
      let gain = volume
      const fromEnd = totalSamples - i
      if (fromEnd <= fadeSamples) gain *= fromEnd / fadeSamples
      dst[i] = dst[i] * gain
    }
  }
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

  async function attachMusic(
    output: Output,
    music: { blob: Blob, volume: number } | null,
    duration: number,
    report: (percent: number, status: string) => void,
  ): Promise<AudioBufferSource | null> {
    if (!music) {
      await output.start()
      return null
    }
    report(0.26, 'Preparing music…')
    const decoded = await decodeMusic(music.blob)
    const fitted = fitAudioBuffer(decoded, duration, Math.min(1, Math.max(0, music.volume)))
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
    await output.start()
    await audioSource.add(fitted)
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
    const { fps, secondsPerSlide, crossfade, crossfadeSeconds, motions, music, width, height } = settings

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
      await attachMusic(output, music, duration, report)

      const totalFrames = Math.round(duration * fps)
      for (let f = 0; f < totalFrames; f++) {
        if (cancelled) {
          await output.cancel()
          return null
        }
        const t = f / fps
        const slideIdx = Math.min(Math.floor(t / secondsPerSlide), slideCount - 1)
        const local = (t - slideIdx * secondsPerSlide) / secondsPerSlide
        const motion = motions[Math.min(slideIdx, motions.length - 1)] ?? 'none'

        drawFrame(ctx, images, slideIdx, slideCount, local, motion, width, height, crossfade, crossfadeSeconds, secondsPerSlide)
        await canvasSource.add(t, 1 / fps)
        if (f % 5 === 0 || f === totalFrames - 1) {
          report(0.28 + (0.7 * (f + 1) / totalFrames), `Rendering frame ${f + 1}/${totalFrames}`)
        }
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
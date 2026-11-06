import type {
  EditorObject,
  ImageEditorDocument,
} from '../../shared/image-editor/document'
import { documentPagesFonts } from '../../shared/image-editor/font-helpers'
import {
  applyLayerState,
  evaluateLayerState,
  evaluatePageTransition,
  pageDuration,
} from '../../shared/image-editor/animation'
import { registerDocumentFonts, unknownFontWarnings } from './design-fonts'
import { resolveImageSource } from './design-image-resolver'

/**
 * Server-side design renderer (Batch M3).
 *
 * Document → fonts registered → remote srcs resolved (SSRF-safe) →
 * per-object enliven on a StaticCanvas (isolated failures) → animation state
 * applied → PNG/JPEG/SVG buffer. The same `evaluateLayerState` the browser
 * preview runs, so exported frames match the on-canvas preview.
 */

export type DesignFormat = 'png' | 'jpeg' | 'webp' | 'svg'

export interface RenderDesignInput {
  document: ImageEditorDocument
  pageIndex?: number
  timeMs?: number
  format?: DesignFormat
  scale?: number
  quality?: number
}

export interface RenderDesignOutput {
  buffer: Buffer
  mimeType: string
  width: number
  height: number
  warnings: string[]
  fonts: string[]
}

export const MAX_RENDER_DIM = 4096
export const MAX_SCALE = 4

export async function renderDesign(input: RenderDesignInput): Promise<RenderDesignOutput> {
  const doc = input.document
  const pageIndex = boundedIndex(input.pageIndex ?? 0, doc.pages.length)
  const page = doc.pages[pageIndex]
  if (!page) throw new Error('Page index out of range')

  const scale = Math.min(MAX_SCALE, Math.max(0.1, Number(input.scale) || 1))
  const width = Math.round(Math.min(MAX_RENDER_DIM, doc.frame.width))
  const height = Math.round(Math.min(MAX_RENDER_DIM, doc.frame.height))

  const warnings: string[] = []
  const fonts = documentPagesFonts(doc)
  await registerDocumentFonts(fonts)
  warnings.push(...unknownFontWarnings(fonts))

  const F = await import('fabric/node')
  const canvas = new F.StaticCanvas(null, {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    renderOnAddRemove: false,
  })
  canvas.setViewportTransform([scale, 0, 0, scale, 0, 0])

  const timeMs = Math.max(0, Number(input.timeMs) || 0)
  const transition = evaluatePageTransition(
    page.animation?.transition?.type ?? 'none',
    page.animation?.transition?.duration ?? 0,
    timeMs,
    pageDuration(page),
  )

  try {
    canvas.backgroundColor = page.background?.fill ?? doc.frame.fill

    if (page.clipPath) {
      const [clip] = await safeEnliven(F, [page.clipPath], warnings)
      if (clip) {
        clip.selectable = false
        canvas.clipPath = clip
      }
    }

    const dead: string[] = []
    // Defensive: old documents stored __background above the first content
    // layer. It is the page photo/gradient, so always render it first.
    const orderedObjects = [...page.objects]
    const backgroundIndex = orderedObjects.findIndex(object => object.id === '__background')
    if (backgroundIndex > 0) orderedObjects.unshift(...orderedObjects.splice(backgroundIndex, 1))
    for (const raw of orderedObjects) {
      const obj = { originX: 'left', originY: 'top', ...raw }
      if (obj.visible === false) continue
      // Fabric/node multiplies shadow offsets by the object scale; the browser
      // preview keeps them in canvas units. Mark scaled-layer shadows as
      // non-scaling so the server matches the editor instead of rendering a
      // giant duplicate behind the text.
      const shadowRecord = obj as { shadow?: Record<string, unknown>; scaleX?: number; scaleY?: number }
      if (shadowRecord.shadow && ((shadowRecord.scaleX ?? 1) !== 1 || (shadowRecord.scaleY ?? 1) !== 1)) {
        obj.shadow = { ...shadowRecord.shadow, nonScaling: true }
      }
      const state = layerCombinedState(obj, page.animation?.layers?.[String(obj.id ?? '')], timeMs, transition)
      if (!state.visible) continue
      applyLayerState(obj, state)
      await resolveEmbeddedImages(obj, warnings)
      const [built] = await safeEnliven(F, [obj], warnings, dead)
      if (built) {
        built.selectable = false
        built.evented = false
        canvas.add(built)
      }
    }
    if (dead.length > 0) warnings.push(`${dead.length} layer(s) failed to build and were skipped`)
    canvas.renderAll()
    const buffer = canvasToBuffer(canvas, input.format ?? 'png', input.quality ?? 0.92, warnings)
    return { buffer, ...bufferMeta(buffer, input.format ?? 'png'), width: canvas.width, height: canvas.height, warnings, fonts }
  } finally {
    canvas.dispose()
  }
}

function layerCombinedState(
  obj: EditorObject,
  animation: Parameters<typeof evaluateLayerState>[1],
  timeMs: number,
  transition: ReturnType<typeof evaluatePageTransition>,
) {
  const layerState = evaluateLayerState(String(obj.id ?? ''), animation, { timeMs })
  return transition ? composed(layerState, transition) : layerState
}

function composed(base: ReturnType<typeof evaluateLayerState>, page: ReturnType<typeof evaluatePageTransition>) {
  return {
    visible: base.visible && page.visible,
    opacity: base.opacity * page.opacity,
    scaleX: base.scaleX * page.scaleX,
    scaleY: base.scaleY * page.scaleY,
    offsetX: base.offsetX + page.offsetX,
    offsetY: base.offsetY + page.offsetY,
    rotate: base.rotate + page.rotate,
  }
}

function boundedIndex(index: number, length: number): number {
  return Math.min(Math.max(0, Math.floor(index)), Math.max(0, length - 1))
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

async function safeEnliven(
  F: typeof import('fabric/node'),
  objects: unknown[],
  warnings: string[],
  dead?: string[],
): Promise<import('fabric').FabricObject[]> {
  try {
    const enlivened = await F.util.enlivenObjects(objects as Record<string, unknown>[])
    return enlivened
  } catch (error) {
    warnings.push(`Object build failed: ${summarize(error)}`)
    if (dead) dead.push('object')
    return []
  }
}

function summarize(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, 180)
}

/** Rewrite every embedded image src inside an object tree (asynchronous, recursive). */
async function resolveEmbeddedImages(obj: EditorObject, warnings: string[]) {
  const type = String(obj.type ?? '').toLowerCase()
  if (type === 'image' && typeof obj.src === 'string') {
    const resolved = await resolveImageSource(obj.src)
    if (resolved) {
      obj.src = resolved
      obj.crossOrigin = null
    } else {
      warnings.push(`Image source skipped (blocked or failed): ${obj.src.slice(0, 80)}`)
      obj.visible = false
    }
  }
  for (const child of (Array.isArray(obj.objects) ? obj.objects : []) as EditorObject[]) {
    await resolveEmbeddedImages(child, warnings)
  }
}

/**
 * Fabric v7 removed `canvas.toBuffer`; the node build encodes through the
 * jsdom canvas wrapper, so `toDataURL` is the supported path.
 */
function canvasToBuffer(canvas: import('fabric/node').StaticCanvas, format: DesignFormat, quality: number, warnings: string[]): Buffer {
  if (format === 'svg') {
    const svg = canvas.toSVG()
    return Buffer.from(svg, 'utf8')
  }
  const encodeAs = format === 'webp' ? 'jpeg' : format
  if (format === 'webp') warnings.push('node-canvas cannot encode WebP; JPEG returned instead')
  const dataUrl = canvas.toDataURL({ format: encodeAs, quality, multiplier: 1 })
  const base64 = dataUrl.split(',')[1] ?? ''
  return Buffer.from(base64, 'base64')
}

function bufferMeta(buffer: Buffer, format: DesignFormat): { mimeType: string } {
  if (format === 'svg') return { mimeType: 'image/svg+xml' }
  if (format === 'jpeg') return { mimeType: 'image/jpeg' }
  if (format === 'webp') return { mimeType: 'image/jpeg' }
  return { mimeType: 'image/png' }
}

/* ------------------------------------------------------------------ */
/* MP4 — frame series + ffmpeg pipe                                    */
/* ------------------------------------------------------------------ */

export interface RenderFramesInput {
  document: ImageEditorDocument
  pageIndex?: number
  fps?: number
  durationMs?: number
  scale?: number
  dynamicWidth?: number
  dynamicHeight?: number
}

export interface RenderFramesOutput {
  frames: Buffer[]
  fps: number
  durationMs: number
  width: number
  height: number
  warnings: string[]
}

export const MP4_LIMITS = {
  maxDurationMs: 10_000,
  maxFps: 30,
  maxFrames: 240,
  maxTargetHeight: 1080,
}

export async function renderDesignFrames(input: RenderFramesInput): Promise<RenderFramesOutput> {
  const fps = Math.min(MP4_LIMITS.maxFps, Math.max(6, Math.round(Number(input.fps) || 24)))
  const doc = input.document
  const pageIndex = boundedIndex(input.pageIndex ?? 0, doc.pages.length)
  const page = doc.pages[pageIndex]
  const durationMs = Math.min(
    MP4_LIMITS.maxDurationMs,
    Math.max(500, Math.round(input.durationMs ?? pageDuration(page))),
  )
  const frameCount = Math.min(MP4_LIMITS.maxFrames, Math.max(2, Math.round((durationMs / 1000) * fps)))
  const warnings: string[] = []

  const scale = dimensionScale(doc, input.dynamicHeight ?? MP4_LIMITS.maxTargetHeight)
  const frames: Buffer[] = []
  for (let index = 0; index < frameCount; index += 1) {
    const timeMs = index * (durationMs / frameCount)
    const rendered = await renderDesign({ document: doc, pageIndex, timeMs, format: 'png', scale })
    frames.push(rendered.buffer)
  }
  const first = frames[0]
  if (!first) throw new Error('No frames rendered')
  const meta = await import('canvas')
  const sample = await sizeFromPng(first)
  void meta
  return { frames, fps, durationMs, width: sample.width, height: sample.height, warnings }
}

function dimensionScale(doc: ImageEditorDocument, targetHeight: number): number {
  const aspect = doc.frame.width / Math.max(1, doc.frame.height)
  const height = Math.min(MP4_LIMITS.maxTargetHeight, targetHeight)
  const width = height * aspect
  return Math.min(1.5, Math.max(0.2, height / doc.frame.height)) * (width > MAX_RENDER_DIM ? MAX_RENDER_DIM / width : 1)
}

async function sizeFromPng(buffer: Buffer): Promise<{ width: number; height: number }> {
  // PNG IHDR: width at byte 16, height at byte 20 (big-endian)
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  return { width, height }
}

export interface EncodeMp4Options {
  fps: number
  timeoutMs?: number
  /** Optional background music, looped to the video length. */
  audio?: { bytes: Buffer; extension: string }
  /** 0…1 */
  audioVolume?: number
}

export class FfmpegUnavailableError extends Error {
  constructor(message = 'ffmpeg is not available in this environment') {
    super(message)
    this.name = 'FfmpegUnavailableError'
  }
}

/**
 * Encode a PNG frame series to H.264 MP4 with ffmpeg.
 *
 * ffmpeg writes to a temp file, not stdout: `-movflags +faststart` rewrites the
 * moov atom at the end, which the MP4 muxer cannot do on a non-seekable pipe
 * ("muxer does not support non seekable output").
 */
export async function encodeFramesToMp4(frames: Buffer[], options: EncodeMp4Options): Promise<Buffer> {
  const { spawn } = await import('node:child_process')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { readFile, unlink, writeFile } = await import('node:fs/promises')
  const outputPath = join(tmpdir(), `magicsync-mp4-${crypto.randomUUID()}.mp4`)
  const cleanupPaths = [outputPath]
  let audioPath: string | null = null
  if (options.audio) {
    audioPath = join(tmpdir(), `magicsync-audio-${crypto.randomUUID()}.${options.audio.extension}`)
    await writeFile(audioPath, options.audio.bytes)
    cleanupPaths.push(audioPath)
  }
  const volume = Math.min(1, Math.max(0, options.audioVolume ?? 1))
  const args = [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'png',
    '-framerate', String(options.fps),
    '-i', '-',
    ...(audioPath ? ['-stream_loop', '-1', '-i', audioPath] : []),
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-pix_fmt', 'yuv420p',
    ...(audioPath
      ? ['-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k', '-shortest', ...(volume < 1 ? ['-filter:a', `volume=${volume}`] : [])]
      : []),
    '-movflags', '+faststart',
    '-f', 'mp4',
    outputPath,
  ]
  const cleanup = () => { for (const path of cleanupPaths) void unlink(path).catch(() => {}) }
  return new Promise((resolvePromise, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] })
    let stderr = ''
    const timeout = setTimeout(() => child.kill('SIGKILL'), options.timeoutMs ?? 120_000)
    child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-2000) })
    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timeout)
      cleanup()
      if (error.code === 'ENOENT') reject(new FfmpegUnavailableError())
      else reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      if (code !== 0) {
        cleanup()
        reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`))
        return
      }
      readFile(outputPath)
        .then((buffer) => {
          cleanup()
          resolvePromise(buffer)
        })
        .catch((error) => {
          cleanup()
          reject(error)
        })
    })
    for (const frame of frames) child.stdin.write(frame)
    child.stdin.end()
  })
}

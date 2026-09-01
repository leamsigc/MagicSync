import type { CropLayer, SubtitleAutoGranularity, SubtitleCue, SubtitleStyle, SubtitleTimingMode } from '../components/types'

export interface ResolveCuesParams {
  sourceText: string
  cues: SubtitleCue[]
  mode: SubtitleTimingMode
  granularity: SubtitleAutoGranularity
  wordsPerCue: number
  durationSec: number
  secondsPerCue: number | null
}

/** Total duration that will actually be rendered (video trimmed to the last keyframe). */
export function computeTrimEnd(layers: CropLayer[], videoDuration: number): number {
  let lastKeyframeTime = 0
  for (const layer of layers) {
    for (const kf of layer.keyframes) {
      if (kf.time > lastKeyframeTime) lastKeyframeTime = kf.time
    }
  }
  if (lastKeyframeTime > 0 && lastKeyframeTime < videoDuration) return lastKeyframeTime
  return videoDuration
}

/** Splits raw text into the display chunks for the chosen granularity. */
export function splitText(
  text: string,
  granularity: SubtitleAutoGranularity,
  wordsPerCue: number,
): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const clean = (s: string) => s.trim().replace(/\s+/g, ' ')
  switch (granularity) {
    case 'line':
      return trimmed.split('\n').map(clean).filter(Boolean)
    case 'word':
      return trimmed.split(/\s+/).map(clean).filter(Boolean)
    case 'words-per-cue': {
      const words = trimmed.split(/\s+/).map(clean).filter(Boolean)
      const n = Math.max(1, Math.round(wordsPerCue))
      const chunks: string[] = []
      for (let i = 0; i < words.length; i += n) chunks.push(words.slice(i, i + n).join(' '))
      return chunks
    }
    case 'sentence': {
      const sentences: string[] = []
      for (const line of trimmed.split('\n')) {
        for (const sentence of line.split(/(?<=[.!?…])\s+/)) {
          const s = clean(sentence)
          if (s) sentences.push(s)
        }
      }
      return sentences
    }
    default:
      return []
  }
}

/** Distributes chunks into time-bounded cues (evenly across the video, or fixed seconds per cue). */
export function distributeCues(
  parts: string[],
  durationSec: number,
  secondsPerCue: number | null,
): SubtitleCue[] {
  const duration = Math.max(0, durationSec)
  if (parts.length === 0) return []
  if (duration <= 0) {
    return parts.map((text, i) => ({ id: `cue-${i}`, text, start: 0, end: 0 }))
  }
  if (secondsPerCue !== null && secondsPerCue > 0) {
    const spc = secondsPerCue
    const cues: SubtitleCue[] = []
    for (let i = 0; i < parts.length; i++) {
      const start = round2(i * spc)
      const end = round2(Math.min(start + spc, duration))
      if (start >= duration) break
      cues.push({ id: `cue-${i}`, text: parts[i]!, start, end })
    }
    return cues
  }
  const step = duration / parts.length
  return parts.map((text, i) => ({
    id: `cue-${i}`,
    text,
    start: round2(i * step),
    end: i === parts.length - 1 ? duration : round2((i + 1) * step),
  }))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Produces the final ordered cue list used by preview + export. */
export function resolveCues(params: ResolveCuesParams): SubtitleCue[] {
  if (params.mode === 'manual') {
    const seen = new Set<string>()
    return params.cues
      .map((c, i) => ({ ...c, id: c.id || `cue-${i}` }))
      .filter((c) => c.text.trim() !== '' && !seen.has(c.id) && seen.add(c.id))
      .map((c) => {
        const start = Math.max(0, c.start)
        const end = Math.max(start, c.end)
        return { ...c, text: c.text.trim(), start, end }
      })
      .sort((a, b) => a.start - b.start)
  }
  const parts = splitText(params.sourceText, params.granularity, params.wordsPerCue)
  return distributeCues(parts, params.durationSec, params.secondsPerCue)
}

/** Returns the cue visible at `timestamp` (inclusive start, exclusive end), or null. */
export function getActiveCue(cues: SubtitleCue[], timestamp: number): SubtitleCue | null {
  if (cues.length === 0) return null
  // binary search for the cue whose range contains the timestamp
  let lo = 0
  let hi = cues.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const cue = cues[mid]!
    if (timestamp < cue.start) hi = mid - 1
    else if (timestamp >= cue.end) lo = mid + 1
    else return cue
  }
  return null
}

/** Draws a single cue's text onto the canvas, mirroring the existing subtitle style. */
export function drawCue(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  width: number,
  height: number,
  cue: SubtitleCue,
  style: SubtitleStyle,
) {
  const fontSize = Math.round(style.size * (height / 1080))
  ctx.font = `bold ${fontSize}px ${style.font}`
  ctx.textAlign = 'center'
  const lines = cue.text.split('\n')
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

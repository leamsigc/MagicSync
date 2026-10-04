/**
 * audioMix — pure PCM helpers for the carousel video export.
 *
 * No DOM / Web Audio imports on purpose: this module runs in Node unit
 * tests as well as the browser. The composable (`useCarouselVideoExport`)
 * decodes with Web Audio, resamples every track to one common rate with
 * `resampleLinear`, then mixes with `mixTracksToStereo`.
 */

export interface MixInputTrack {
  /** Per-channel PCM at `sampleRate`. Mono tracks carry one channel. */
  channels: Float32Array[]
  volume: number
  /** Repeat short tracks to fill the output; otherwise play once + silence. */
  loop: boolean
}

export interface MixedStereo {
  left: Float32Array
  right: Float32Array
}

/** Linear-interpolation resample to `outLength` samples. */
export function resampleLinear(
  src: Float32Array,
  srcRate: number,
  dstRate: number,
  outLength: number,
): Float32Array {
  const out = new Float32Array(Math.max(1, outLength))
  if (src.length === 0) return out
  if (srcRate === dstRate) {
    out.set(src.subarray(0, Math.min(src.length, out.length)))
    return out
  }
  const ratio = srcRate / dstRate
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio
    const lo = Math.floor(pos)
    const hi = Math.min(lo + 1, src.length - 1)
    const frac = pos - lo
    out[i] = src[lo]! * (1 - frac) + src[hi]! * frac
  }
  return out
}

const pickChannel = (channels: Float32Array[], ch: number): Float32Array | null => {
  if (channels.length === 0) return null
  return channels[Math.min(ch, channels.length - 1)]!
};

const renderTrackInto = (
  dst: Float32Array,
  src: Float32Array | null,
  volume: number,
  loop: boolean,
): void => {
  if (!src || src.length === 0 || volume <= 0) return
  if (loop) {
    let write = 0
    while (write < dst.length) {
      const chunk = Math.min(src.length, dst.length - write)
      for (let i = 0; i < chunk; i++) dst[write + i]! += src[i]! * volume
      write += chunk
    }
    return
  }
  const chunk = Math.min(src.length, dst.length)
  for (let i = 0; i < chunk; i++) dst[i]! += src[i]! * volume
};

const peakOf = (left: Float32Array, right: Float32Array): number => {
  let peak = 0
  for (let i = 0; i < left.length; i++) {
    const a = Math.abs(left[i]!)
    const b = Math.abs(right[i]!)
    if (a > peak) peak = a
    if (b > peak) peak = b
  }
  return peak
};

const scaleStereo = (left: Float32Array, right: Float32Array, factor: number): void => {
  for (let i = 0; i < left.length; i++) {
    left[i]! *= factor
    right[i]! *= factor
  }
};

const applyFadeOut = (left: Float32Array, right: Float32Array, fadeSamples: number): void => {
  const span = Math.min(Math.max(1, fadeSamples), left.length)
  for (let i = 0; i < left.length; i++) {
    const fromEnd = left.length - i
    if (fromEnd > span) continue
    const gain = fromEnd / span
    left[i]! *= gain
    right[i]! *= gain
  }
};

/**
 * Mix tracks to a stereo pair of exactly `totalSamples`.
 * Short tracks loop-fill (or play once when `loop` is false), the sum is
 * peak-normalized when it would clip, then faded out over `fadeSamples`.
 */
export function mixTracksToStereo(
  tracks: MixInputTrack[],
  totalSamples: number,
  fadeSamples: number,
): MixedStereo {
  const length = Math.max(1, totalSamples)
  const left = new Float32Array(length)
  const right = new Float32Array(length)
  for (const track of tracks) {
    renderTrackInto(left, pickChannel(track.channels, 0), track.volume, track.loop)
    renderTrackInto(right, pickChannel(track.channels, 1), track.volume, track.loop)
  }
  const peak = peakOf(left, right)
  if (peak > 1) scaleStereo(left, right, 1 / peak)
  applyFadeOut(left, right, fadeSamples)
  return { left, right }
}

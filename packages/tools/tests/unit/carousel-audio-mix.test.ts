import { describe, expect, it } from 'vitest'
import { mixTracksToStereo, resampleLinear } from '../../app/composables/tools/carousel-creator/audioMix'

const track = (samples: number[], volume = 1, loop = true) => ({
  channels: [new Float32Array(samples)],
  volume,
  loop,
})

describe('resampleLinear', () => {
  it('passes through when rates match', () => {
    const out = resampleLinear(new Float32Array([0.1, 0.2, 0.3]), 8000, 8000, 3)
    expect(out[0]).toBeCloseTo(0.1)
    expect(out[1]).toBeCloseTo(0.2)
    expect(out[2]).toBeCloseTo(0.3)
  })

  it('upsamples with linear midpoints', () => {
    const out = resampleLinear(new Float32Array([0, 1]), 1, 2, 4)
    expect(out.length).toBe(4)
    expect(out[0]).toBeCloseTo(0)
    expect(out[1]).toBeCloseTo(0.5)
    expect(out[2]).toBeCloseTo(1)
  })

  it('handles empty input', () => {
    expect(resampleLinear(new Float32Array(0), 8000, 48000, 10).length).toBe(10)
  })
})

describe('mixTracksToStereo', () => {
  it('renders exact output length with gain and fade applied', () => {
    const { left, right } = mixTracksToStereo([track([0.5, 0.5, 0.5, 0.5], 0.5, false)], 4, 4)
    expect(left.length).toBe(4)
    // gains across the buffer: 1, 0.75, 0.5, 0.25
    expect(left[0]).toBeCloseTo(0.25)
    expect(left[3]).toBeCloseTo(0.0625)
    expect(Array.from(right)).toEqual(Array.from(left))
  })

  it('loops short tracks to fill the duration', () => {
    const { left } = mixTracksToStereo([track([0.4, -0.4], 1, true)], 6, 1)
    expect(left[0]).toBeCloseTo(0.4)
    expect(left[2]).toBeCloseTo(0.4)
    expect(left[4]).toBeCloseTo(0.4)
  })

  it('plays once then silence when loop is false', () => {
    const { left } = mixTracksToStereo([track([0.4, 0.4], 1, false)], 4, 4)
    // fade spans the whole buffer here; head sample keeps partial gain
    expect(left[0]).toBeGreaterThan(0)
    expect(left[2]).toBeCloseTo(0)
    expect(left[3]).toBeCloseTo(0)
  })

  it('sums multiple tracks and peak-normalizes instead of clipping', () => {
    const { left } = mixTracksToStereo(
      [track([0.8, 0.8, 0.8, 0.8], 1, false), track([0.8, 0.8, 0.8, 0.8], 1, false)],
      4,
      1,
    )
    const peak = Math.max(...Array.from(left).map(Math.abs))
    expect(peak).toBeLessThanOrEqual(1)
    expect(peak).toBeGreaterThan(0.9)
  })

  it('ignores muted and empty tracks', () => {
    const { left } = mixTracksToStereo(
      [track([0.9, 0.9], 0, true), { channels: [], volume: 1, loop: true }],
      2,
      2,
    )
    expect(left[0]).toBeCloseTo(0)
  })

  it('fades the final second to silence', () => {
    const samples = new Array(100).fill(0.5)
    const { left } = mixTracksToStereo([track(samples, 1, false)], 100, 100)
    expect(left[0]).toBeCloseTo(0.5 * (100 / 100))
    expect(left[99]).toBeCloseTo(0.5 * (1 / 100), 4)
  })
})

import { BlobSource, Input, ALL_FORMATS, AudioBufferSink } from 'mediabunny'
import type { CustomAudioTrack } from '../components/types'

export interface MixedPcm {
  /** One Float32Array per channel (up to 2), in sync. */
  channels: Float32Array[]
  sampleRate: number
  length: number
}

const MIX_SAMPLE_RATE = 48000
const MIX_CHANNELS = 2

export interface DecodedSourceAudio {
  /** The decoded audio buffers of the source video's audio track. */
  buffers: { buffer: AudioBuffer; timestamp: number }[]
}

let decodeCtx: AudioContext | null = null
function getDecodeContext(): AudioContext {
  if (!decodeCtx) decodeCtx = new AudioContext()
  return decodeCtx
}

/** Decodes a background track (file or URL) into an AudioBuffer. Throws on failure. */
export async function decodeBackgroundTrack(track: CustomAudioTrack): Promise<AudioBuffer> {
  let arrayBuffer: ArrayBuffer
  if (track.file) {
    arrayBuffer = await track.file.arrayBuffer()
  } else if (track.url) {
    const res = await fetch(track.url)
    if (!res.ok) throw new Error(`Failed to fetch audio (${res.status})`)
    arrayBuffer = await res.arrayBuffer()
  } else {
    throw new Error('Audio track has no source')
  }
  return await getDecodeContext().decodeAudioData(arrayBuffer)
}

/** Extracts the source video's audio track (if any) as decoded buffers with their timestamps. */
export async function extractSourceAudio(
  inputBlob: Blob,
  endTime: number,
): Promise<DecodedSourceAudio | null> {
  const input = new Input({ source: new BlobSource(inputBlob), formats: ALL_FORMATS })
  try {
    const tracks = await input.getAudioTracks()
    const track = tracks[0]
    if (!track) return null
    const sink = new AudioBufferSink(track)
    const buffers: { buffer: AudioBuffer; timestamp: number }[] = []
    for await (const wrapped of sink.buffers(0, endTime)) {
      buffers.push({ buffer: wrapped.buffer, timestamp: wrapped.timestamp })
    }
    if (buffers.length === 0) return null
    return { buffers }
  } finally {
    await input.dispose()
  }
}

function pcmFromAudioBuffer(buffer: AudioBuffer): Float32Array[] {
  const channels: Float32Array[] = []
  for (let c = 0; c < Math.min(buffer.numberOfChannels, MIX_CHANNELS); c++) {
    channels.push(buffer.getChannelData(c))
  }
  return channels
}

/**
 * Mixes the source video audio + all background tracks into a single stereo PCM buffer of exactly
 * `durationSec`. Returns null when there is nothing to mix (no source audio and no decodable track).
 *
 * Background tracks are looped or played once according to `track.loop`, at `track.volume`.
 */
export async function mixAudio(
  inputBlob: Blob,
  tracks: CustomAudioTrack[],
  durationSec: number,
): Promise<MixedPcm | null> {
  const duration = Math.max(0, durationSec)
  const length = Math.max(1, Math.ceil(duration * MIX_SAMPLE_RATE))
  const ctx = new OfflineAudioContext(MIX_CHANNELS, length, MIX_SAMPLE_RATE)

  let added = false

  if (inputBlob) {
    const sourceAudio = await extractSourceAudio(inputBlob, duration)
    if (sourceAudio) {
      for (const { buffer, timestamp } of sourceAudio.buffers) {
        const src = ctx.createBufferSource()
        src.buffer = buffer
        const gain = ctx.createGain()
        gain.gain.value = 1
        src.connect(gain)
        gain.connect(ctx.destination)
        src.start(timestamp)
        added = true
      }
    }
  }

  for (const track of tracks) {
    let buffer: AudioBuffer
    try {
      buffer = await decodeBackgroundTrack(track)
    } catch {
      // Skip tracks that fail to decode (bad file, CORS on remote URLs, unsupported codec).
      continue
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = track.loop
    const gain = ctx.createGain()
    gain.gain.value = Math.min(1, Math.max(0, track.volume ?? 1))
    src.connect(gain)
    gain.connect(ctx.destination)
    src.start(0)
    added = true
  }

  if (!added) return null

  const rendered = await ctx.startRendering()
  const channels = pcmFromAudioBuffer(rendered)
  return { channels, sampleRate: MIX_SAMPLE_RATE, length }
}

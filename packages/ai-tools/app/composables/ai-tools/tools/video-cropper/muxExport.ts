import {
  Input, BlobSource, ALL_FORMATS, EncodedPacketSink, EncodedVideoPacketSource,
  Output, BufferTarget, Mp4OutputFormat, AudioBufferSource,
  getFirstEncodableAudioCodec,
} from 'mediabunny'
import type { MixedPcm } from './audioMix'

export interface MuxProgress {
  percent: number
  statusText: string
}

/**
 * Re-muxes a video-only MP4 with a pre-mixed audio track (packet copy for video — no re-encode,
 * no quality loss) and returns the final MP4 blob.
 */
export async function muxVideoWithAudio(
  videoOnlyBlob: Blob,
  pcm: MixedPcm,
  frameRate: number,
  onProgress?: (percent: number, statusText: string) => void,
  isCancelled?: () => boolean,
): Promise<Blob> {
  const report = (percent: number, statusText: string) => {
    onProgress?.(percent, statusText)
  }

  const input = new Input({ source: new BlobSource(videoOnlyBlob), formats: ALL_FORMATS })
  const output = new Output({ target: new BufferTarget(), format: new Mp4OutputFormat({ fastStart: 'in-memory' }) })

  try {
    const videoTrack = (await input.getVideoTracks())[0]
    if (!videoTrack) throw new Error('Processed video has no video track')
    const codec = await videoTrack.getCodec()
    if (!codec) throw new Error('Unable to determine processed video codec')

    const decoderConfig = await videoTrack.getDecoderConfig()
    const rotation = await videoTrack.getRotation()

    const videoSource = new EncodedVideoPacketSource(codec)
    output.addVideoTrack(videoSource, { frameRate, rotation })

    const audioCodec = await getFirstEncodableAudioCodec(
      output.format.getSupportedAudioCodecs(),
      { numberOfChannels: pcm.channels.length, sampleRate: pcm.sampleRate, bitrate: 192e3 },
    )
    const audioSource = new AudioBufferSource({
      codec: audioCodec ?? 'aac',
      bitrate: 192e3,
      transform: {
        sampleRate: pcm.sampleRate,
        numberOfChannels: pcm.channels.length,
      },
    })
    output.addAudioTrack(audioSource)

    const sink = new EncodedPacketSink(videoTrack)
    const mixedAudioBuffer = new AudioBuffer({
      length: pcm.length,
      numberOfChannels: pcm.channels.length,
      sampleRate: pcm.sampleRate,
    })
    for (let c = 0; c < pcm.channels.length; c++) {
      mixedAudioBuffer.getChannelData(c).set(pcm.channels[c]!)
    }

    await output.start()

    let first = true
    for await (const packet of sink.packets()) {
      if (isCancelled?.()) {
        await output.cancel()
        throw new Error('Export cancelled')
      }
      await videoSource.add(packet, first ? { decoderConfig: decoderConfig ?? undefined } : undefined)
      first = false
    }

    report(96, 'Encoding audio track...')
    await audioSource.add(mixedAudioBuffer)

    report(98, 'Finalizing file...')
    await output.finalize()

    const buffer = output.target.buffer
    if (!buffer) throw new Error('Muxer yielded an empty output buffer')
    return new Blob([buffer], { type: 'video/mp4' })
  } finally {
    await input.dispose()
  }
}

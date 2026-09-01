import { useVideoCropper } from './useVideoCropper'

/**
 * Plays background audio tracks in sync with the source video during preview.
 * The source video element handles its own audio natively; this layers the
 * background tracks on top using the Web Audio API, honoring per-track
 * volume/loop and the global volume/mute controls.
 */
export function useAudioPreview() {
  const { audioTracks, volume, getVideo } = useVideoCropper()

  let ctx: AudioContext | null = null
  let activeNodes: { source: AudioBufferSourceNode; gain: GainNode }[] = []
  const decodeCache = new Map<string, AudioBuffer>()
  const liveTracks = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }>()

  const isSourceVideo = (target: EventTarget | null): target is HTMLVideoElement =>
    target instanceof HTMLVideoElement && target.getAttribute('aria-label') === 'source-video'

  function ensureCtx(): AudioContext {
    if (!ctx) ctx = new AudioContext()
    return ctx
  }

  async function getDecoded(track: { id: string; file?: File; url?: string }): Promise<AudioBuffer | null> {
    if (decodeCache.has(track.id)) return decodeCache.get(track.id)!
    try {
      let arrayBuffer: ArrayBuffer
      if (track.file) {
        arrayBuffer = await track.file.arrayBuffer()
      } else if (track.url) {
        const res = await fetch(track.url)
        if (!res.ok) return null
        arrayBuffer = await res.arrayBuffer()
      } else {
        return null
      }
      const buffer = await ensureCtx().decodeAudioData(arrayBuffer)
      decodeCache.set(track.id, buffer)
      return buffer
    } catch {
      return null
    }
  }

  function stopAll() {
    for (const { source } of activeNodes) {
      try { source.stop() } catch { /* already stopped */ }
    }
    activeNodes = []
    liveTracks.clear()
  }

  async function startPlayback() {
    stopAll()
    const el = getVideo()
    if (!el || audioTracks.value.length === 0) return
    if (ctx?.state === 'suspended') await ctx.resume()

    const audioCtx = ensureCtx()
    const globalVol = volume.value

    for (const track of audioTracks.value) {
      const buffer = await getDecoded(track)
      if (!buffer) continue
      // Non-looping track whose end already passed — nothing to play.
      if (!track.loop && el.currentTime >= buffer.duration) continue

      const source = audioCtx.createBufferSource()
      source.buffer = buffer
      source.loop = track.loop
      const gain = audioCtx.createGain()
      gain.gain.value = Math.min(1, Math.max(0, track.volume ?? 1)) * Math.max(0, globalVol)
      source.connect(gain)
      gain.connect(audioCtx.destination)
      source.start(0, track.loop ? el.currentTime % buffer.duration : el.currentTime)
      activeNodes.push({ source, gain })
      liveTracks.set(track.id, { source, gain })
    }
  }

  function handlePlay(e: Event) {
    if (!isSourceVideo(e.target)) return
    void startPlayback()
  }

  function handlePause(e: Event) {
    if (!isSourceVideo(e.target)) return
    stopAll()
  }

  function handleSeeked(e: Event) {
    if (!isSourceVideo(e.target)) return
    const el = e.target as HTMLVideoElement
    if (!el.paused) void startPlayback()
  }

  useEventListener(document, 'play', handlePlay, { capture: true })
  useEventListener(document, 'pause', handlePause, { capture: true })
  useEventListener(document, 'seeked', handleSeeked, { capture: true })

  // Reflect global volume/mute changes live (per-track base gain is kept in liveTracks).
  watch(volume, (v) => {
    for (const [id, { gain }] of liveTracks) {
      const track = audioTracks.value.find(t => t.id === id)
      gain.gain.value = Math.min(1, Math.max(0, track?.volume ?? 1)) * Math.max(0, v)
    }
  })
  watch(
    () => audioTracks.value.map(t => ({ id: t.id, volume: t.volume, loop: t.loop })),
    () => {
      // Drop decodes for removed tracks, then rebuild the graph if playing.
      const ids = new Set(audioTracks.value.map(t => t.id))
      for (const id of decodeCache.keys()) if (!ids.has(id)) decodeCache.delete(id)
      const el = getVideo()
      if (el && !el.paused && !el.ended) void startPlayback()
    },
    { deep: true },
  )

  onUnmounted(() => {
    stopAll()
    decodeCache.clear()
    if (ctx) { void ctx.close(); ctx = null }
  })

  return { startPlayback, stopAll }
}

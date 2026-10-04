# In-Browser MP4 Export with Audio Mix + Timed Subtitles (video-cropper)

How to export an MP4 entirely in the browser that (1) mixes background audio tracks
with the source video's audio and (2) burns time-based subtitles into every frame.

Location: `packages/ai-tools/app/composables/ai-tools/tools/video-cropper/` (page: `packages/site/app/pages/app/tools/video-cropper/`)

## Architecture (mediabunny, two-pass)

`Conversion` can only carry the input's own tracks, so a second audio source is added
by re-muxing:

1. **Mix audio on the main thread** — `audioMix.ts`
   - Web Audio (`AudioContext.decodeAudioData` / `OfflineAudioContext`) is not reliable
     in workers, so mixing always happens on the main thread.
   - Source video audio → `Input` + `AudioBufferSink.buffers(0, end)` → place each buffer
     at its own timestamp.
   - Background tracks (`File`/`url`, `loop`, `volume`) → `decodeAudioData` → buffer
     source + gain, `loop = track.loop`.
   - Render with `OfflineAudioContext(2ch, dur * 48kHz, 48000)` → extract `Float32Array`
     channels (this `MixedPcm` shape is what travels to the worker).
   - Return `null` when there is nothing to mix → fall back to video-only.

2. **Pass 1 — video only** — `useExport.ts` / `exportWorker.ts`
   - Existing `Conversion` with `audio: { discard: true }` (inline or worker).
   - Worker posts the intermediate blob (`type: 'pass1'`); main thread decides the rest.
   - Worker payload gotcha: `ref()` deeply reacts object values, and **Vue reactive
     proxies cannot be structured-cloned** → `JSON.parse(JSON.stringify(...))` every
     object field (videoMetadata, subtitleStyle, cues) before `postMessage`.

3. **Pass 2 — re-mux with audio** — `muxExport.ts`
   - `Input(pass1Blob)` → `EncodedPacketSink.packets()` (decode order) →
     `EncodedVideoPacketSource` + `Output(Mp4OutputFormat({ fastStart: 'in-memory' }))`.
     Packet copy = no re-encode, no quality loss.
   - `new AudioBuffer({ length, numberOfChannels, sampleRate })` (constructor works in
     workers) fed to `AudioBufferSource` with `transform: { sampleRate, numberOfChannels }`
     (this installed mediabunny version has no top-level `sampleRate` on the source).
   - First video packet gets `{ decoderConfig }` meta from `videoTrack.getDecoderConfig()`.

## Subtitles: cue model, not a string

A single `subtitleText` string has no timing — burn the wrong thing on every frame.
Use `SubtitleCue { id, text, start, end }` (`components/types.ts`) resolved by
`subtitles.ts`:

- `computeTrimEnd(layers, duration)` — the export trims to the last keyframe; subtitle
  auto-distribution must match that duration or preview ≠ export.
- Auto mode: `splitText` by granularity (`word | words-per-cue | line | sentence`) →
  `distributeCues` evenly across the duration (short video = fast cues), or fixed
  `secondsPerCue`. Round times to 2 decimals — un-rounded values fail `<input
  type=number step=0.1>` validation.
- Manual mode: user-editable cue list (start/end `step="any"` inputs).
- Rendering: `getActiveCue(cues, timestamp)` (binary search) + `drawCue` — import from
  `subtitles.ts` into `useExport.ts`, `exportWorker.ts`, AND `LivePreview.vue` so the
  preview shows exactly what exports. (Fonts in the worker fall back to default sans —
  document fonts aren't loaded in worker scope.)

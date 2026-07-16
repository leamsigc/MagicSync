# RFC: Refactor `useTextToSpeech` composable into a deep, instance-scoped facade

**Labels:** `refactor`, `architecture`, `ai-tools`, `good-first-pr-friendly`
**Milestone:** Backlog (post current TTS stabilization)

---

## Problem

`packages/ai-tools/app/pages/app/tools/text-to-speech/composables/useTextToSpeech.ts` is a **shallow facade over module-level singletons masquerading as a Vue composable**. The function is named `useTextToSpeech()` and the return value looks like idiomatic reactive state — but underneath, ~30 module-level refs and ~15 functions all share hidden globals (`audioContext`, `currentSource`, `worker`, `pendingSynthResolve`, `pendingSynthId`, `mainAbortController`).

This causes real bugs we keep hitting:

| Pain | Concrete bug we've shipped |
|---|---|
| **SSR-unsafe** | Hydration mismatches when the page is rendered server-side (status ref initializes on the server with one value, mutates on the client before hydration). |
| **Multi-instance-unsafe** | Two `useTextToSpeech()` calls in the same render tree share worker state, audio buffers, and pending promises — silent corruption. |
| **Mock-unfriendly** | Tests can't fake `Worker`, `AudioContext`, or IndexedDB without monkey-patching module-level imports. We have zero unit tests for this composable. |
| **Wide surface** | `index.vue` reads from and writes to 20+ refs simultaneously to coordinate Generate + Play + Download + History. Every new feature (e.g. history playback) requires touching the composable. |
| **History bug class** | The recent history-play bug (`handlePlayHistory` played the *current* audio because `GenerationRecord` only stored `wavBuffer`, not the Float32 PCM) was caused by the composable leaking the result-wav-buffer shape across responsibilities. |

---

## Goal

Replace `useTextToSpeech()` with a **factory function** that:

1. Returns a **closure-scoped instance** — no module-level state. Each call gets its own worker, audio context, message queue, and history adapter.
2. Exposes a **small, ergonomic surface** of ~8 entry points mapped 1:1 to the buttons the Vue page already uses.
3. **Auto-persists successful generations** to IndexedDB inside `generate()`, so callers can never forget the history hook.
4. Makes `Worker` and `AudioContext` **injectable** for tests.

---

## Proposed design

### Interface signature

```ts
export interface TtsOptions {
  voiceId?: string
  language?: string
  speed?: number
  quality?: number
}

export interface TtsResult {
  id: string
  text: string
  wavBuffer: ArrayBuffer
  duration: number
  createdAt: number
}

export interface TextToSpeechState {
  isGenerating: boolean
  progress: number   // 0..100, smooth across chunks
  isPlaying: boolean
}

export interface UseTextToSpeechReturn {
  // Reactive state
  state: Readonly<Ref<TextToSpeechState>>
  history: Readonly<Ref<TtsResult[]>>

  // Core actions (8 entry points)
  generate: (text: string, options?: TtsOptions) => Promise<TtsResult | null>
  cancel: () => void

  // Playback & export
  play: (result: TtsResult | { audio: Float32Array; sampleRate: number }) => Promise<void>
  stopPlay: () => void
  download: (result: TtsResult, filename?: string) => void

  // History
  removeHistory: (id: string) => Promise<void>
}

export declare function useTextToSpeech(deps?: {
  useMainThread?: boolean
  workerFactory?: () => Worker
  audioContext?: AudioContext
}): UseTextToSpeechReturn
```

### Usage (the standard Generate → Play → History flow)

```vue
<script setup lang="ts">
const text = ref('The quick brown fox jumps over the lazy dog.')
const tts = useTextToSpeech() // factory creates its own worker, DB, AudioContext

async function onGenerate() {
  try {
    const result = await tts.generate(text.value, { voiceId: 'M1' })
    if (result) await tts.play(result) // already persisted to IndexedDB
  } catch (err) {
    showToastError(err.message)
  }
}
</script>
```

### What gets hidden inside

- Worker lifecycle (`new TtsWorker()`, `postMessage`, message routing) — only created on first `generate()` call, terminated on `onUnmounted`.
- AudioContext creation — lazy-init on first `play()` to dodge browser autoplay policies.
- IndexedDB persistence — `generate()` calls `history.add()` automatically on success.
- AbortController coordination — `cancel()` aborts both the in-flight worker task and any main-thread engine call.
- Chunking + progress aggregation — long text is split internally; per-chunk progress is mapped into the single `state.progress` 0..100.
- Cleanup — `onUnmounted` is wired into the factory (not the global module).

### Dependency injection

```ts
// Production
const tts = useTextToSpeech()

// Test (vitest)
const tts = useTextToSpeech({
  useMainThread: true,                   // skip worker transport
  audioContext: new MockAudioContext(),  // fake buffer source
})

// Or test the worker transport itself:
const tts = useTextToSpeech({
  workerFactory: () => new MockTtsWorker(),  // postMessage shim
})
```

---

## Migration plan (tiny commits, each atomic)

1. **Extract `playHistoryBuffer()` helper** — add a `Float32Array → AudioBufferSourceNode` utility next to `parseWavFile` so `handlePlayHistory` can decode on demand. *(Surgical, no API change.)*
2. **Wrap the existing module-level state in a `createInstance()` factory** — every ref and function becomes closure-scoped. The exported `useTextToSpeech()` calls `createInstance()` and returns the result. *(Mechanical refactor — public API unchanged.)*
3. **Collapse the 20+ scalar refs into a single `state` ref** — `state.value.isGenerating`, `state.value.progress`, `state.value.isPlaying`. Existing computed refs become `state` getters. Update `index.vue` bindings. *(Pure rename, behavior preserved.)*
4. **Move IndexedDB persistence inside `generate()`** — delete the `history.add()` call from `index.vue`'s success handler. Update tests if any exist. *(One-line delete per call site.)*
5. **Add the `deps` parameter + factory injection** — accepts `workerFactory`, `audioContext`, `useMainThread`. Wire internal `new TtsWorker()` and `new AudioContext()` through the injected factories, falling back to defaults. *(Test seam unlocked.)*
6. **Add unit tests** — boundary tests for: cancel returns null, error throws, multi-instance isolation, history persistence on success. Replace manual smoke tests for future changes.

Each step is independently mergeable and the system stays working at every commit.

---

## Acceptance criteria

- [ ] No `const x = ref(...)` outside `createInstance()` in the composable file.
- [ ] Two simultaneous `useTextToSpeech()` calls in different components run side-by-side without state leakage (verified by a Vitest test).
- [ ] `useTextToSpeech({ useMainThread: true, audioContext: new MockAudioContext() })` runs the entire flow without instantiating a real Worker or AudioContext.
- [ ] `index.vue` reads/writes ≤ 3 reactive primitives (state, history, plus 1 form ref for the input text).
- [ ] `history.add()` is called from exactly one place — inside `generate()`.
- [ ] All existing TTS behavior preserved: worker default, success-toast-vs-error, regenerate doesn't hang, long-text chunking, history play decodes correctly.

---

## Out of scope

- Replacing the `ttsEngine.ts` ONNX pipeline (already a clean pure module).
- Changing the IndexedDB schema in `useTtsHistory.ts`.
- Adding SSR-side rendering of TTS results (the engine requires WASM — SSR is intentionally a no-op).
- New TTS features (e.g. voice cloning, SSML) — this RFC is purely architectural.

---

## Test strategy (new)

- **Vitest unit tests** at `packages/ai-tools/tests/composables/useTextToSpeech.spec.ts`:
  - Multi-instance isolation
  - `cancel()` returns null mid-synthesis
  - `generate()` error → `history` unchanged
  - `generate()` success → history contains the new entry, state.progress reaches 100
- **Mock worker** that echoes messages via a `vi.fn()` postMessage shim.
- **Existing manual smoke test** (click Generate, click Play, click History item) stays as the integration test until Playwright is added.

---

## References

- A Philosophy of Software Design, John Ousterhout — "deep modules" principle.
- Current implementation: `packages/ai-tools/app/pages/app/tools/text-to-speech/composables/useTextToSpeech.ts`
- Caller: `packages/ai-tools/app/pages/app/tools/text-to-speech/index.vue`
- History hook: `packages/ai-tools/app/pages/app/tools/text-to-speech/composables/useTtsHistory.ts`
- Engine (unchanged): `packages/ai-tools/app/pages/app/tools/text-to-speech/composables/ttsEngine.ts`
- Worker (unchanged): `packages/ai-tools/app/assets/workers/ttsWorker.ts`
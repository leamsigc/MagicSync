/**
 * ttsWorker — Supertonic-3 Web Worker (thin wrapper)
 *
 * Imports ttsEngine and delegates all inference to it.
 * Handles only message-passing orchestration.
 *
 * Supports cancellation via the 'cancel' message type, which aborts the
 * currently in-flight synthesis and drains any queued synthesize messages
 * for the same id (sends 'cancelled' for each drained).
 */

import {
  loadAllModels,
  synthesize,
  AVAILABLE_VOICES,
  AVAILABLE_LANGUAGES,
  LANGUAGE_NAMES,
  detectLanguage,
  getVoiceStyles,
  setEngineVoice,
} from '../../pages/app/tools/text-to-speech/composables/ttsEngine'

let isProcessing = false
let currentController: AbortController | null = null
const messageQueue: MessageEvent[] = []

async function processNextMessage(): Promise<void> {
  if (isProcessing || messageQueue.length === 0) return
  isProcessing = true

  const e = messageQueue.shift()!
  const data: Record<string, unknown> = e.data || {}
  const type = data.type as string

  try {
    switch (type) {
      case 'load': {
        await loadAllModels((evt: any) => self.postMessage(evt))
        break
      }

      case 'synthesize': {
        const text = data.text as string
        const synthId = data.id as string
        if (!text?.trim()) { self.postMessage({ type: 'error', id: synthId, error: 'No text provided' }); break }
        // Auto-load if models not loaded yet (engine's isModelLoading guard prevents double-load)
        try {
          await loadAllModels((evt: any) => self.postMessage(evt))
        } catch (err: any) {
          self.postMessage({ type: 'error', id: synthId, error: err?.message || 'Failed to load models' })
          break
        }

        // New controller per synthesis so a cancel cancels ONLY this run, not
        // any subsequent queued work.
        const controller = new AbortController()
        currentController = controller

        try {
          const result = await synthesize(text, {
            voiceId: (data.voiceId as string) || 'M1',
            speed: (data.speed as number) ?? 1.0,
            quality: (data.quality as number) ?? 8,
            language: (data.language as string) || null,
          }, (evt: any) => self.postMessage(evt), controller.signal)

          self.postMessage({
            type: 'complete',
            id: synthId,
            audio: result.audio,
            sampleRate: result.sampleRate,
            wavBuffer: result.wavBuffer,
            duration: result.duration,
            detectedLanguage: result.detectedLanguage,
            voiceId: (data.voiceId as string) || 'M1',
          })
        }
        catch (err: any) {
          if (err?.name === 'AbortError') {
            self.postMessage({ type: 'cancelled', id: synthId })
          }
          else {
            self.postMessage({ type: 'error', id: synthId, error: err?.message || 'Unknown worker error' })
          }
        }
        finally {
          if (currentController === controller) currentController = null
        }
        break
      }

      case 'cancel': {
        const targetId = data.id as string | undefined
        // Abort the in-flight synthesis. Only one is ever in flight at a
        // time, so there's no need to match against a stored id — page-side
        // always sends the current pending id anyway.
        if (currentController) currentController.abort()
        // Drop pending synthesize messages from the queue (so they don't
        // auto-pickup after we've resolved). Non-synthesize messages are
        // preserved in order.
        while (messageQueue.length > 0) {
          const head = messageQueue[0]
          if (!head) break
          const d = (head.data || {}) as Record<string, unknown>
          if (d.type !== 'synthesize') break
          if (targetId && d.id !== targetId) break
          messageQueue.shift()
          self.postMessage({ type: 'cancelled', id: d.id })
        }
        break
      }

      case 'getVoices':
        self.postMessage({ type: 'voices', voices: AVAILABLE_VOICES, loadedVoiceIds: Object.keys(getVoiceStyles()) })
        break

      case 'getLanguages':
        self.postMessage({ type: 'languages', languages: AVAILABLE_LANGUAGES, languageNames: LANGUAGE_NAMES })
        break

      case 'detectLanguage': {
        const d = detectLanguage(data.text as string)
        self.postMessage({ type: 'detectedLanguage', language: d, languageName: d ? LANGUAGE_NAMES[d] : null })
        break
      }

      case 'setVoice':
        if (data.voiceId) setEngineVoice(data.voiceId as string)
        break

      default:
        // Unknown message type — silently ignore
        break
    }
  } catch (err: any) {
    self.postMessage({ type: 'error', id: data.id as string, error: err?.message || 'Unknown worker error' })
  } finally {
    isProcessing = false
    processNextMessage()
  }
}

self.onmessage = (e: MessageEvent) => {
  messageQueue.push(e)
  processNextMessage()
}

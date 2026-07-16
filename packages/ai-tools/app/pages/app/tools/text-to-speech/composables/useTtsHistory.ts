/**
 * useTtsHistory — IndexedDB-backed history of past generations.
 *
 * Stores each successful synthesis (with its full WAV `ArrayBuffer`) so the
 * user can re-play or re-download it without re-running the model.
 *
 * Design decisions:
 *   - Single object store, `id` is a UUIDv4 keyPath, indexed by `timestamp`
 *     for cheap newest-first listing.
 *   - We store the **rendered WAV** (ArrayBuffer) rather than raw Float32
 *     because it's already ready-to-play and ready-to-download; raw Float32
 *     would need re-encoding through `writeWavFile` on every access.
 *   - Hard cap at `MAX_HISTORY` items. Adding a new generation trims the
 *     oldest entries past the cap, keeping IndexedDB bounded (~75MB worst
 *     case at 30 × 2.5MB).
 *
 * @author MagicSync Team
 * @version 0.1.0
 */
import type { Ref } from 'vue'

export interface GenerationRecord {
  id: string
  text: string
  textSnippet: string
  voiceId: string
  voiceName: string
  language: string
  languageName: string
  duration: number
  timestamp: number
  sampleRate: number
  /**
   * 16-bit PCM WAV bytes (mono). Used both for download AND for playback
   * (decoded on demand via `parseWavFile`). Storing only the WAV (not also
   * the Float32Array) keeps IndexedDB storage roughly half-size and means
   * older history entries without `audio` still play correctly.
   */
  wavBuffer: ArrayBuffer
}

export type NewGeneration = Omit<GenerationRecord, 'id' | 'timestamp'>

const DB_NAME = 'tts-history'
const DB_VERSION = 1
const STORE_NAME = 'generations'
const MAX_HISTORY = 30

// ── DB lifecycle ──────────────────────────────────────────────────
let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available in this environment'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `gen-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// ── DB operations ─────────────────────────────────────────────────
async function insertGeneration(record: GenerationRecord): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).add(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function trimToCap(): Promise<void> {
  const db = await openDb()
  const all = await readAllAsc()
  const over = all.length - MAX_HISTORY
  if (over <= 0) return
  const toDelete = all.slice(0, over).map((g) => g.id)
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const id of toDelete) store.delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function readAllAsc(): Promise<GenerationRecord[]> {
  return new Promise<GenerationRecord[]>((resolve, reject) => {
    openDb().then((db) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const idx = tx.objectStore(STORE_NAME).index('timestamp')
      const out: GenerationRecord[] = []
      const req = idx.openCursor()
      req.onsuccess = () => {
        const c = req.result
        if (c) { out.push(c.value as GenerationRecord); c.continue() }
        else resolve(out)
      }
      req.onerror = () => reject(req.error)
    }).catch(reject)
  })
}

async function deleteGeneration(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function clearHistory(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ── Public composable ─────────────────────────────────────────────
export function useTtsHistory() {
  const generations: Ref<GenerationRecord[]> = ref([])
  const loaded = ref(false)
  const loading = ref(false)

  async function load() {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      const all = await readAllAsc()
      // Newest first in UI
      generations.value = all.slice().reverse()
      loaded.value = true
    }
    finally {
      loading.value = false
    }
  }

  async function add(record: NewGeneration): Promise<string> {
    const full: GenerationRecord = { ...record, id: uuid(), timestamp: Date.now() }
    try {
      await insertGeneration(full)
      // Prepend (newest at top)
      generations.value = [full, ...generations.value]
      // Trim in-memory + persist eviction
      if (generations.value.length > MAX_HISTORY) {
        generations.value = generations.value.slice(0, MAX_HISTORY)
      }
      // Fire-and-forget DB trim (best-effort)
      trimToCap().catch(() => { /* non-fatal */ })
      return full.id
    }
    catch {
      // IndexedDB failures shouldn't break synthesis UX — swallow with console noise.
      // eslint-disable-next-line no-console
      console.warn('[useTtsHistory] Failed to persist generation')
      throw new Error('History storage failed')
    }
  }

  async function remove(id: string) {
    try { await deleteGeneration(id) }
    finally { generations.value = generations.value.filter((g) => g.id !== id) }
  }

  async function clear() {
    try { await clearHistory() }
    finally { generations.value = [] }
  }

  function snippet(record: GenerationRecord, maxLen = 60): string {
    const txt = record.text || record.textSnippet || ''
    return txt.length > maxLen ? `${txt.slice(0, maxLen)}…` : txt
  }

  return {
    generations, loaded, loading,
    load, add, remove, clear, snippet,
    MAX_HISTORY,
  }
}

export const TTS_HISTORY_LIMIT = MAX_HISTORY

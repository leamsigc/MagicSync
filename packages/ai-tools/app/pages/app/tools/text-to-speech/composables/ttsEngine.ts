/**
 * ttsEngine — Supertonic-3 ONNX Inference Engine
 *
 * Pure module that runs the full TTS pipeline: model loading, text preprocessing,
 * and inference. Works on the main thread and inside web workers.
 *
 * Pipeline:
 *   1. Text preprocessing (Unicode normalization, language tagging)
 *   2. Unicode → index mapping via unicode_indexer.json
 *   3. Duration Predictor → per-token durations
 *   4. Text Encoder → text conditioning
 *   5. Vector Estimator (Flow Matching) → denoised latent
 *   6. Vocoder → raw audio waveform
 *   7. WAV encoding → 16-bit PCM download
 */

import * as ort from 'onnxruntime-web'

// ── ONNX Runtime WASM ──────────────────────────────────────────
// Vite's dev server can't serve `.wasm` files from node_modules with the
// correct `application/wasm` MIME type — it returns 404 or wrong content-type,
// which breaks the WASM backend. We instead serve the ORT WASM files locally
// from packages/site/public/assets/wasm/ alongside the model assets.
//
// `numThreads = 1` keeps inference single-threaded (workers don't pay off
// for these small models). SharedArrayBuffer is still required by the JSEP
// memory model itself, which is provided via the COOP/COEP headers in
// packages/site/nuxt.config.ts.
ort.env.wasm.wasmPaths = '/assets/wasm/'
ort.env.wasm.numThreads = 1

// All assets served locally from packages/site/public/
const ONNX_BASE = '/assets/onnx'
const VOICE_BASE = '/assets/voice_styles'

// ── Exportable Constants ───────────────────────────────────────
export const AVAILABLE_LANGUAGES = [
  'en', 'ko', 'ja', 'ar', 'bg', 'cs', 'da', 'de', 'el', 'es',
  'et', 'fi', 'fr', 'hi', 'hr', 'hu', 'id', 'it', 'lt', 'lv',
  'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sv', 'tr', 'uk', 'vi',
] as const

export const AVAILABLE_VOICES = [
  { id: 'M1', name: 'Alex', gender: 'male' as const },
  { id: 'M2', name: 'James', gender: 'male' as const },
  { id: 'M3', name: 'Robert', gender: 'male' as const },
  { id: 'M4', name: 'Sam', gender: 'male' as const },
  { id: 'M5', name: 'Daniel', gender: 'male' as const },
  { id: 'F1', name: 'Sarah', gender: 'female' as const },
  { id: 'F2', name: 'Lily', gender: 'female' as const },
  { id: 'F3', name: 'Jessica', gender: 'female' as const },
  { id: 'F4', name: 'Olivia', gender: 'female' as const },
  { id: 'F5', name: 'Emily', gender: 'female' as const },
] as const

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', ko: 'Korean', ja: 'Japanese', ar: 'Arabic', bg: 'Bulgarian',
  cs: 'Czech', da: 'Danish', de: 'German', el: 'Greek', es: 'Spanish',
  et: 'Estonian', fi: 'Finnish', fr: 'French', hi: 'Hindi', hr: 'Croatian',
  hu: 'Hungarian', id: 'Indonesian', it: 'Italian', lt: 'Lithuanian',
  lv: 'Latvian', nl: 'Dutch', pl: 'Polish', pt: 'Portuguese', ro: 'Romanian',
  ru: 'Russian', sk: 'Slovak', sl: 'Slovenian', sv: 'Swedish', tr: 'Turkish',
  uk: 'Ukrainian', vi: 'Vietnamese',
}

// ── Progress Event Type ────────────────────────────────────────
export type EngineProgressEvent = {
  type: string
  status?: string
  progress?: number
  text?: string
  model?: string
  loadedVoices?: string[]
  failedVoices?: string[]
  error?: string
}

export type EngineProgressCallback = (event: EngineProgressEvent) => void

// ── Engine State ───────────────────────────────────────────────
let dpSession: ort.InferenceSession | null = null
let textEncSession: ort.InferenceSession | null = null
let vectorEstSession: ort.InferenceSession | null = null
let vocoderSession: ort.InferenceSession | null = null

let cfgs: any = null
let unicodeIndexer: Record<number, number> = {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let voiceStyles: Record<string, any> = {}
let engineVoiceId = 'M1'

let isModelLoading = false

// Log prefix
const LOG = '[ttsEngine]'

console.log(LOG, 'Supertonic-3 TTS engine initialized')
console.log(LOG, 'WASM CDN:', ort.env.wasm.wasmPaths)

// ── Text Preprocessing ────────────────────────────────────────

/**
 * Split long text into sentence-aware chunks the ONNX model can handle.
 *
 * The Supertonic-3 model has a fixed max sequence length (~1000 tokens); any
 * single batch with more than that triggers an ONNX broadcasting error
 * (`axis == 1 || axis == largest was false`). We split at sentence boundaries
 * (period/exclamation/question/ellipsis followed by whitespace) and group
 * sentences until each chunk fits under `maxLen` characters. If a single
 * sentence exceeds the limit (e.g. a run-on without punctuation), we fall
 * back to word-boundary splitting for that sentence.
 *
 * Each returned chunk is non-empty and pre-trimmed; the model will wrap it
 * with language tags via `preprocessText()` per chunk.
 */
function splitIntoChunks(text: string, maxLen: number): string[] {
  if (maxLen <= 0) return [text]
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.length <= maxLen) return [trimmed]

  const chunks: string[] = []
  // Split on sentence boundaries. The lookbehind keeps the punctuation with
  // its sentence so we don't lose trailing "."s.
  const sentences = trimmed.split(/(?<=[.!?…])\s+/)

  let current = ''
  const flush = () => {
    if (current.trim()) {
      chunks.push(current.trim())
      current = ''
    }
  }

  for (const raw of sentences) {
    const s = raw.trim()
    if (!s) continue

    // Single sentence too long — flush current and word-split this one.
    if (s.length > maxLen) {
      flush()
      const words = s.split(/\s+/)
      let buf = ''
      for (const w of words) {
        // Hard-cap: a single word longer than maxLen (e.g. URL/hash without
        // spaces) is char-split so the model never sees an oversized batch.
        if (w.length > maxLen) {
          if (buf.trim()) { chunks.push(buf.trim()); buf = '' }
          for (let i = 0; i < w.length; i += maxLen) {
            chunks.push(w.slice(i, i + maxLen))
          }
          continue
        }
        const candidate = buf ? `${buf} ${w}` : w
        if (candidate.length > maxLen && buf) {
          chunks.push(buf.trim())
          buf = w
        }
        else {
          buf = candidate
        }
      }
      if (buf.trim()) chunks.push(buf.trim())
      continue
    }

    // Try to append; flush if it pushes us over.
    const candidate = current ? `${current} ${s}` : s
    if (candidate.length > maxLen && current) {
      chunks.push(current.trim())
      current = s
    }
    else {
      current = candidate
    }
  }
  flush()

  return chunks.length > 0 ? chunks : [trimmed]
}

/**
 * Concatenate per-chunk audio arrays with `silenceSeconds` of zero-padding
 * between them for natural prosody breaks. Zero-fill from Float32Array is
 * already silent, so no explicit silence buffer needed.
 */
function concatenateAudio(segments: Float32Array[], sampleRate: number, silenceSeconds: number): Float32Array {
  if (segments.length === 0) return new Float32Array(0)
  // Index access under `noUncheckedIndexedAccess` is `T | undefined`; non-null
  // assertions are safe here because we only access 0..segments.length-1.
  const first = segments[0]!
  if (segments.length === 1) return first
  const silenceSamples = Math.max(0, Math.floor(sampleRate * silenceSeconds))
  let totalLen = silenceSamples * (segments.length - 1)
  for (const seg of segments) totalLen += seg.length
  const out = new Float32Array(totalLen)
  let offset = 0
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    out.set(seg, offset)
    offset += seg.length
    if (i < segments.length - 1) offset += silenceSamples
  }
  return out
}

function preprocessText(text: string, lang: string | null): string {
  text = text.normalize('NFKD')

  text = text.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu,
    '',
  )

  const replacements: Record<string, string> = {
    '\u2013': '-', '\u2011': '-', '\u2014': '-', _: ' ',
    '\u201C': '"', '\u201D': '"', '\u2018': "'", '\u2019': "'",
    '\u00B4': "'", '`': "'", '[': ' ', ']': ' ', '|': ' ',
    '/': ' ', '#': ' ', '\u2192': ' ', '\u2190': ' ',
  }
  for (const [k, v] of Object.entries(replacements)) text = text.replaceAll(k, v)

  text = text.replace(/[\u2665\u2606\u2661\u00A9\\]/g, '')

  const exprReplacements: Record<string, string> = {
    '@': ' at ', 'e.g.,': 'for example,', 'i.e.,': 'that is,',
  }
  for (const [k, v] of Object.entries(exprReplacements)) text = text.replaceAll(k, v)

  text = text.replace(/ ,/g, ',').replace(/ \./g, '.').replace(/ !/g, '!')
    .replace(/ \?/g, '?').replace(/ ;/g, ';').replace(/ :/g, ':').replace(/ '/g, "'")

  while (text.includes('""')) text = text.replace(/""/g, '"')
  while (text.includes("''")) text = text.replace(/''/g, "'")
  while (text.includes('``')) text = text.replace(/``/g, '`')

  text = text.replace(/\s+/g, ' ').trim()

  if (!/[.!?;:,')}\]\u2026\u3002\u300D\u300F\u3011\u3009\u300B\u203A\u00BB]$/.test(text)) {
    text += '.'
  }

  const validLang = lang && (AVAILABLE_LANGUAGES as readonly string[]).includes(lang) ? lang : null
  text = validLang ? `<${validLang}>${text}</${validLang}>` : `<na>${text}</na>`
  return text
}

function textToUnicodeValues(text: string): number[] {
  return Array.from(text).map((char) => char.charCodeAt(0))
}

function lengthToMask(lengths: number[], maxLen: number | null = null): number[][][] {
  maxLen = maxLen ?? Math.max(...lengths)
  return lengths.map((len) => {
    const row: number[] = []
    for (let j = 0; j < maxLen!; j++) row.push(j < len ? 1.0 : 0.0)
    return [row]
  })
}

function getTextMask(textIdsLengths: number[]): number[][][] {
  return lengthToMask(textIdsLengths)
}

function getLatentMask(wavLengths: number[], cfgs: any): number[][][] {
  const baseChunkSize: number = cfgs.ae.base_chunk_size
  const chunkCompressFactor: number = cfgs.ttl.chunk_compress_factor
  const latentSize = baseChunkSize * chunkCompressFactor
  const latentLengths = wavLengths.map((len) => Math.floor((len + latentSize - 1) / latentSize))
  return lengthToMask(latentLengths)
}

function sampleNoisyLatent(
  duration: number[][][],
  cfgs: any,
): { noisyLatent: number[][][]; latentMask: number[][][] } {
  const sampleRate: number = cfgs.ae.sample_rate
  const baseChunkSize: number = cfgs.ae.base_chunk_size
  const chunkCompressFactor: number = cfgs.ttl.chunk_compress_factor
  const ldim: number = cfgs.ttl.latent_dim
  const wavLenMax = Math.max(...duration.map((d) => d[0][0])) * sampleRate
  const wavLengths = duration.map((d) => Math.floor(d[0][0] * sampleRate))
  const chunkSize = baseChunkSize * chunkCompressFactor
  const latentLen = Math.floor((wavLenMax + chunkSize - 1) / chunkSize)
  const latentDim = ldim * chunkCompressFactor

  const noisyLatent: number[][][] = []
  for (let b = 0; b < duration.length; b++) {
    const batch: number[][] = []
    for (let d = 0; d < latentDim; d++) {
      const row: number[] = []
      for (let t = 0; t < latentLen; t++) {
        const u1 = Math.random()
        const u2 = Math.random()
        row.push(Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2))
      }
      batch.push(row)
    }
    noisyLatent.push(batch)
  }

  const latentMask = getLatentMask(wavLengths, cfgs)
  for (let b = 0; b < noisyLatent.length; b++) {
    for (let d = 0; d < noisyLatent[b].length; d++) {
      for (let t = 0; t < noisyLatent[b][d].length; t++) {
        noisyLatent[b][d][t] *= latentMask[b][0][t]
      }
    }
  }

  return { noisyLatent, latentMask }
}

// ── Unicode Processor ─────────────────────────────────────────
class UnicodeProcessor {
  private indexer: Record<number, number>
  constructor(indexer: Record<number, number>) { this.indexer = indexer }

  call(textList: string[], lang: string | null = null): {
    textIds: number[][]; textMask: number[][][]; unsupportedChars: string[]
  } {
    const processedTexts = textList.map((t) => preprocessText(t, lang))
    const textIdsLengths = processedTexts.map((t) => t.length)
    const maxLen = Math.max(...textIdsLengths)
    const textIds: number[][] = []
    const unsupportedChars = new Set<string>()

    for (let i = 0; i < processedTexts.length; i++) {
      const row = new Array(maxLen).fill(0)
      const unicodeVals = textToUnicodeValues(processedTexts[i])
      for (let j = 0; j < unicodeVals.length; j++) {
        const indexValue = this.indexer[unicodeVals[j]]
        row[j] = (indexValue === undefined || indexValue === null || indexValue === -1) ? 0 : indexValue
        if (!indexValue || indexValue === -1) unsupportedChars.add(processedTexts[i][j])
      }
      textIds.push(row)
    }

    return { textIds, textMask: getTextMask(textIdsLengths), unsupportedChars: Array.from(unsupportedChars) }
  }
}

// ── Tensor Helpers ────────────────────────────────────────────
function arrayToTensor(array: any[], dims: number[]): ort.Tensor {
  const flat = array.flat(Infinity) as number[]
  return new ort.Tensor('float32', Float32Array.from(flat), dims)
}

function intArrayToTensor(array: any[], dims: number[]): ort.Tensor {
  const flat = array.flat(Infinity) as number[]
  return new ort.Tensor('int64', BigInt64Array.from(flat.map((x) => BigInt(Math.round(x)))), dims)
}

// ── WAV Encoding ──────────────────────────────────────────────
function writeWavFile(audioData: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const dataSize = audioData.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const w = (v: DataView, o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(view, 0, 'RIFF'); view.setUint32(4, 36 + dataSize, true)
  w(view, 8, 'WAVE'); w(view, 12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true)
  view.setUint16(32, numChannels * bytesPerSample, true); view.setUint16(34, bitsPerSample, true)
  w(view, 36, 'data'); view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < audioData.length; i++) {
    const s = Math.max(-1, Math.min(1, audioData[i]))
    view.setInt16(offset, Math.max(-32768, Math.min(32767, Math.floor(s * 32767))), true)
    offset += 2
  }
  return buffer
}

// ── Style Tensor Builders ─────────────────────────────────────
function buildStyleTtlTensor(voiceId: string): ort.Tensor {
  const vs = voiceStyles[voiceId]
  if (!vs) throw new Error(`Voice style '${voiceId}' not loaded`)
  const d = vs.style_ttl?.data as number[][][] | undefined
  if (!d) throw new Error(`Missing style_ttl for voice '${voiceId}'`)
  const flat = d.flat(Infinity) as number[]
  return new ort.Tensor('float32', Float32Array.from(flat), [d.length, d[0].length, d[0][0].length])
}

function buildStyleDpTensor(voiceId: string): ort.Tensor {
  const vs = voiceStyles[voiceId]
  if (!vs) throw new Error(`Voice style '${voiceId}' not loaded`)
  const d = vs.style_dp?.data as number[][][] | undefined
  if (!d) throw new Error(`Missing style_dp for voice '${voiceId}'`)
  const flat = d.flat(Infinity) as number[]
  return new ort.Tensor('float32', Float32Array.from(flat), [d.length, d[0].length, d[0][0].length])
}

// ── Build Inputs Dict ─────────────────────────────────────────
function buildInputs(session: ort.InferenceSession, mapping: Record<string, ort.Tensor>): Record<string, ort.Tensor> {
  const inputs: Record<string, ort.Tensor> = {}
  for (const [semanticName, tensor] of Object.entries(mapping)) {
    const actualName = session.inputNames.find(
      (n) => n === semanticName || n.toLowerCase() === semanticName.toLowerCase(),
    )
    if (actualName) inputs[actualName] = tensor
    else console.warn(`${LOG} No matching input for '${semanticName}' in ${session.inputNames.join(', ')}`)
  }
  return inputs
}

// ── Language Detection ────────────────────────────────────────
export function detectLanguage(text: string): string | null {
  if (!text || text.trim().length < 3) return null
  const sampleText = text.length > 200 ? text.substring(text.length - 200) : text
  const n = sampleText.normalize('NFC').toLowerCase()

  if (/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(n)) return 'ko'
  if (/[\u3040-\u30FF]/.test(n)) return 'ja'
  if (/[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(n)) return 'ar'
  if (/[\u0900-\u097F]/.test(n)) return 'hi'
  if (/[\u0370-\u03FF]/.test(n)) return 'el'

  if (/[\u0400-\u04FF]/.test(n)) {
    if (/[\u0456\u0457\u0454\u0491]/.test(n)) return 'uk'
    if (/\u044A/.test(n)) return 'bg'
    return 'ru'
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scores: Record<string, number> = { en: 0, es: 0, fr: 0, pt: 0, de: 0, it: 0, nl: 0, pl: 0, sv: 0, da: 0, tr: 0, vi: 0 }
  if (/\u00F1/.test(n)) scores.es += 15
  if (/[\u00BF\u00A1]/.test(n)) scores.es += 12
  if (/\u00E3/.test(n)) scores.pt += 15
  if (/\u0153/.test(n)) scores.fr += 15
  if (/\u00DF/.test(n)) scores.de += 15
  if (/[\u00E4\u00F6\u00FC]/.test(n)) { scores.de += 4; scores.sv += 2 }
  if (/\u00E5/.test(n)) { scores.sv += 8; scores.da += 8 }
  if (/[\u00E6\u00F8]/.test(n)) scores.da += 12
  if (/[\u0105\u0119\u0107\u0142\u0144\u015B\u017A\u017C]/.test(n)) scores.pl += 12
  if (/[\u011F\u015F\u0131\u0130]/.test(n)) scores.tr += 12

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stopwords: Record<string, string[]> = {
    en: ['the', 'is', 'are', 'was', 'were', 'have', 'this', 'that', 'with', 'from', 'they'],
    es: ['el', 'los', 'las', 'est\u00E1', 'porque', 'pero', 'muy', 'tambi\u00E9n', 'm\u00E1s'],
    fr: ['le', 'les', 'est', 'sont', 'dans', 'avec', 'sur', 'pas', 'plus', 'tout'],
    pt: ['os', 'as', 's\u00E3o', 'n\u00E3o', 'na', 'no', 'da', 'do', 'ele', 'ela'],
    de: ['der', 'die', 'das', 'und', 'ist', 'sind', 'nicht', 'ich', 'wir', 'mit'],
    it: ['il', 'la', 'gli', 'le', '\u00E8', 'sono', 'non', 'che', 'di', 'per'],
    nl: ['de', 'het', 'een', 'en', 'is', 'zijn', 'niet', 'van', 'voor', 'met'],
    pl: ['jest', 's\u0105', 'nie', 'si\u0119', 'tak', 'czy', 'ale', 'oraz', 'jak'],
    sv: ['\u00E4r', 'och', 'inte', 'det', 'att', 'f\u00F6r', 'p\u00E5', 'med', 'som'],
    da: ['er', 'og', 'ikke', 'det', 'at', 'for', 'p\u00E5', 'med', 'som'],
    tr: ['ve', 'ile', 'i\u00E7in', 'bir', 'bu', '\u015Fu', 'de\u011Fil', 'gibi'],
    vi: ['v\u00E0', 'l\u00E0', 'c\u1EE7a', 'kh\u00F4ng', 'm\u1ED9t', 'nh\u1EEFng', 'n\u00E0y'],
  }
  const words = n.match(/[\p{Letter}']+/gu) || []
  for (const word of words) {
    for (const [lang, wordList] of Object.entries(stopwords)) {
      if (wordList.includes(word)) scores[lang] += 3
    }
  }
  if (/\bthe\b/.test(n)) scores.en += 5
  if (/\b(el|los)\b/.test(n)) scores.es += 4
  if (/\b(le|les)\b/.test(n)) scores.fr += 4
  if (/\b(o|os)\b/.test(n)) scores.pt += 3
  if (/\b(der|die|das)\b/.test(n)) scores.de += 5

  let maxScore = 0; let detected: string | null = null
  for (const [lang, score] of Object.entries(scores)) { if (score > maxScore) { maxScore = score; detected = lang } }
  return maxScore >= 4 ? detected : null
}

// ── Public: Model Loading ─────────────────────────────────────
export async function loadAllModels(onProgress?: EngineProgressCallback): Promise<void> {
  if (isModelLoading || isModelLoaded()) return
  isModelLoading = true

  const emit = (e: EngineProgressEvent) => onProgress?.(e)

  try {
    const models = [
      { name: 'Duration Predictor', path: `${ONNX_BASE}/duration_predictor.onnx`, key: 'dp' as const },
      { name: 'Text Encoder', path: `${ONNX_BASE}/text_encoder.onnx`, key: 'textEnc' as const },
      { name: 'Vector Estimator', path: `${ONNX_BASE}/vector_estimator.onnx`, key: 'vectorEst' as const },
      { name: 'Vocoder', path: `${ONNX_BASE}/vocoder.onnx`, key: 'vocoder' as const },
    ]

    console.log(LOG, 'Loading models from:', ONNX_BASE)
    let loaded = 0
    const total = models.length

    for (const model of models) {
      console.log(LOG, `Loading ${model.name}:`, model.path)
      emit({ type: 'status', status: 'loading', progress: Math.round((loaded / total) * 100), text: `Loading ${model.name}...` })

      const session = await ort.InferenceSession.create(model.path, { executionProviders: ['wasm'] })
      console.log(LOG, `${model.name} loaded, inputs:`, session.inputNames)

      switch (model.key) {
        case 'dp': dpSession = session; break
        case 'textEnc': textEncSession = session; break
        case 'vectorEst': vectorEstSession = session; break
        case 'vocoder': vocoderSession = session; break
      }
      loaded++
      emit({ type: 'status', status: 'loading', progress: Math.round((loaded / total) * 100), text: `${model.name} loaded` })
    }

    // Load config
    emit({ type: 'status', status: 'loading', progress: 85, text: 'Loading config...' })
    console.log(LOG, 'Loading tts.json')
    const cfgsResp = await fetch(`${ONNX_BASE}/tts.json`)
    if (!cfgsResp.ok) throw new Error(`Config HTTP ${cfgsResp.status}`)
    cfgs = await cfgsResp.json()
    console.log(LOG, 'Config loaded')

    // Load unicode indexer
    emit({ type: 'status', status: 'loading', progress: 92, text: 'Loading text processor...' })
    console.log(LOG, 'Loading unicode_indexer.json')
    const idxResp = await fetch(`${ONNX_BASE}/unicode_indexer.json`)
    if (!idxResp.ok) throw new Error(`Indexer HTTP ${idxResp.status}`)
    unicodeIndexer = await idxResp.json()
    console.log(LOG, 'Unicode indexer loaded, keys:', Object.keys(unicodeIndexer).length)

    // Load voice styles
    emit({ type: 'status', status: 'loading', progress: 98, text: 'Loading voice styles...' })
    const voiceIds = AVAILABLE_VOICES.map((v) => v.id)
    const loadedVoices: string[] = []
    const failedVoices: string[] = []
    for (const voiceId of voiceIds) {
      const url = `${VOICE_BASE}/${voiceId}.json`
      console.log(LOG, 'Loading voice:', url)
      try {
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        voiceStyles[voiceId] = await resp.json()
        loadedVoices.push(voiceId)
        console.log(LOG, 'Voice loaded:', voiceId)
      } catch (err: any) {
        failedVoices.push(voiceId)
        console.error(LOG, `Failed to load voice ${voiceId}:`, err?.message)
      }
    }

    if (loadedVoices.length === 0) throw new Error('No voice styles loaded')
    emit({ type: 'ready', model: 'Supertone-3', loadedVoices, failedVoices })
  } catch (err: any) {
    emit({ type: 'error', error: err?.message || 'Failed to load models' })
    throw err
  } finally {
    isModelLoading = false
  }
}

// ── Public: Run Inference ─────────────────────────────────────
// Note: This implementation mirrors the working Supertonic-3 reference:
//   - No Euler integration — VE outputs the actual denoised latent per step.
//   - Pre-allocated Float32 buffer is reused across flow steps (perf).
//   - Step tensors are float32 with shape [bsz], not int64 [1].
//   - latent_mask is passed to VE (no post-vocoder re-mask needed).
//   - Vocoder output is trimmed by `Math.floor(sampleRate * durOnnx[0])`.
export async function runInference(
  text: string,
  voiceId: string,
  speed: number,
  numSteps: number,
  lang: string | null,
  onProgress?: EngineProgressCallback,
  signal?: AbortSignal,
): Promise<{ audio: Float32Array; sampleRate: number }> {
  const emit = (e: EngineProgressEvent) => onProgress?.(e)

  console.log(LOG, '====== runInference START ======')
  console.log(LOG, 'text:', text.substring(0, 80) + (text.length > 80 ? '...' : ''))
  console.log(LOG, 'voiceId:', voiceId, 'speed:', speed, 'numSteps:', numSteps, 'lang:', lang)

  // Defensive bounds for the engine API surface. The composable's setSpeed and
  // setQuality already clamp to valid ranges, but these guards make the engine
  // safe for direct programmatic use.
  const safeSpeed = Math.max(0.5, Math.min(2.0, speed))
  const safeNumSteps = Math.max(2, Math.min(16, Math.round(numSteps)))

  if (!dpSession || !textEncSession || !vectorEstSession || !vocoderSession || !cfgs) {
    throw new Error('Models not loaded')
  }

  const throwIfAborted = () => {
    if (signal?.aborted) {
      throw Object.assign(new Error('Synthesis cancelled'), { name: 'AbortError' })
    }
  }
  throwIfAborted()

  const bsz = 1

  // Step 0: Text preprocessing
  console.log(LOG, 'Step 0: Text preprocessing...')
  const processor = new UnicodeProcessor(unicodeIndexer)
  const { textIds, textMask, unsupportedChars } = processor.call([text], lang)
  // Match original behavior: throw on unsupported characters instead of
  // silently substituting them with index 0 (which would produce garbage audio).
  if (unsupportedChars && unsupportedChars.length > 0) {
    const charList = unsupportedChars.slice(0, 8).map((c) => `"${c}"`).join(', ')
    throw new Error(`Unsupported characters: ${charList}${unsupportedChars.length > 8 ? ` (+${unsupportedChars.length - 8} more)` : ''}`)
  }
  console.log(LOG, 'textIds length:', textIds[0].length)

  // Step 0.5: Build common tensors
  console.log(LOG, 'Step 0.5: Building tensors...')
  const textIdsShape: [number, number] = [bsz, textIds[0].length]
  const textMaskShape: [number, number, number] = [bsz, 1, textMask[0][0].length]
  const textIdsTensor = intArrayToTensor(textIds, textIdsShape)
  const textMaskTensor = arrayToTensor(textMask, textMaskShape)
  const styleTtlTensor = buildStyleTtlTensor(voiceId)
  const styleDpTensor = buildStyleDpTensor(voiceId)
  console.log(LOG, 'Tensors: textIds', textIdsTensor.dims, 'textMask', textMaskTensor.dims, 'style_ttl', styleTtlTensor.dims, 'style_dp', styleDpTensor.dims)

  // Step 1: Duration Prediction
  console.log(LOG, 'Step 1: Duration Prediction...')
  const dpInputs = buildInputs(dpSession, { text_ids: textIdsTensor, style_dp: styleDpTensor, text_mask: textMaskTensor })
  const dpOutput = await dpSession.run(dpInputs)
  const durTensor = (dpOutput.duration || dpOutput[dpSession.outputNames[0]]) as ort.Tensor
  const durOnnx = Array.from(durTensor.data as Float32Array)
  // Match the original's speed formula exactly: 1 / (speed + 0.05)
  const durationFactor = 1 / (safeSpeed + 0.05)
  for (let i = 0; i < durOnnx.length; i++) durOnnx[i] *= durationFactor
  const durReshaped: number[][][] = []
  for (let b = 0; b < bsz; b++) durReshaped.push([[durOnnx[b]]])
  console.log(LOG, 'DP output:', durationFactor.toFixed(3) + 'x factor, sum:', durOnnx.reduce((a, b) => a + b, 0).toFixed(3))

  // Step 2: Text Encoding
  console.log(LOG, 'Step 2: Text Encoding...')
  const textEncInputs = buildInputs(textEncSession, { text_ids: textIdsTensor, style_ttl: styleTtlTensor, text_mask: textMaskTensor })
  const textEncOutput = await textEncSession.run(textEncInputs)
  const textEmbTensor = (textEncOutput.text_emb || textEncOutput[textEncSession.outputNames[0]]) as ort.Tensor
  console.log(LOG, 'TextEnc output dims:', textEmbTensor.dims)

  // Step 3: Flow Matching (Vector Estimator)
  // Use pre-allocated Float32Array buffer; VE produces denoised_latent which
  // we copy directly into the buffer (NO Euler integration).
  console.log(LOG, 'Step 3: Flow Matching x' + safeNumSteps + '...')
  const { noisyLatent, latentMask } = sampleNoisyLatent(durReshaped, cfgs)
  const latentDim = noisyLatent[0].length
  const latentLen = noisyLatent[0][0].length
  const latentShape: [number, number, number] = [bsz, latentDim, latentLen]
  const latentMaskShape: [number, number, number] = [bsz, 1, latentMask[0][0].length]
  const latentMaskTensor = arrayToTensor(latentMask, latentMaskShape)

  // Pre-allocate flat buffer reused across all flow steps
  const latentBufferSize = bsz * latentDim * latentLen
  const latentBuffer = new Float32Array(latentBufferSize)
  let initIdx = 0
  for (let b = 0; b < bsz; b++) {
    for (let d = 0; d < latentDim; d++) {
      for (let t = 0; t < latentLen; t++) {
        latentBuffer[initIdx++] = noisyLatent[b][d][t]
      }
    }
  }

  // Pre-create step tensors as float32 with shape [bsz] (matches the original)
  const scalarShape: [number] = [bsz]
  const totalStepTensor = arrayToTensor(new Array(bsz).fill(safeNumSteps), scalarShape)
  const stepTensors: ort.Tensor[] = []
  for (let step = 0; step < safeNumSteps; step++) {
    stepTensors.push(arrayToTensor(new Array(bsz).fill(step), scalarShape))
  }

  const startTime = performance.now()
  for (let step = 0; step < safeNumSteps; step++) {
    throwIfAborted()
    // Wrap the (mutated) buffer as a new tensor view each step
    const noisyLatentTensor = new ort.Tensor('float32', latentBuffer, latentShape)

    const veInputs = buildInputs(vectorEstSession, {
      noisy_latent: noisyLatentTensor,
      text_emb: textEmbTensor,
      style_ttl: styleTtlTensor,
      text_mask: textMaskTensor,
      latent_mask: latentMaskTensor,
      total_step: totalStepTensor,
      current_step: stepTensors[step],
    })
    const veOutput = await vectorEstSession.run(veInputs)
    const denoisedTensor = (veOutput.denoised_latent || veOutput[vectorEstSession.outputNames[0]]) as ort.Tensor
    const denoisedData = denoisedTensor.data as Float32Array

    // DIRECT copy — VE already produced the denoised latent for this step
    latentBuffer.set(denoisedData)

    if (step === 0 || step === safeNumSteps - 1 || safeNumSteps <= 4) {
      console.log(LOG, `Flow step ${step + 1}/${safeNumSteps}: range ${Math.min(...denoisedData).toFixed(4)}..${Math.max(...denoisedData).toFixed(4)}`)
    }
    emit({ type: 'progress', progress: Math.round(((step + 1) / safeNumSteps) * 100), status: 'synthesizing' })
  }
  console.log(LOG, `Flow matching done in ${((performance.now() - startTime) / 1000).toFixed(1)}s`)

  // Step 4: Vocoding
  // The VE handles latent_mask internally; no post-flow mask needed.
  console.log(LOG, 'Step 4: Vocoding...')
  const finalLatentTensor = new ort.Tensor('float32', latentBuffer, latentShape)
  const vocoderInputs = buildInputs(vocoderSession, { latent: finalLatentTensor })
  const vocoderOutput = await vocoderSession.run(vocoderInputs)
  const wavTensor = (vocoderOutput.wav_tts || vocoderOutput[vocoderSession.outputNames[0]]) as ort.Tensor
  const wavBatch = wavTensor.data as Float32Array

  const sampleRate: number = cfgs.ae.sample_rate
  // Trim trailing silence: actual spoken length = sampleRate * duration
  const wavLen = Math.floor(sampleRate * durOnnx[0])
  const audioData = wavBatch.slice(0, wavLen)
  console.log(LOG, '====== runInference COMPLETE — audio:', (audioData.length / sampleRate).toFixed(1) + 's ======')

  return { audio: audioData, sampleRate }
}

// ── Public: TTS Orchestrator ──────────────────────────────────
export async function synthesize(
  text: string,
  options: { voiceId: string; speed: number; quality: number; language: string | null },
  onProgress?: EngineProgressCallback,
  signal?: AbortSignal,
): Promise<{ audio: Float32Array; sampleRate: number; wavBuffer: ArrayBuffer; duration: number; detectedLanguage: string | null }> {
  const voiceId = options.voiceId || engineVoiceId
  const speed = options.speed ?? 1.0
  const quality = Math.max(2, Math.min(16, options.quality ?? 8))
  const detectedLang = detectLanguage(text)
  const lang = options.language || detectedLang

  // Chunk long text so the model's fixed max sequence length (~1000 tokens)
  // is never exceeded. Each chunk gets its own language tag and runs through
  // the same ONNX pipeline; final audio is concatenated with a short silence
  // gap between chunks for natural prosody.
  // Done BEFORE mutating engineVoiceId so a chunking failure (e.g. empty
  // input) doesn't change the active voice.
  const MAX_CHUNK_CHARS = 500 // safely under the model's ~1000-token limit
  const chunks = splitIntoChunks(text, MAX_CHUNK_CHARS)
  if (chunks.length === 0) {
    throw new Error('No text to synthesize')
  }
  if (chunks.length > 1) {
    console.log(LOG, `Split text into ${chunks.length} chunks (${text.length} → ${chunks.reduce((s, c) => s + c.length, 0)} chars)`)
  }

  engineVoiceId = voiceId

  if (!signal?.aborted) onProgress?.({ type: 'progress', progress: 0, status: 'synthesizing' })

  const audioSegments: Float32Array[] = []
  let sampleRate = 44100

  for (let i = 0; i < chunks.length; i++) {
    if (signal?.aborted) {
      throw Object.assign(new Error('Synthesis cancelled'), { name: 'AbortError' })
    }
    // Per-chunk progress wrapper: maps inner flow-step progress (0..100) into
    // the chunk's slice of the overall progress range so the UI shows a
    // smooth bar across all chunks.
    const chunkBase = (i / chunks.length) * 100
    const chunkSpan = 100 / chunks.length
    const wrappedProgress = onProgress
      ? (e: EngineProgressEvent) => {
          if (e.type === 'progress' && e.progress !== undefined) {
            onProgress({
              ...e,
              progress: Math.round(chunkBase + (e.progress / 100) * chunkSpan),
              text: chunks.length > 1
                ? // English-only label; page-side UI ignores this field today
                  // and uses the smooth progress bar instead. Kept for future
                  // use (e.g. showing "Chunk N/M" beside the progress bar).
                  `Chunk ${i + 1}/${chunks.length}`
                : e.text,
            })
          }
          else {
            onProgress(e)
          }
        }
      : undefined

    const { audio, sampleRate: sr } = await runInference(
      chunks[i], voiceId, speed, quality, lang, wrappedProgress, signal,
    )
    sampleRate = sr
    audioSegments.push(audio)
  }

  // Concatenate chunks with ~0.15s silence between them for natural breaks.
  const audio = audioSegments.length === 1
    ? audioSegments[0]
    : concatenateAudio(audioSegments, sampleRate, 0.15)
  const wavBuffer = writeWavFile(audio, sampleRate)

  return {
    audio,
    sampleRate,
    wavBuffer,
    duration: audio.length / sampleRate,
    detectedLanguage: detectedLang,
  }
}

// ── Public: State Queries ─────────────────────────────────────
export function isModelLoaded(): boolean {
  return !!(dpSession && textEncSession && vectorEstSession && vocoderSession && cfgs)
}

export function getVoiceStyles(): Record<string, any> {
  return voiceStyles
}

export function getCurrentVoiceId(): string {
  return engineVoiceId
}

export function setEngineVoice(id: string): void {
  if (voiceStyles[id]) engineVoiceId = id
}


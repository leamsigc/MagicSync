import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface PiiMatch {
  type: string
  value: string
}

export interface PiiMapping {
  surrogate: string
  value: string
}

export const PII_MODEL_DIR = process.env.PII_MODEL_PATH
  ?? fileURLToPath(new URL('../../../../public/pii/', import.meta.url))

const PII_PATTERNS: Array<{ type: string, source: string }> = [
  { type: 'EMAIL', source: '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}' },
  { type: 'IBAN', source: '\\b[A-Z]{2}\\d{2}[A-Z0-9]{11,30}\\b' },
  { type: 'CARD', source: '\\b(?:\\d[ -]?){13,19}\\b' },
  { type: 'PHONE', source: '(?:\\+\\d{1,3}[ -]?)?(?:\\(\\d{2,4}\\)[ -]?)?\\d{3}[ -]?\\d{3,4}[ -]?\\d{3,4}\\b' },
]

const NER_ENTITY_MAP: Record<string, string> = {
  PER: 'PERSON',
  PERSON: 'PERSON',
  ORG: 'ORG',
  ORGANIZATION: 'ORG',
  LOC: 'LOCATION',
  LOCATION: 'LOCATION',
}

export function hasPiiModel(): boolean {
  return existsSync(join(PII_MODEL_DIR, 'onnx', 'model.onnx')) && existsSync(join(PII_MODEL_DIR, 'tokenizer.json'))
}

/** Private mode fails closed unless the ONNX model is present (or regex-only is explicitly allowed). */
export function isPiiReady(): boolean {
  return hasPiiModel() || process.env.PII_ALLOW_REGEX_ONLY === '1'
}

export function detectRegex(text: string): PiiMatch[] {
  const matches: PiiMatch[] = []
  for (const pattern of PII_PATTERNS) {
    const regex = new RegExp(pattern.source, 'g')
    for (const match of text.matchAll(regex)) {
      matches.push({ type: pattern.type, value: match[0] })
    }
  }
  return matches
}

export function anonymizeWithRegex(input: string, counters: Record<string, number> = {}): { text: string, mappings: PiiMapping[] } {
  let text = input
  const mappings: PiiMapping[] = []
  for (const pattern of PII_PATTERNS) {
    const regex = new RegExp(pattern.source, 'g')
    text = text.replace(regex, (value) => {
      counters[pattern.type] = (counters[pattern.type] ?? 0) + 1
      const surrogate = `[${pattern.type}_${counters[pattern.type]}]`
      mappings.push({ surrogate, value })
      return surrogate
    })
  }
  return { text, mappings }
}

export function restore(text: string, mappings: PiiMapping[]): string {
  let output = text
  for (const mapping of mappings) {
    output = output.replaceAll(mapping.surrogate, mapping.value)
  }
  return output
}

/** Cut point that never splits a surrogate token like `[EMAIL_1]` across chunks. */
export function safeCutPoint(text: string): number {
  const open = text.lastIndexOf('[')
  if (open === -1) return text.length
  return /^\[[A-Z_]*\d*$/.test(text.slice(open)) ? open : text.length
}

/** Streaming restorer: holds an incomplete trailing surrogate until the next delta. */
export class SurrogateRestorer {
  private buffer = ''
  private readonly mappings: PiiMapping[]

  constructor(mappings: PiiMapping[]) {
    this.mappings = mappings
  }

  push(delta: string): string {
    this.buffer += delta
    const cut = safeCutPoint(this.buffer)
    const ready = this.buffer.slice(0, cut)
    this.buffer = this.buffer.slice(cut)
    return restore(ready, this.mappings)
  }

  flush(): string {
    const rest = restore(this.buffer, this.mappings)
    this.buffer = ''
    return rest
  }
}

export interface NerEngine {
  detect: (text: string) => Promise<PiiMatch[]>
}

let nerPromise: Promise<NerEngine | null> | null = null

/** Load the ONNX NER pipeline once per process. Returns null when assets are absent. */
export function loadNerEngine(): Promise<NerEngine | null> {
  if (!hasPiiModel()) return Promise.resolve(null)
  nerPromise ??= (async () => {
    const { env, pipeline } = await import('@huggingface/transformers')
    env.localModelPath = PII_MODEL_DIR
    env.allowRemoteModels = false
    const classifier = await pipeline('token-classification', PII_MODEL_DIR, { dtype: 'fp32' })
    return {
      detect: async (text: string) => {
        const tokens = await classifier(text) as Array<{ entity?: string, entity_group?: string, score?: number, word?: string }>
        const matches: PiiMatch[] = []
        for (const token of tokens) {
          const label = NER_ENTITY_MAP[(token.entity_group ?? token.entity ?? '').replace(/^[BI]-/, '')]
          if (label && token.word && (token.score ?? 0) >= 0.85) matches.push({ type: label, value: token.word })
        }
        return matches
      },
    }
  })()
  return nerPromise
}

/** Regex + optional NER anonymization. NER runs only when its assets are present. */
export async function anonymize(input: string): Promise<{ text: string, mappings: PiiMapping[] }> {
  const regexPass = anonymizeWithRegex(input)
  const ner = await loadNerEngine()
  if (!ner) return regexPass

  const counters: Record<string, number> = {}
  let output = regexPass.text
  const mappings = [...regexPass.mappings]
  const entities = await ner.detect(output)
  for (const entity of entities) {
    if (mappings.some(mapping => mapping.value === entity.value)) continue
    counters[entity.type] = (counters[entity.type] ?? 0) + 1
    const surrogate = `[${entity.type}_${counters[entity.type]}]`
    output = output.replace(entity.value, surrogate)
    mappings.push({ surrogate, value: entity.value })
  }
  return { text: output, mappings }
}

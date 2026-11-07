// Shared helpers for the design-template-builder scripts.
// No dependencies: these scripts must run from a plain Node 20+ checkout.

export const DOCUMENT_SCHEMA = 'magicsync/image-editor@1'

export const FIELD_SUFFIXES = [
  'text',
  'image_url',
  'video_url',
  'color',
  'font_family',
  'font_size',
  'visible',
]

export const SUPPORTED_TYPES = new Set([
  'textbox',
  'rect',
  'circle',
  'triangle',
  'path',
  'polygon',
  'image',
  'group',
  'line',
])

export const SIZE_PRESETS = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  story: [1080, 1920],
  landscape: [1920, 1080],
  link: [1200, 628],
  youtube: [1280, 720],
}

export const BUNDLED_FONTS = new Set([
  'Archivo Black',
  'Anton',
  'Bebas Neue',
  'Lobster',
  'Pacifico',
  'Abril Fatface',
  'Righteous',
  'Alfa Slab One',
  'DejaVu Sans',
  'ZCOOL KuaiLe',
  'ZCOOL QingKe HuangYou',
  'Ma Shan Zheng',
  'Noto Sans SC',
])

export const GENERIC_FONTS = new Set([
  'Arial',
  'Helvetica',
  'Helvetica Neue',
  'sans-serif',
  'serif',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'system-ui',
])

/** Accept a raw document, `{ document }`, or a seeded `{ doc }` envelope. */
export function unwrapDocument(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Input must be a JSON object')
  }
  if (parsed.schema === DOCUMENT_SCHEMA) return parsed
  if (parsed.document && typeof parsed.document === 'object') return parsed.document
  if (parsed.doc && typeof parsed.doc === 'object') return parsed.doc
  throw new Error(`Input is not an image-editor document (expected schema "${DOCUMENT_SCHEMA}")`)
}

export async function readJson(path) {
  const text = path === '-'
    ? await new Promise((resolve, reject) => {
        let data = ''
        process.stdin.setEncoding('utf8')
        process.stdin.on('data', chunk => { data += chunk })
        process.stdin.on('end', () => resolve(data))
        process.stdin.on('error', reject)
      })
    : await import('node:fs/promises').then(fs => fs.readFile(path, 'utf8'))
  return JSON.parse(text)
}

/** Tiny argv parser: `--key value`, `--flag`, and positional values. */
export function parseArgs(argv) {
  const out = { _: [] }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      out._.push(token)
      continue
    }
    const key = token.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      out[key] = true
      continue
    }
    out[key] = next
    index += 1
  }
  return out
}

export function slugify(value) {
  return String(value ?? 'template')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'template'
}

export function apiBase(override) {
  return String(override ?? process.env.MAGICSYNC_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

/** Design HTTP routes accept a Bearer org_ key or the local session cookie. */
export function authHeaders(extra = {}) {
  const token = process.env.MAGICSYNC_API_TOKEN
  if (token) return { authorization: `Bearer ${token}`, ...extra }
  const cookie = process.env.MAGICSYNC_COOKIE
  if (cookie) return { cookie, ...extra }
  throw new Error(
    'Set MAGICSYNC_API_TOKEN (org_… key) for API calls, or MAGICSYNC_COOKIE for a local logged-in session.',
  )
}

export function parseSize(value) {
  const input = String(value ?? 'square').toLowerCase()
  if (SIZE_PRESETS[input]) return SIZE_PRESETS[input]
  const match = /^(\d{2,5})x(\d{2,5})$/.exec(input)
  if (!match) throw new Error(`Unknown size "${value}". Use square, portrait, story, landscape, link, youtube, or WIDTHxHEIGHT.`)
  return [Number(match[1]), Number(match[2])]
}

export function isHexColor(value) {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

export function hexToRgb(value) {
  if (!isHexColor(value)) return null
  let hex = value.trim().slice(1)
  if (hex.length === 3) hex = hex.split('').map(char => char + char).join('')
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  }
}

export function relativeLuminance(value) {
  const rgb = hexToRgb(value)
  if (!rgb) return null
  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const ratio = channel / 255
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

export function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground)
  const second = relativeLuminance(background)
  if (first === null || second === null) return null
  const light = Math.max(first, second)
  const dark = Math.min(first, second)
  return (light + 0.05) / (dark + 0.05)
}

export function walkObjects(objects, visit) {
  for (const object of objects ?? []) {
    if (!object || typeof object !== 'object') continue
    visit(object)
    if (Array.isArray(object.objects)) walkObjects(object.objects, visit)
  }
}

export async function ensureParent(path) {
  const { dirname } = await import('node:path')
  const { mkdir } = await import('node:fs/promises')
  await mkdir(dirname(path), { recursive: true })
}

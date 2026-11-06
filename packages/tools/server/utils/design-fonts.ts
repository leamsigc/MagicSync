import { registerFont } from 'canvas'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FONT_MANIFEST } from '../../shared/image-editor/fonts-manifest'

/**
 * Bundled font registration for the node renderer. Fabric/node + node-canvas
 * only see families passed to registerFont — every family named in a document
 * must resolve through FONT_MANIFEST (downloaded by `pnpm fonts:assets`) or
 * renders with Pango's fallback face.
 */

const here = dirname(fileURLToPath(import.meta.url))
/** packages/tools — the fonts asset dir hangs directly under it. */
const toolsRoot = resolve(here, '..', '..')

const registeredFamilies = new Set<string>()
const googleFontJobs = new Map<string, Promise<boolean>>()

export interface FontReport {
  registered: string[]
  missing: string[]
}

function fontDir(family: string): string {
  return join(toolsRoot, 'assets/fonts', family)
}

export async function registerDocumentFonts(families: Iterable<string>): Promise<FontReport> {
  const registered: string[] = []
  const missing: string[] = []
  for (const raw of families) {
    const family = typeof raw === 'string' ? raw.trim() : ''
    if (!family || registeredFamilies.has(family)) continue
    if (tryRegisterBundle(family) || await registerGoogleFamily(family)) {
      registeredFamilies.add(family)
      registered.push(family)
    } else {
      missing.push(family)
    }
  }
  return { registered, missing }
}

/**
 * Google Fonts ships TTF/OTF when the request uses a legacy user agent.
 * Download once per family, register it with node-canvas and cache the job.
 */
function parseGoogleFontSpecs(css: string) {
  return css.split('@font-face').slice(1).flatMap((block) => {
    const url = /url\((https:\/\/[^)]+\.(?:ttf|otf))\)/.exec(block)?.[1]
    if (!url) return []
    return [{
      url,
      weight: /font-weight:\s*(\d+)/.exec(block)?.[1] ?? '400',
      style: /font-style:\s*(\w+)/.exec(block)?.[1] ?? 'normal',
    }]
  })
}

async function installGoogleFont(
  family: string,
  spec: { url: string, weight: string, style: string },
  dir: string,
  index: number,
): Promise<void> {
  if (!spec.url.startsWith('https://fonts.gstatic.com/')) return
  const response = await fetch(spec.url, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) return
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length === 0) return
  const hash = createHash('sha1').update(spec.url).digest('hex').slice(0, 12)
  const extension = spec.url.endsWith('.otf') ? 'otf' : 'ttf'
  const path = join(dir, `${hash}-${index}.${extension}`)
  await writeFile(path, bytes)
  registerFont(path, { family, weight: spec.weight, style: spec.style })
}

function registerGoogleFamily(family: string): Promise<boolean> {
  const cached = googleFontJobs.get(family)
  if (cached) return cached
  const job = (async () => {
    try {
      const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replaceAll('%20', '+')}`
      const response = await fetch(cssUrl, {
        headers: { 'user-agent': 'Mozilla/4.0' },
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) return false
      const specs = parseGoogleFontSpecs(await response.text())
      if (specs.length === 0) return false
      const dir = join(tmpdir(), 'magicsync-fonts')
      await mkdir(dir, { recursive: true })
      for (const [index, spec] of specs.entries()) await installGoogleFont(family, spec, dir, index)
      return true
    } catch {
      return false
    }
  })()
  googleFontJobs.set(family, job)
  return job
}

function tryRegisterBundle(family: string): boolean {
  const entry = FONT_MANIFEST.find(candidate => candidate.family === family)
  if (!entry) return systemOrBundled(family)
  for (const file of entry.files) {
    const path = join(fontDir(family), file.file)
    if (!existsSync(path)) return false
    try {
      registerFont(path, { family, weight: String(file.weight), style: file.style })
    } catch {
      return false
    }
  }
  return true
}

/** DejaVu ships with the container (ttf-dejavu); other system faces resolv via fontconfig. */
function systemOrBundled(_family: string): boolean {
  return false
}

/** Families actually registered from the bundle (for X-Render-Fonts header). */
export function bundledFontFamilies(families: Iterable<string>): string[] {
  return [...new Set([...families])].filter(family => registeredFamilies.has(family))
}

/** Clear warnings for families that will render via Pango fallback. */
export function unknownFontWarnings(families: Iterable<string>): string[] {
  return [...new Set([...families])]
    .filter(family => family && !registeredFamilies.has(family))
    .map(family => `Font family "${family}" is not bundled; Pango fallback used`)
}

/**
 * Browser helpers for the Google Fonts catalog.
 *
 * The catalog is proxied by `/api/v1/image-editor/google-fonts` (CORS + cache).
 * A family is loaded on demand by injecting its stylesheet and awaiting
 * `document.fonts.load`, so the picker can list ~1,900 families without
 * downloading them all up front.
 */

export interface GoogleFontFamily {
  family: string
  category: string
}

let catalog: GoogleFontFamily[] | null = null
let pending: Promise<GoogleFontFamily[]> | null = null
const loadedFamilies = new Set<string>()

/** Normalise the Google Fonts category strings for our filters. */
export function googleCategoryKey(category: string): 'sans' | 'serif' | 'display' | 'handwriting' | 'mono' {
  const value = category.toLowerCase()
  if (value.includes('hand')) return 'handwriting'
  if (value.includes('display')) return 'display'
  if (value.includes('mono')) return 'mono'
  if (value.includes('serif') && !value.includes('sans')) return 'serif'
  return 'sans'
}

/** Fetch (and cache) the full Google Fonts family list. */
export async function googleFontFamilies(): Promise<GoogleFontFamily[]> {
  if (catalog) return catalog
  if (pending) return pending
  if (typeof window === 'undefined') return []

  pending = fetch('/api/v1/image-editor/google-fonts')
    .then(response => (response.ok ? response.json() : { families: [] }))
    .then((payload: { families?: GoogleFontFamily[] }) => {
      catalog = (payload.families ?? []).filter(entry => entry.family.length > 0)
      return catalog
    })
    .catch(() => {
      catalog = []
      return catalog
    })
    .finally(() => {
      pending = null
    })
  return pending
}

/** Inject a stylesheet and resolve once the browser has parsed its rules. */
function loadStylesheet(id: string, href: string): Promise<boolean> {
  const existing = document.getElementById(id) as HTMLLinkElement | null
  if (existing?.dataset.ready === '1') return Promise.resolve(true)
  return new Promise((resolve) => {
    const link = existing ?? document.createElement('link')
    const timeout = setTimeout(() => resolve(false), 5000)
    const settle = (ok: boolean) => {
      clearTimeout(timeout)
      if (ok) link.dataset.ready = '1'
      resolve(ok)
    }
    link.id = id
    link.rel = 'stylesheet'
    link.href = href
    link.onload = () => settle(true)
    link.onerror = () => settle(false)
    if (!existing) document.head.appendChild(link)
  })
}

/**
 * Load one family from the Google Fonts CDN.
 *
 * The stylesheet must be parsed before `document.fonts.load` can see its
 * @font-face rules — calling it right after appending the <link> resolves with
 * zero faces and the canvas silently falls back to a system font. Families
 * without a 700 face (Archivo Black, most display fonts) also get a plain
 * request, mirroring what the CSS2 API accepts.
 */
async function familyFacesReady(family: string): Promise<boolean> {
  try {
    const [regular] = await Promise.all([
      document.fonts.load(`400 16px "${family}"`),
      document.fonts.load(`700 16px "${family}"`).catch(() => []),
    ])
    return regular.length > 0
  } catch {
    return false
  }
}

/** Load one family from the Google Fonts CDN (weights 400 + 700). */
export async function loadGoogleFont(family: string): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!family) return false
  if (loadedFamilies.has(family)) return true

  const slug = family.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const base = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replaceAll('%20', '+')}`
  const parsed = await loadStylesheet(`gf-${slug}`, `${base}:wght@400;700&display=swap`)
  if (!parsed) await loadStylesheet(`gf-${slug}-plain`, `${base}&display=swap`)

  const ready = await familyFacesReady(family)
  if (ready) loadedFamilies.add(family)
  return ready
}

/** True when the family is available (bundled or already fetched). */
export function isFontReady(family: string): boolean {
  return loadedFamilies.has(family)
}

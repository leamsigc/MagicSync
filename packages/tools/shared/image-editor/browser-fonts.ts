import { FONT_MANIFEST } from './fonts-manifest'

/**
 * Browser-side font loading for the design editor. Fabric renders with
 * whatever families document.fonts has; bundled families live at
 * `/fonts/<family>/<file>` (downloaded by `pnpm fonts:assets`), so applying
 * a template first awaits these loads and text re-renders correctly.
 */

const loadedFamilies = new Set<string>()

/** Spaces in family names are significant in the public URL path. */
function familyUrl(family: string, file: string): string {
  return `/fonts/${encodeURIComponent(family).replaceAll('%20', ' ')}/${encodeURIComponent(file)}`
}

async function loadOne(family: string, file: string, weight: number, style: string): Promise<boolean> {
  try {
    const face = new FontFace(family, `url("${familyUrl(family, file)}")`, {
      weight: String(weight),
      style,
      display: 'swap',
    })
    await face.load()
    document.fonts.add(face)
    return true
  } catch {
    return false
  }
}

/**
 * Ensure the given font families are registered with document.fonts.
 * Returns the families that are now usable (bundled or already installed).
 */
export async function ensureBrowserFonts(families: Iterable<string>): Promise<string[]> {
  const wanted = [...new Set([...families])].filter(family => family && family.length > 0)
  const pending: Array<{ family: string; job: Promise<boolean> }> = []

  for (const family of wanted) {
    if (loadedFamilies.has(family)) continue
    const entry = FONT_MANIFEST.find(candidate => candidate.family === family)
    if (!entry) continue // system font (Arial, Helvetica...) — fabric uses it natively
    loadedFamilies.add(family)
    for (const file of entry.files) {
      pending.push({ family, job: loadOne(family, file.file, file.weight, file.style) })
    }
  }

  const results = await Promise.all(pending.map(entry => entry.job))
  const usable: string[] = []
  for (let index = 0; index < wanted.length; index += 1) {
    const family = wanted[index] ?? ''
    const wasBundled = FONT_MANIFEST.some(candidate => candidate.family === family)
    if (!wasBundled || loadedFamilies.has(family)) usable.push(family)
  }
  const failures = pending.filter((entry, index) => results[index] === false).map(entry => entry.family)
  if (failures.length > 0) loadedFamilies.clear()
  for (const family of new Set(failures)) loadedFamilies.delete(family)
  return usable
}

/** All bundled families not yet registered (used on editor mount). */
export async function loadAllBundledFonts(): Promise<string[]> {
  return ensureBrowserFonts(FONT_MANIFEST.map(entry => entry.family))
}

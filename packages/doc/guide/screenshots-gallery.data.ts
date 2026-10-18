import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCREENSHOTS_DIR = join(__dirname, '..', 'public', 'img', 'screenshots')

interface RouteShots {
  slug: string
  desktop: string | null
  mobile: string | null
}

export default {
  load(): RouteShots[] {
    if (!existsSync(SCREENSHOTS_DIR)) return []
    const slugs = readdirSync(SCREENSHOTS_DIR).filter((name) => {
      const p = join(SCREENSHOTS_DIR, name)
      return statSync(p).isDirectory()
    }).sort()

    return slugs.map((slug) => {
      const dir = join(SCREENSHOTS_DIR, slug)
      const files = readdirSync(dir)
      const desktop = files.find((f) => f === 'page.png') ? `img/screenshots/${slug}/page.png` : null
      const mobile = files.find((f) => f === 'page-mobile.png') ? `img/screenshots/${slug}/page-mobile.png` : null
      return { slug, desktop, mobile }
    }).filter((r) => r.desktop || r.mobile)
  },
}
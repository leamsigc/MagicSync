/**
 * Render still frames from the promo scene so the design can be reviewed
 * without producing a full video.
 *
 *   node motion/devnull-promo/preview.mjs 0 3.5 8 15 21 26 31 40
 */
import { chromium } from '@playwright/test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const scene = pathToFileURL(join(here, 'scene.html')).href
const outDir = join(here, '.preview')
mkdirSync(outDir, { recursive: true })

const times = process.argv.slice(2).map(Number)
if (!times.length) times.push(0, 4, 8, 15, 21, 26, 31, 40)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
page.on('console', (m) => console.log('[page]', m.type(), m.text()))
page.on('pageerror', (e) => console.log('[pageerror]', e.message))

await page.goto(scene, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
await page.waitForFunction(() => typeof window.__seek === 'function')

for (const t of times) {
  await page.evaluate((tt) => window.__seek(tt), t * 1000)
  const file = join(outDir, `t${String(t).replace('.', '_')}.png`)
  await page.screenshot({ path: file })
  console.log('wrote', file)
}

await browser.close()

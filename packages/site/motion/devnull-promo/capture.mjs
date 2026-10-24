/**
 * Capture the promo scene as a video.
 *
 * The scene is fully deterministic: `window.__seek(ms)` sets every animation's
 * currentTime and recomputes all JS-driven motion, so frame N is always the
 * same image. Frames are piped straight into ffmpeg — no intermediate PNGs on
 * disk.
 *
 *   node motion/devnull-promo/capture.mjs             # full render (jpeg frames)
 *   node motion/devnull-promo/capture.mjs --png       # lossless frames (slow)
 *   node motion/devnull-promo/capture.mjs --preview   # 1s around the CTA
 */
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { mkdirSync, statSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const scene = pathToFileURL(join(here, 'scene.html')).href
const outDir = resolve(here, '../../../doc/public/video')
mkdirSync(outDir, { recursive: true })

const preview = process.argv.includes('--preview')
const lossless = process.argv.includes('--png')
const master = join(outDir, 'magicsync-dev-null-sh.mp4')

/* ---------- ffmpeg sink ---------- */
const ff = spawn('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-f', 'image2pipe', '-vcodec', lossless ? 'png' : 'mjpeg', '-framerate', '30', '-i', '-',
  '-an',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '19',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  master,
], { stdio: ['pipe', 'inherit', 'inherit'] })

ff.stdin.on('error', () => {})
const write = (buf) => new Promise((res, rej) => {
  if (ff.stdin.write(buf)) return res()
  ff.stdin.once('drain', res)
  ff.stdin.once('error', rej)
})

const ffDone = new Promise((res, rej) => {
  ff.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`))))
})

/* ---------- browser ---------- */
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.error('[pageerror]', e.message))

await page.goto(scene, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
await page.waitForFunction(() => typeof window.__seek === 'function')

const DUR = await page.evaluate(() => window.__DUR)
const FPS = await page.evaluate(() => window.__FPS)
const total = Math.round(DUR * FPS)
const from = preview ? Math.round(38 * FPS) : 0
const to = preview ? Math.round(39 * FPS) : total

const shot = () => page.screenshot(
  lossless
    ? { type: 'png' }
    : { type: 'jpeg', quality: 95, chromaSubsampling: '4:4:4' },
)

console.log(`capturing frames ${from}..${to} of ${total} (${DUR}s @ ${FPS}fps, ${lossless ? 'png' : 'jpeg q95'})`)
const started = Date.now()

for (let i = from; i < to; i++) {
  await page.evaluate((t) => window.__seek(t), (i * 1000) / FPS)
  await write(await shot())
  if (i % 60 === 0) {
    const rate = (i - from + 1) / ((Date.now() - started) / 1000)
    console.log(`  ${i}/${to}  ${rate.toFixed(1)} fps  eta ${((to - i) / rate).toFixed(0)}s`)
  }
}

ff.stdin.end()
await ffDone
await browser.close()

const kb = (statSync(master).size / 1024).toFixed(0)
console.log(`done → ${master} (${kb} KB) in ${((Date.now() - started) / 1000).toFixed(0)}s`)

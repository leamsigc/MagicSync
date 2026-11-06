/**
 * Download the bundled design-studio fonts into both the node-render asset
 * dir and the site public dir. Run with `pnpm fonts:assets` (repo root) or
 * `node packages/tools/scripts/download-fonts.mjs`.
 *
 * Idempotent: existing files are kept. Failures are collected, never fatal —
 * missing families fall back to system fonts at render time.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..')
const assetsDir = join(repoRoot, 'packages/tools/assets/fonts')
const publicDir = join(repoRoot, 'packages/site/public/fonts')

/** Entry list duplicated from fonts-manifest.ts (the script runs without bundler aliases). */
const FONTS = [
  ['ZCOOL KuaiLe', 'ZCOOLKuaiLe-Regular.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf'],
  ['ZCOOL QingKe HuangYou', 'ZCOOLQingKeHuangYou-Regular.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/zcoolqingkehuangyou/ZCOOLQingKeHuangYou-Regular.ttf'],
  ['Ma Shan Zheng', 'MaShanZheng-Regular.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/MaShanZheng-Regular.ttf'],
  ['Noto Sans SC', 'NotoSansSC-Regular.otf', 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/Mono/NotoSansSC-Regular.otf'],
  ['DejaVu Sans', 'DejaVuSans.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosans/NotoSans%5Bwdth%2Cwght%5D.ttf'],
  ['Archivo Black', 'ArchivoBlack-Regular.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/archivoblack/ArchivoBlack-Regular.ttf'],
  ['Anton', 'Anton-Regular.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/anton/Anton-Regular.ttf'],
  ['Bebas Neue', 'BebasNeue-Regular.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/bebasneue/BebasNeue-Regular.ttf'],
  ['Lobster', 'Lobster-Regular.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/lobster/Lobster-Regular.ttf'],
  ['Pacifico', 'Pacifico-Regular.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/pacifico/Pacifico-Regular.ttf'],
  ['Abril Fatface', 'AbrilFatface-Regular.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/abrilfatface/AbrilFatface-Regular.ttf'],
  ['Righteous', 'Righteous-Regular.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/righteous/Righteous-Regular.ttf'],
  ['Alfa Slab One', 'AlfaSlabOne-Regular.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/alfaslabone/AlfaSlabOne-Regular.ttf'],
]

async function downloadOne([family, file, url]) {
  const targets = [join(assetsDir, family, file), join(publicDir, family, file)]
  for (const target of targets) {
    try {
      await readFile(target)
      return
    } catch {
      // not cached yet — continue to fetch below
    }
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${family}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length < 5_000) throw new Error(`Suspiciously small font for ${family} (${bytes.length} bytes)`)
  for (const folder of new Set(targets.map(target => dirname(target)))) {
    await mkdir(folder, { recursive: true })
  }
  for (const target of targets) await writeFile(target, bytes)
}

const results = await Promise.allSettled(FONTS.map(downloadOne))
const failed = results.filter(r => r.status === 'rejected')
for (const [index, result] of results.entries()) {
  if (result.status === 'rejected') console.error(`[fonts] ${FONTS[index][0]}: ${String(result.reason)}`)
}
console.log(`[fonts] done — ${results.length - failed.length}/${results.length} families present`)

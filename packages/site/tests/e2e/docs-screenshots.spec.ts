import { test } from '@playwright/test'
import { mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const shotDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../doc/public/img/guide')
mkdirSync(shotDir, { recursive: true })

const pages: Array<{ path: string; file: string }> = [
  { path: '/tools', file: 'tools-index.png' },
  { path: '/tools/audio-player', file: 'tool-audio-player.png' },
  { path: '/tools/audio-transcription', file: 'tool-audio-transcription.png' },
  { path: '/tools/carousel-creator', file: 'tool-carousel-creator.png' },
  { path: '/tools/flutter-clipper', file: 'tool-flutter-clipper.png' },
  { path: '/tools/image-editor', file: 'tool-image-editor.png' },
  { path: '/tools/menu-board', file: 'tool-menu-board.png' },
  { path: '/tools/og-image-generator', file: 'tool-og-image-generator.png' },
  { path: '/tools/podcast', file: 'tool-podcast.png' },
  { path: '/tools/text-behind-image-free', file: 'tool-text-behind-image.png' },
  { path: '/tools/video-silence-remover', file: 'tool-video-silence-remover.png' },
]

test.use({
  viewport: { width: 1440, height: 900 },
  launchOptions: { args: ['--disable-dev-shm-usage'] },
})

test('docs screenshots for public tool pages', async ({ page }) => {
  test.setTimeout(300000)
  const failures: string[] = []
  for (const { path, file } of pages) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 90000 })
      await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {})
      await page.waitForTimeout(3000)
      await page.addStyleTag({
        content:
          '#vue-tracer-overlay,nuxt-devtools-frame,nuxt-devtools-inspect-panel,#__nuxt-devtools__{display:none!important}',
      })
      await page.screenshot({ path: resolve(shotDir, file), animations: 'disabled', timeout: 60000 })
    } catch (error) {
      failures.push(`${path}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (failures.length > 0) throw new Error(`Screenshot failures:\n${failures.join('\n')}`)
})

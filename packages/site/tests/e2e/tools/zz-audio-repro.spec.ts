import { test, expect } from '../fixtures'
import { blockHeavyAssets, waitForHydration } from '../helpers/e2e-utils'

/** 10s mono 8kHz sine WAV. */
function makeWavBuffer(seconds = 10): Buffer {
  const sampleRate = 8000
  const numSamples = sampleRate * seconds
  const dataSize = numSamples * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  for (let i = 0; i < numSamples; i++) {
    buffer.writeInt16LE(Math.round(Math.sin(i / 20) * 5000), 44 + i * 2)
  }
  return buffer
}

async function exportWithFps(page: any, fps: 30 | 60, tag: string) {
  await page.getByTestId('section-export-toggle').click()
  await page.getByTestId('btn-animate').click()
  await expect(page.getByRole('heading', { name: /animate & export/i })).toBeVisible()

  // fps select
  await page.locator('button[data-testid="animate-fps"]').click()
  await page.getByRole('option', { name: `${fps} fps` }).click()

  // duration 2s
  await page.locator('button[data-testid="animate-duration"]').click()
  await page.getByRole('option', { name: '2s' }).click()

  // music
  const wav = makeWavBuffer(10)
  await page.locator('input[data-testid="animate-music-input"]').setInputFiles({
    name: 'tune.wav', mimeType: 'audio/wav', buffer: wav,
  })
  await expect(page.locator('button[data-testid="btn-choose-music"]')).toContainText('tune.wav')

  const downloadPromise = page.waitForEvent('download', { timeout: 300000 })
  await page.locator('button[data-testid="btn-animate-render"]').click()
  await expect(page.getByTestId('btn-animate-download')).toBeVisible({ timeout: 300000 })
  const download = await downloadPromise
  const path = `/tmp/opencode/carousel-${tag}.mp4`
  await download.saveAs(path)
  console.log(`SAVED-${tag}:`, path)
}

test('repro audio cutoff at 30fps', async ({ page }) => {
  test.setTimeout(600000)
  await blockHeavyAssets(page)
  await page.goto('/tools/carousel-creator')
  await waitForHydration(page)
  await page.waitForSelector('#carousel-export-stage', { timeout: 30000 })
  await exportWithFps(page, 30, 'fps30')
})

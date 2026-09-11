import { test, expect } from './fixtures'
import { blockHeavyAssets, waitForHydration } from './helpers/e2e-utils'

/**
 * End-to-end tests for the public tools hub and every free tool page
 * served by the unified site: /tools, flutter-clipper,
 * video-silence-remover, text-behind-image-free, audio-player, podcast.
 */

test.describe('Tools hub (/tools)', () => {
  test('lists every tool with a working link', async ({ page }) => {
    await page.goto('/tools')
    await waitForHydration(page)

    const expectedTools = [
      ['Image Editor', '/tools/image-editor'],
      ['Flutter clipper', '/tools/flutter-clipper'],
      ['Video Silence Remover', '/tools/video-silence-remover'],
      ['Text Behind Image Free', '/tools/text-behind-image-free'],
      ['Audio Transcription', '/tools/audio-transcription'],
      ['Audio Player', '/tools/audio-player'],
      ['Podcast Player', '/tools/podcast'],
      ['Video Cropper', '/app/tools/video-cropper'],
    ] as const

    for (const [title, path] of expectedTools) {
      // Cards use the stretched-link pattern: the <a> itself has a zero box
      // while an inner absolute span is the real click target.
      await expect(page.locator(`a[href="${path}"]`).first()).toBeAttached()
      await expect(page.getByRole('heading', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first()).toBeVisible()
    }
  })
})

test.describe('Flutter Clipper', () => {
  test.beforeEach(async ({ page }) => {
    await blockHeavyAssets(page)
    await page.goto('/tools/flutter-clipper')
    await waitForHydration(page)
  })

  test('renders the clipper editor', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /clipper/i })).toBeVisible()
  })

  test('shows code output or editor controls', async ({ page }) => {
    // Editor exposes at minimum a preview/code area
    const body = page.locator('body')
    await expect(body).toContainText(/clip/i)
  })

  test('page title is set', async ({ page }) => {
    await expect(page).toHaveTitle(/.+/)
  })
})

test.describe('Video Silence Remover', () => {
  test.beforeEach(async ({ page }) => {
    await blockHeavyAssets(page)
    await page.goto('/tools/video-silence-remover')
    await waitForHydration(page)
  })

  test('renders upload zone and processing controls', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('input[type="file"]').first()).toBeAttached()
  })

  test('exposes silence threshold configuration', async ({ page }) => {
    // Threshold controls only render once a video is selected
    const mp4 = Buffer.from(
      'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAABJttb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAAA',
      'base64',
    )
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'clip.mp4', mimeType: 'video/mp4', buffer: mp4 })

    await expect(page.getByText(/threshold/i).first()).toBeVisible()
  })

  test('offers screen recording option', async ({ page }) => {
    await expect(page.getByRole('button', { name: /record/i }).first()).toBeVisible()
  })
})

test.describe('Text Behind Image Free', () => {
  test.beforeEach(async ({ page }) => {
    await blockHeavyAssets(page)
    await page.goto('/tools/text-behind-image-free')
    await waitForHydration(page)
  })

  test('renders the editor heading', async ({ page }) => {
    // Default view is the upload/landing state; the fabric editor only
    // mounts after an image has been processed.
    await expect(page.getByRole('heading', { name: /drag & drop a image/i })).toBeVisible({ timeout: 15000 })
  })

  test('provides image upload control', async ({ page }) => {
    await expect(page.locator('input[type="file"]').first()).toBeAttached()
  })

  // The overlay-text textarea lives inside the fabric editor, which only
  // mounts after a client-side ML background removal run — not reachable
  // in the offline E2E environment. TODO: revisit with a mocked pipeline.
  test.fixme('provides text input for the overlay text', async ({ page }) => {
    await expect(page.locator('input[type="text"], textarea').first()).toBeAttached()
  })
})

test.describe('Audio Player', () => {
  /** Minimal valid WAV file: 44-byte header + 800 samples of silence-ish PCM. */
  function makeWavBuffer(): Buffer {
    const sampleRate = 8000
    const numSamples = 8000 // 1 second
    const dataSize = numSamples * 2
    const buffer = Buffer.alloc(44 + dataSize)

    buffer.write('RIFF', 0)
    buffer.writeUInt32LE(36 + dataSize, 4)
    buffer.write('WAVE', 8)
    buffer.write('fmt ', 12)
    buffer.writeUInt32LE(16, 16) // fmt chunk size
    buffer.writeUInt16LE(1, 20) // PCM
    buffer.writeUInt16LE(1, 22) // mono
    buffer.writeUInt32LE(sampleRate, 24)
    buffer.writeUInt32LE(sampleRate * 2, 28) // byte rate
    buffer.writeUInt16LE(2, 32) // block align
    buffer.writeUInt16LE(16, 34) // bits per sample
    buffer.write('data', 36)
    buffer.writeUInt32LE(dataSize, 40)
    for (let i = 0; i < numSamples; i++) {
      buffer.writeInt16LE(Math.round(Math.sin(i / 10) * 5000), 44 + i * 2)
    }
    return buffer
  }

  test.beforeEach(async ({ page }) => {
    await blockHeavyAssets(page)
    await page.goto('/tools/audio-player')
    await waitForHydration(page)
  })

  test('renders empty state prompting for a file', async ({ page }) => {
    await expect(page.getByText('Upload an audio file to get started')).toBeVisible()
  })

  test('uploading a WAV shows the file card with name and size', async ({ page }) => {
    const wav = makeWavBuffer()
    await page.setInputFiles('input[type="file"][accept="audio/*"]', {
      name: 'test-tone.wav',
      mimeType: 'audio/wav',
      buffer: wav,
    })

    await expect(page.getByText('test-tone.wav')).toBeVisible()
    // ~0.06 MB — size is displayed in MB with 2 decimals
    await expect(page.getByText(/\d+\.\d{2} MB/)).toBeVisible()
  })

  test('uploaded file activates the waveform player', async ({ page }) => {
    const wav = makeWavBuffer()
    await page.setInputFiles('input[type="file"][accept="audio/*"]', {
      name: 'tone.wav',
      mimeType: 'audio/wav',
      buffer: wav,
    })

    // Player replaces the empty state
    await expect(page.getByText('Upload an audio file to get started')).not.toBeVisible()
    await expect(page.locator('audio').first()).toBeAttached({ timeout: 10000 })
  })

  test('clear button removes the selected file', async ({ page }) => {
    const wav = makeWavBuffer()
    await page.setInputFiles('input[type="file"][accept="audio/*"]', {
      name: 'tone.wav',
      mimeType: 'audio/wav',
      buffer: wav,
    })
    await expect(page.getByText('tone.wav')).toBeVisible()

    // The X (icon-only) button inside the file card
    await page.locator('button[data-testid="audio-clear-file"]').click()

    await expect(page.getByText('Upload an audio file to get started')).toBeVisible()
  })
})

test.describe('Podcast player search', () => {
  test.beforeEach(async ({ page }) => {
    await blockHeavyAssets(page)
    // Fresh context → IndexedDB favorites are empty
    await page.goto('/tools/podcast')
    await waitForHydration(page)
  })

  test('renders search input and feature hints when no search yet', async ({ page }) => {
    await expect(page.getByTestId('podcast-search-input')).toBeVisible()
    await expect(page.getByText(/search/i).first()).toBeVisible()
  })

  test('searching calls the API and renders results', async ({ page }) => {
    await page.route('**/api/v1/podcast/search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{
            collectionId: 111,
            collectionName: 'E2E Tech Podcast',
            artistName: 'E2E Author',
            artworkUrl600: '',
            feedUrl: 'https://example.com/feed.rss',
          }],
        }),
      })
    })

    await page.getByTestId('podcast-search-input').fill('tech')
    await expect(page.getByTestId('podcast-results')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('E2E Tech Podcast')).toBeVisible()
    await expect(page.getByText('E2E Author')).toBeVisible()
  })

  test('shows a friendly message when search finds nothing', async ({ page }) => {
    await page.route('**/api/v1/podcast/search*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) }))

    await page.getByTestId('podcast-search-input').fill('zzzz-no-match')
    await expect(page.getByTestId('podcast-no-results')).toBeVisible({ timeout: 10000 })
  })

  test('search failure surfaces an error toast instead of crashing', async ({ page }) => {
    await page.route('**/api/v1/podcast/search*', route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: true }) }))

    await page.getByTestId('podcast-search-input').fill('anything')
    await expect(page.getByText('Search Unavailable', { exact: true })).toBeVisible({ timeout: 10000 })
    // Empty state remains intact
    await expect(page.locator('main, .max-w-3xl').first()).toBeVisible()
  })
})

test.describe('Audio Transcription hub', () => {
  test.beforeEach(async ({ page }) => {
    await blockHeavyAssets(page)
    await page.goto('/tools/audio-transcription')
    await waitForHydration(page)
  })

  test('renders title, description and drop zone', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/transcription/i)
    await expect(page.locator('input[type="file"]').first()).toBeAttached()
  })

  test('model selector offers transcription models', async ({ page }) => {
    // DropZone includes model selection UI
    await expect(page.locator('body')).toContainText(/model/i)
  })
})

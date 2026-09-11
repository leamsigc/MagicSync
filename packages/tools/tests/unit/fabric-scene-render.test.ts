import { describe, expect, it } from 'vitest'
import { renderSceneToPng } from '../../server/utils/fabric-scene-render'

// Task 1.5 — real fabric/node + node-canvas render, no mocks. The $fetch
// global is never touched: fixtures use data: URLs (direct) or denied hosts
// (rejected before any fetch).

const RED_DOT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function pngDimensions(png: Buffer): { width: number, height: number } {
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}

describe('renderSceneToPng', () => {
  it('renders bg + text + image to a 1080x1350 PNG and skips descriptors', async () => {
    const result = await renderSceneToPng({
      width: 1080,
      height: 1350,
      objects: [
        { type: 'Rect', left: 0, top: 0, width: 1080, height: 1350, fill: '#0f0e0d' },
        { type: 'Textbox', left: 96, top: 500, width: 888, text: 'Server says hi', fontFamily: 'Inter', fontSize: 96, fill: '#fafaf9' },
        { type: 'Image', left: 96, top: 100, width: 200, height: 200, src: RED_DOT },
        { type: 'ScenePattern', key: 'dots', color: '#fff', opacity: 0.08 },
      ],
    })
    expect(result.png.length).toBeGreaterThan(10000)
    expect(result.rendered).toBe(3)
    expect(result.skipped).toBe(1)
    expect(result.fontsRequested).toContain('Inter')
    expect(pngDimensions(result.png)).toEqual({ width: 1080, height: 1350 })
  })

  it('denies non-allowlisted remote images without failing', async () => {
    const result = await renderSceneToPng({
      width: 1080,
      height: 1350,
      objects: [
        { type: 'Rect', left: 0, top: 0, width: 1080, height: 1350, fill: '#0f0e0d' },
        { type: 'Image', left: 0, top: 0, width: 100, height: 100, src: 'https://evil.example.com/x.png' },
      ],
    })
    expect(result.rendered).toBe(1)
    expect(result.skipped).toBe(1)
    expect(pngDimensions(result.png)).toEqual({ width: 1080, height: 1350 })
  })

  it('paints a converted legacy slide end to end', async () => {
    const { convertLegacySlide } = await import('../../shared/carousel-scene/html-convert')
    const { slideToFabricScene } = await import('../../shared/carousel-scene/scene')
    const palette = { bg: '#0f0e0d', text: '#fafaf9', accent: '#f97316' }
    const layers = convertLegacySlide('title-kicker', {
      kicker: 'THE HOOK',
      headline: 'Server parity',
      body: 'Same builders as the browser stage.',
    }, palette, { frameH: 1350, index: 0, total: 1 })
    const scene = slideToFabricScene(layers as never, { height: 1350, palette })
    const result = await renderSceneToPng({ width: 1080, height: 1350, objects: scene.objects })
    expect(result.rendered).toBeGreaterThan(3)
    expect(result.skipped).toBe(0)
    expect(pngDimensions(result.png)).toEqual({ width: 1080, height: 1350 })
  })
})

import { StaticCanvas } from 'fabric'
import { bindDocument } from './bind-fields'
import type { ImageEditorDocument } from './document'
import { documentPagesFonts } from './font-helpers'
import { ensureBrowserFonts } from './browser-fonts'
import { loadGoogleFont } from './google-fonts'

/**
 * Browser-side renderer for the anonymous bulk flow.
 *
 * Mirrors the server renderer: clone the document, bind one row, load the page
 * into an offscreen fabric StaticCanvas and export a data URL. Signed-in users
 * still generate on the server; guests never upload a document or values.
 */

export interface ClientRenderOptions {
  row?: Record<string, string | number | boolean>
  page?: number
  format?: 'png' | 'jpeg'
  quality?: number
  scale?: number
}

const MAX_DIM = 4096

export async function renderDocumentRow(doc: ImageEditorDocument, options: ClientRenderOptions = {}): Promise<string> {
  if (typeof document === 'undefined') throw new Error('Client renderer requires a browser')

  // JSON clone: the doc may be a Vue reactive proxy, which structuredClone rejects.
  const clone = JSON.parse(JSON.stringify(doc)) as ImageEditorDocument
  if (options.row) bindDocument(clone, { row: options.row })

  const pageIndex = Math.max(0, Math.min(options.page ?? 0, clone.pages.length - 1))
  const page = clone.pages[pageIndex]
  if (!page) throw new Error('Template has no page to render')

  const families = documentPagesFonts(clone)
  // Never let a slow font CDN stall generation: bundled fonts resolve locally,
  // Google fonts get a short grace period and then the system fallback renders.
  const fonts = Promise.all([
    ensureBrowserFonts(families),
    ...families.map(family => loadGoogleFont(family)),
  ]).catch(() => [])
  await Promise.race([
    fonts,
    new Promise(resolve => setTimeout(resolve, 4000)),
  ])

  const scale = Math.min(4, Math.max(0.1, options.scale ?? 1))
  const width = Math.min(MAX_DIM, Math.round(clone.frame.width * scale))
  const height = Math.min(MAX_DIM, Math.round(clone.frame.height * scale))
  const background = page.background?.fill ?? clone.frame.fill

  const element = document.createElement('canvas')
  const canvas = new StaticCanvas(element, {
    width,
    height,
    renderOnAddRemove: false,
    backgroundColor: typeof background === 'string' ? background : '#ffffff',
  })
  canvas.setViewportTransform([scale, 0, 0, scale, 0, 0])

  try {
    const objects = (page.objects ?? [])
      .filter(object => object.visible !== false)
      .map(object => ({
        originX: 'left',
        originY: 'top',
        ...(object.type === 'image' ? { crossOrigin: 'anonymous' } : {}),
        ...object,
      }))
    await canvas.loadFromJSON({ version: '7.0.0', objects, background: typeof background === 'string' ? background : '#ffffff' })
    canvas.renderAll()
    return canvas.toDataURL({ format: options.format ?? 'png', quality: options.quality ?? 0.92, multiplier: 1 })
  } finally {
    canvas.dispose()
  }
}

/** Trigger a browser download for a data URL (one file per generated row). */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  if (typeof document === 'undefined') return
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

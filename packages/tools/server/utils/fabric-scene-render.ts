import type { FabricObjectJson } from '../../shared/carousel-scene/scene'
import { buildImageObject, buildSyncObject } from '../../shared/carousel-scene/fabric-build'

/**
 * Server-side fabric scene renderer (Task 1.5).
 *
 * Same builders as the browser stage (`shared/carousel-scene/fabric-build`),
 * backed by `fabric/node` + node-canvas. Remote images are allowlisted
 * (data: URLs, the app origin, known stock CDNs) — anything else is skipped,
 * never fetched (SSRF guard). Fonts fall back to system faces; requested
 * families are reported (never fatal) so callers can spot mismatches.
 */

export interface SceneRenderInput {
  width: number
  height: number
  objects: FabricObjectJson[]
}

export interface SceneRenderResult {
  png: Buffer
  rendered: number
  skipped: number
  fontsRequested: string[]
}

const ALLOWED_IMAGE_HOSTS = new Set(['picsum.photos', 'images.unsplash.com', 'images.pexels.com'])

const DATA_IMAGE_RE = /^data:image\/(png|jpeg|webp|gif);base64,/i

function appHostname(): string {
  try {
    const raw = process.env.NUXT_APP_URL ?? 'http://localhost:3000'
    return new URL(raw).hostname
  } catch {
    return 'localhost'
  }
}

function parseHttpUrl(src: string): URL | null {
  try {
    const url = new URL(src)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url
  } catch {
    return null
  }
}

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_IMAGE_HOSTS.has(hostname) || hostname === appHostname() || hostname === 'localhost' || hostname === '127.0.0.1'
}

async function toAllowedDataUrl(src: string): Promise<string | null> {
  if (DATA_IMAGE_RE.test(src)) return src
  const url = parseHttpUrl(src)
  if (!url) return null
  if (!isAllowedHost(url.hostname)) return null
  try {
    const response = await $fetch.raw(src, { responseType: 'arrayBuffer', timeout: 15000 })
    const mime = String(response.headers.get('content-type') ?? 'image/png').split(';')[0]
    return `data:${mime};base64,${Buffer.from(response._data as ArrayBuffer).toString('base64')}`
  } catch {
    return null
  }
}

export async function renderSceneToPng(scene: SceneRenderInput): Promise<SceneRenderResult> {
  const F = await import('fabric/node')
  const canvas = new F.StaticCanvas(null, { width: scene.width, height: scene.height, renderOnAddRemove: false })
  let rendered = 0
  let skipped = 0
  const fonts = new Set<string>()
  try {
    for (const obj of scene.objects) {
      if (typeof obj.fontFamily === 'string' && obj.fontFamily) fonts.add(obj.fontFamily)
      const built = obj.type === 'Image'
        ? await buildImageObject(F, obj, scene.width, async (src: string) => {
          const dataUrl = await toAllowedDataUrl(src)
          if (!dataUrl) return null
          return F.FabricImage.fromURL(dataUrl)
        })
        : buildSyncObject(F, obj)
      if (built) {
        built.selectable = false
        canvas.add(built)
        rendered += 1
      } else {
        skipped += 1
      }
    }
    canvas.renderAll()
    const png = Buffer.from(canvas.toDataURL('image/png').split(',')[1] ?? '', 'base64')
    return { png, rendered, skipped, fontsRequested: [...fonts] }
  } finally {
    canvas.dispose()
  }
}

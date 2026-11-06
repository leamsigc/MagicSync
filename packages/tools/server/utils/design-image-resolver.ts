import { createHash } from 'node:crypto'
import { safeFetch } from '#layers/BaseShared/server/utils/ssrf'

/**
 * Renderer-side image source resolution.
 *
 * - data: URLs pass through
 * - `/api/v1/image-editor/assets/<name>` are read straight from the
 *   design-asset store (no fetch, no auth surface — design assets are public
 *   brand/stock content, never user-private rows)
 * - http(s) go through safeFetch (pinned IP, redirect re-validation, caps)
 * - anything else is rejected by the caller
 */

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export function isDesignAssetPath(src: string): string | null {
  const prefix = '/api/v1/image-editor/assets/'
  if (!src.startsWith(prefix)) return null
  const name = decodeURIComponent(src.slice(prefix.length).split('?')[0] ?? '')
  return DESIGN_ASSET_NAME_RE.test(name) ? name : null
}

export const DESIGN_ASSET_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/

export async function resolveImageSource(src: string): Promise<string | null> {
  const assetName = isDesignAssetPath(src)
  if (assetName) {
    const { readDesignAsset } = await import('./design-asset-store')
    const file = await readDesignAsset(assetName)
    if (!file) return null
    return `data:${file.mimeType};base64,${file.bytes.toString('base64')}`
  }
  // Data URLs (converted SVG assets, inlined images) are already self-contained.
  if (src.startsWith('data:')) return src
  if (!src.startsWith('http://') && !src.startsWith('https://')) return null
  try {
    const response = await safeFetch(src, { maxBytes: MAX_IMAGE_BYTES, timeoutMs: 15_000 })
    if (response.status < 200 || response.status >= 300) return null
    const rawType = response.headers['content-type']
    const mime = String(Array.isArray(rawType) ? rawType[0] : rawType ?? 'image/png').split(';')[0]
    // safeFetch returns a Node-style { status, headers, body: Buffer }, not a
    // web Response. Calling response.arrayBuffer() threw and every remote image
    // was silently skipped in server renders/MP4.
    const buffer = response.body
    if (!buffer || buffer.length === 0) return null
    void createHash
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

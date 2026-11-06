import { mkdir, readFile, writeFile, unlink, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { DESIGN_ASSET_NAME_RE } from './design-image-resolver'

/**
 * Public design-asset store — fonts, shape packs, icon collections, stock
 * files and template media. Content is brand/stock material, never
 * user-private, so the asset route serves it without a session.
 *
 * Layout: {NUXT_FILE_STORAGE_MOUNT}/design-assets/<safe-name>
 */

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  gif: 'image/gif', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac',
  ogg: 'audio/ogg', oga: 'audio/ogg', flac: 'audio/flac',
  json: 'application/json', csv: 'text/csv', ttf: 'font/ttf', otf: 'font/otf',
  woff: 'font/woff', woff2: 'font/woff2',
}

const MAX_ASSET_BYTES = 25 * 1024 * 1024

function baseDir(): string {
  const mount = process.env.NUXT_FILE_STORAGE_MOUNT || './upload/files'
  return join(process.cwd(), mount, 'design-assets')
}

export interface DesignAssetFile {
  name: string
  mimeType: string
  bytes: Buffer
}

export function mimeForAsset(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

export function assetHash(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 16)
}

export async function writeDesignAsset(name: string, bytes: Buffer): Promise<{ url: string; bytes: number }> {
  if (!DESIGN_ASSET_NAME_RE.test(name)) throw new Error(`Invalid design-asset name: ${name.slice(0, 40)}`)
  if (bytes.length === 0 || bytes.length > MAX_ASSET_BYTES) throw new Error(`Design-asset bytes out of range (${bytes.length})`)
  await mkdir(baseDir(), { recursive: true })
  await writeFile(join(baseDir(), name), bytes)
  return { url: `/api/v1/image-editor/assets/${name}`, bytes: bytes.length }
}

export async function readDesignAsset(name: string): Promise<DesignAssetFile | null> {
  if (!DESIGN_ASSET_NAME_RE.test(name)) return null
  try {
    const bytes = await readFile(join(baseDir(), name))
    return { name, mimeType: mimeForAsset(name), bytes }
  } catch {
    return null
  }
}

export async function deleteDesignAsset(name: string): Promise<boolean> {
  if (!DESIGN_ASSET_NAME_RE.test(name)) return false
  try {
    await unlink(join(baseDir(), name))
    return true
  } catch {
    return false
  }
}

export async function listDesignAssets(): Promise<Array<{ name: string; bytes: number; mimeType: string }>> {
  try {
    const names = await readdir(baseDir())
    return names.filter(name => DESIGN_ASSET_NAME_RE.test(name)).map(name => ({ name, bytes: 0, mimeType: mimeForAsset(name) }))
  } catch {
    return []
  }
}

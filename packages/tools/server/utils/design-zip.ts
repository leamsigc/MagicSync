import { zipSync, type Zippable } from 'fflate'

/**
 * Batch-output ZIP builder: `render-<index>.<ext>` images plus a
 * `manifest.csv` (index, name, size — never the submitted field values).
 */

export interface ZipEntryInput {
  index: number
  bytes: Buffer
  extension: string
}

export function buildBatchZip(entries: ZipEntryInput[]): Buffer {
  const files: Zippable = {}
  const manifestRows: string[] = ['index,filename,bytes']
  for (const entry of entries) {
    const filename = `render-${String(entry.index).padStart(4, '0')}.${entry.extension}`
    files[filename] = new Uint8Array(entry.bytes)
    manifestRows.push(`${entry.index},${filename},${entry.bytes.length}`)
  }
  files['manifest.csv'] = new TextEncoder().encode(manifestRows.join('\n')) as Uint8Array
  const zipped = zipSync(files, { level: 3 })
  return Buffer.from(zipped)
}

export const ZIP_MIME = 'application/zip'

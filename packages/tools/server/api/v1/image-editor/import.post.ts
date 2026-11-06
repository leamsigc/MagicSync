import { z } from 'zod'
import { createHash } from 'node:crypto'
import { normalizeDocument } from '../../../../shared/image-editor/normalize'
import { designService } from '#layers/BaseDB/server/services/design.service'
import { requireDesignAuth } from '../../../utils/design-auth'
import { writeDesignAsset } from '../../../utils/design-asset-store'
import { resolveImageSource } from '../../../utils/design-image-resolver'
import type { EditorObject } from '../../../../shared/image-editor/document'

/**
 * Import a Fabric v5.x / v7 template JSON (Kuaitu-style) as a design.
 * Normalizes objects, extracts fields, rewrites remote images into the
 * public design-asset store, then stores the design envelope.
 */

const MAX_TEMPLATE_BYTES = 4 * 1024 * 1024

const importSchema = z.object({
  template: z.unknown(),
  title: z.string().min(1).max(200).optional(),
  isPublic: z.boolean().optional(),
  category: z.string().max(40).optional(),
  tags: z.array(z.string().max(30)).max(12).optional(),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const principal = await requireDesignAuth(event)

  const body = importSchema.parse(await readBody(event))
  let templateRaw = body.template
  if (typeof templateRaw === 'string') {
    try {
      templateRaw = JSON.parse(templateRaw)
    } catch {
      throw createError({ statusCode: 400, statusMessage: 'Template JSON string is not parseable' })
    }
  }
  const serialized = JSON.stringify(templateRaw ?? null)
  if (serialized.length > MAX_TEMPLATE_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Template JSON exceeds the 4 MB import limit' })
  }

  const { document, warnings } = normalizeDocument({ json: templateRaw })
  await rewriteImages(document, warnings)
  const title = body.title ?? deriveTitle(templateRaw) ?? 'Imported design'
  const saved = await designService.create(principal.userId, {
    title,
    doc: document,
    meta: metaOf(templateRaw, body),
    isPublic: body.isPublic ?? false,
  })
  if (!saved.success || !saved.data) {
    log.error({ message: 'image-editor import rejected', userId: principal.userId, error: saved.error })
    throw createError({ statusCode: 400, statusMessage: saved.error ?? 'Import failed' })
  }

  log.set({ designId: saved.data.id, warnings: warnings.length })
  return {
    id: saved.data.id,
    title: saved.data.title,
    document: saved.data.envelope.doc,
    warnings,
  }
})

function metaOf(templateRaw: unknown, body: { category?: string; tags?: string[] }): Record<string, unknown> {
  const version = (templateRaw as Record<string, unknown> | null)?.version
  return {
    sourceVersion: typeof version === 'string' ? version : 'unknown',
    ...(body.category ? { category: body.category } : {}),
    ...(body.tags ? { tags: body.tags } : {}),
  }
}

/** Every remote http(s) src is fetched server-side and stored as a design asset. */
async function rewriteImages(doc: ReturnType<typeof normalizeDocument>['document'], warnings: string[]) {
  const seen = new Map<string, string>()
  for (const page of doc.pages) {
    for (const obj of page.objects) {
      await rewriteTree(obj, seen, warnings, 0)
    }
  }
}

async function rewriteTree(obj: EditorObject, seen: Map<string, string>, warnings: string[], depth: number) {
  if (depth > 6) return
  const isImage = String(obj.type ?? '').toLowerCase() === 'image'
  const src = typeof obj.src === 'string' ? obj.src : ''
  if (isImage && src.startsWith('http')) {
    const cached = seen.get(src)
    if (cached) {
      obj.src = cached
      obj.crossOrigin = null
    } else {
      const stored = await fetchAndStore(src)
      if (stored) {
        seen.set(src, stored)
        obj.src = stored
        obj.crossOrigin = null
      } else {
        obj.visible = false
        warnings.push(`Image skipped (blocked or failed): ${src.slice(0, 100)}`)
      }
    }
  }
  for (const child of (Array.isArray(obj.objects) ? obj.objects : []) as EditorObject[]) {
    await rewriteTree(child, seen, warnings, depth + 1)
  }
}

async function fetchAndStore(src: string): Promise<string | null> {
  const resolved = await resolveImageSource(src)
  if (!resolved || !resolved.startsWith('data:')) return null
  const name = `tpl-${createHash('md5').update(resolved).digest('hex').slice(0, 12)}-${crypto.randomUUID().slice(0, 6)}${extensionOf(resolved)}`
  const bytes = Buffer.from(resolved.slice(resolved.indexOf(',') + 1), 'base64')
  const stored = await writeDesignAsset(name, bytes)
  return stored.url
}

function extensionOf(dataUrl: string): string {
  const mime = dataUrl.slice(5, dataUrl.indexOf(';'))
  const map: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg' }
  return map[mime] ?? '.png'
}

function deriveTitle(raw: unknown): string | null {
  const title = (raw as Record<string, unknown> | null)?.title
  return typeof title === 'string' && title.length > 0 ? title.slice(0, 120) : null
}

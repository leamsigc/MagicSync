import { z } from 'zod'
import { isDocument, type ImageEditorDocument } from '../../shared/image-editor/resolve-rows'
import { prepareDesignDocument } from '../../shared/image-editor/fields'
import { normalizeDocument } from '../../shared/image-editor/normalize'
import { designService } from '#layers/BaseDB/server/services/design.service'
import type { DesignPrincipal } from './design-auth'

/**
 * Shared "where does the document come from" resolution for render/batch/mp4
 * routes: templateId (owner-or-public design) | inline document envelope |
 * raw v5/v7 template JSON.
 */

export const sourceSchema = z.object({
  templateId: z.string().min(6).max(80).optional(),
  document: z.unknown().optional(),
  template: z.unknown().optional(),
  title: z.string().min(1).max(200).optional(),
})

export interface ResolvedSource {
  document: ImageEditorDocument
  templateId: string | null
  warnings: string[]
  importedNew: boolean
}

const MAX_INLINE_BYTES = 4 * 1024 * 1024

export async function resolveDesignSource(principal: DesignPrincipal, input: { templateId?: string; document?: unknown; template?: unknown }): Promise<ResolvedSource> {
  if (input.templateId) {
    const found = await designService.findById(input.templateId, principal.userId)
    if (!found.success || !found.data) {
      throw createError({ statusCode: 404, statusMessage: found.error ?? 'Template not found' })
    }
    const document = found.data.envelope.doc
    if (!isDocument(document)) {
      throw createError({ statusCode: 400, statusMessage: 'Template present but not an editor document' })
    }
    return { document: prepareDesignDocument(document), templateId: input.templateId, warnings: [], importedNew: false }
  }

  if (input.document !== undefined) {
    const inline = unwrap(input.document)
    if (!inline || !isDocument(inline)) {
      throw createError({ statusCode: 400, statusMessage: 'document is not an image-editor@1 envelope' })
    }
    return { document: prepareDesignDocument(inline), templateId: null, warnings: [], importedNew: false }
  }

  if (input.template !== undefined) {
    const raw = unwrap(input.template)
    if (!raw) throw createError({ statusCode: 400, statusMessage: 'template JSON is not parseable' })
    const serialized = JSON.stringify(raw)
    if (serialized.length > MAX_INLINE_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'Too large document' })
    }
    const normalized = normalizeDocument({ json: raw })
    const { syncFieldsFromObjects } = await import('../../shared/image-editor/fields')
    const document = prepareDesignDocument(syncFieldsFromObjects(normalized.document))
    return { document, templateId: null, warnings: normalized.warnings, importedNew: false }
  }

  throw createError({ statusCode: 400, statusMessage: 'Provide templateId, document or template' })
}

/** Body fields may arrive as JSON strings (no-code tools); parse defensively. */
function unwrap(value: unknown): Record<string, unknown> | null {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

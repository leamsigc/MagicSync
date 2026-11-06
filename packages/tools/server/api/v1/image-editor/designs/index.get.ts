import { z } from 'zod'
import { designService } from '#layers/BaseDB/server/services/design.service'
import { requireDesignAuth } from '../../../../utils/design-auth'

const listSchema = z.object({
  q: z.string().max(80).optional(),
  category: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

/** Grid-safe projection — no envelope payload (documents load via GET /:id). */
function designSummary(design: { id: string; title: string; isPublic: boolean; updatedAt: Date; envelope: { doc: unknown }; thumbnails: Array<{ name: string; url: string }> }) {
  const doc = (design.envelope.doc ?? {}) as { pages?: unknown[]; fields?: Array<{ name: string }> }
  return {
    id: design.id,
    title: design.title,
    isPublic: design.isPublic,
    updatedAt: design.updatedAt,
    pages: Array.isArray(doc.pages) ? doc.pages.length : 1,
    fields: Array.isArray(doc.fields) ? doc.fields.map(field => field.name) : [],
    thumbnails: design.thumbnails.slice(0, 3),
  }
}

function summarize(result: { success: boolean; data: Parameters<typeof designSummary>[0][]; error?: string }) {
  if (!result.success) throw createError({ statusCode: 500, statusMessage: result.error ?? 'Failed to list designs' })
  return { ...result, data: result.data.map(designSummary) }
}

/**
 * Public templates are readable without a session (the library is a free tool
 * surface); "My Designs" still requires auth.
 */
export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, raw => listSchema.extend({ scope: z.enum(['mine', 'public']).default('mine') }).parse(raw))
  if (query.scope === 'public') {
    const result = await designService.listPublic({ q: query.q }, { page: query.page, limit: query.limit })
    return summarize(result)
  }
  const principal = await requireDesignAuth(event)
  const result = await designService.list(principal.userId, { q: query.q, category: query.category }, { page: query.page, limit: query.limit })
  return summarize(result)
})

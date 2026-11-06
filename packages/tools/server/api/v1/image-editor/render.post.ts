import { z } from 'zod'
import { bindDocument, type DynamicFieldEntry } from '../../../../shared/image-editor/bind-fields'
import { FIELD_SUFFIXES } from '../../../../shared/image-editor/document'
import { renderDesign, type DesignFormat } from '../../../utils/image-editor-render'
import { requireDesignAuth } from '../../../utils/design-auth'
import { sourceSchema, resolveDesignSource } from '../../../utils/design-source'
import { DESIGN_RATE_RULES, designRateLimit, rateLimitStatus } from '../../../utils/design-rate-limit'

/**
 * Single design render — the same engine the batch route and MCP
 * render-design tool use. Accepts templateId | document | template plus
 * dynamic_fields / dynamic_fields_flat. Returns raw image bytes.
 */

const suffixValues = z.union([z.string(), z.number(), z.boolean()])

const dynamicFieldSchema = z.object({
  name: z.string().min(1).max(60).regex(/^[A-Za-z0-9_]+$/, 'Field names are [A-Za-z0-9_]'),
  ...Object.fromEntries(FIELD_SUFFIXES.map(suffix => [suffix, suffixValues.optional()])),
})

const renderSchema = sourceSchema.extend({
  page: z.number().int().min(0).max(50).optional(),
  timeMs: z.number().min(0).max(60_000).optional(),
  format: z.enum(['png', 'jpeg', 'webp', 'svg']).optional(),
  scale: z.number().min(0.1).max(4).optional(),
  quality: z.number().min(0.3).max(1).optional(),
  dynamic_fields: z.array(dynamicFieldSchema).max(64).optional(),
  dynamic_fields_flat: z.record(z.string(), suffixValues).optional(),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const principal = await requireDesignAuth(event)
  log.set({ userId: principal.userId, viaKey: principal.viaKey })

  if (!designRateLimit(principal.userId, DESIGN_RATE_RULES.render)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many renders; slow down' })
  }

  const body = await readValidatedBody(event, raw => renderSchema.parse(raw))
  const source = await resolveDesignSource(principal, body)

  const bound = bindDocument(source.document, {
    ...(body.dynamic_fields ? { dynamic_fields: body.dynamic_fields as DynamicFieldEntry[] } : {}),
    ...(body.dynamic_fields_flat ? { dynamic_fields_flat: body.dynamic_fields_flat } : {}),
  })

  const output = await renderDesign({
    document: source.document,
    pageIndex: body.page ?? 0,
    timeMs: body.timeMs ?? 0,
    format: (body.format ?? 'png') as DesignFormat,
    scale: body.scale ?? 1,
    quality: body.quality ?? 0.92,
  })

  log.set({ format: body.format ?? 'png', bytes: output.buffer.length, warnings: output.warnings.length })
  setResponseHeader(event, 'Content-Type', output.mimeType)
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  setResponseHeader(event, 'X-Render-Warnings', String(output.warnings.length))
  setResponseHeader(event, 'X-Render-Fonts', output.fonts.join(','))
  setResponseHeader(event, 'X-RateLimit-Remaining', String(rateLimitStatus(principal.userId, DESIGN_RATE_RULES.render).remaining))
  return output.buffer
})

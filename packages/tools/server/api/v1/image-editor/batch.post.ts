import { z } from 'zod'
import { bindDocument, type DynamicFieldEntry, type FieldValues } from '../../../../shared/image-editor/bind-fields'
import { resolveBatch, BatchLimitError, type BatchRowRequest } from '../../../../shared/image-editor/resolve-rows'
import { FIELD_SUFFIXES } from '../../../../shared/image-editor/document'
import { renderDesign, type DesignFormat } from '../../../utils/image-editor-render'
import { requireDesignAuth } from '../../../utils/design-auth'
import { sourceSchema, resolveDesignSource } from '../../../utils/design-source'
import { designRateLimit, rateLimitStatus, DESIGN_RATE_RULES } from '../../../utils/design-rate-limit'
import { buildBatchZip, ZIP_MIME } from '../../../utils/design-zip'
import { signAssetPath } from '#layers/BaseShared/server/utils/signed-url'
import { deliverDesignWebhook, type DesignWebhookEvent } from '../../../utils/design-webhook'
import { assetService } from '#layers/BaseShared/server/services/asset.service'
import { designWebhookService } from '#layers/BaseDB/server/services/design-webhook.service'

/**
 * Batch design generation — rows or cartesian value arrays, bounded at
 * 50 rows / 100 combinations per sync request. Returns stored asset URLs
 * (automation-friendly) or a ZIP + manifest (UI download). Submitted field
 * values are never echoed or persisted in responses.
 */

const suffixValues = z.union([z.string(), z.number(), z.boolean()])
const dynamicFieldSchema = z.object({
  name: z.string().min(1).max(60).regex(/^[A-Za-z0-9_]+$/, 'Field names are [A-Za-z0-9_]'),
  ...Object.fromEntries(FIELD_SUFFIXES.map(suffix => [suffix, suffixValues.optional()])),
})

const batchSchema = sourceSchema.extend({
  rows: z.array(z.record(z.string(), suffixValues)).max(50).optional(),
  values: z.record(z.string(), z.array(suffixValues)).optional(),
  advanced: z.array(z.object({
    dynamic_fields: z.array(dynamicFieldSchema).max(64).optional(),
    dynamic_fields_flat: z.record(z.string(), suffixValues).optional(),
  })).max(100).optional(),
  output: z.enum(['assets', 'zip']).optional(),
  format: z.enum(['png', 'jpeg', 'webp']).optional(),
  scale: z.number().min(0.1).max(4).optional(),
  page: z.number().int().min(0).max(50).optional(),
  nameTemplate: z.string().max(80).optional(),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const principal = await requireDesignAuth(event)
  log.set({ userId: principal.userId, viaKey: principal.viaKey })

  if (!designRateLimit(principal.userId, DESIGN_RATE_RULES.batch)) {
    throw createError({ statusCode: 429, statusMessage: 'Batch rate limit reached; try again shortly' })
  }

  const body = await readValidatedBody(event, raw => batchSchema.parse(raw))
  const source = await resolveDesignSource(principal, body)

  let renders: FieldValues[]
  try {
    const resolved = resolveBatch({
      document: source.document,
      template: undefined,
      rows: body.rows,
      values: body.values,
      advanced: body.advanced?.map(entry => ({
        dynamic_fields: entry.dynamic_fields as DynamicFieldEntry[] | undefined,
        dynamic_fields_flat: entry.dynamic_fields_flat,
      })) as FieldValues[],
    } satisfies BatchRowRequest)
    renders = resolved.renders
  } catch (error) {
    if (error instanceof BatchLimitError) {
      throw createError({ statusCode: 400, statusMessage: error.message })
    }
    throw error
  }

  const output = body.output ?? 'assets'
  const format = (body.format ?? 'png') as DesignFormat
  const scale = body.scale ?? 1
  const pageIndex = body.page ?? 0

  const results: Array<{ index: number; assetId?: string; url?: string; error?: string }> = []
  const zipEntries: Array<{ index: number; bytes: Buffer; extension: string }> = []

  for (const [index, fieldValues] of renders.entries()) {
    try {
      // Fresh copy per row: bindDocument mutates the document, and reusing it
      // made row 2 write over row 1's text (and any layer state changes from
      // the previous render leaked into the next frame).
      const document = structuredClone(source.document)
      bindDocument(document, fieldValues)
      const rendered = await renderDesign({ document, pageIndex, format, scale, quality: 0.92 })
      const extension = extensionFor(format)
      const stored = await assetService.createFromBase64(principal.userId, {
        data: `data:${rendered.mimeType};base64,${rendered.buffer.toString('base64')}`,
        mimeType: rendered.mimeType,
        originalName: outputName(body, index, extension),
        ...(principal.key ? { businessId: principal.key.businessId } : {}),
      })
      if (!stored.success || !stored.data) throw new Error(stored.error ?? 'Failed to store render')
      const serveUrl = signAssetPath(stored.data.url).url
      results.push({ index, assetId: stored.data.id, url: serveUrl })
      zipEntries.push({ index, bytes: rendered.buffer, extension })
      log.set({ index, bytes: rendered.buffer.length })
    } catch (error) {
      results.push({ index, error: error instanceof Error ? error.message.slice(0, 200) : 'Render failed' })
      log.error({ message: 'design batch render failed', index, error: String(error) })
    }
  }

  const ok = results.filter(entry => entry.url).length
  let zipUrl: string | null = null
  if (output === 'zip' && zipEntries.length > 0) {
    const zip = buildBatchZip(zipEntries)
    const storedZip = await assetService.createFromBase64(principal.userId, {
      data: `data:${ZIP_MIME};base64,${zip.toString('base64')}`,
      mimeType: ZIP_MIME,
      originalName: outputName(body, 0, 'zip'),
      ...(principal.key ? { businessId: principal.key.businessId } : {}),
    })
    if (storedZip.success && storedZip.data) zipUrl = signAssetPath(storedZip.data.url, { ttlSeconds: 7 * 24 * 3600 }).url
  }

  fireWebhooks(principal.userId, {
    event: ok > 0 ? 'batch.completed' : 'render.failed',
    data: {
      templateId: source.templateId,
      requested: renders.length,
      succeeded: ok,
      failed: results.filter(entry => entry.error).length,
      ...(ok > 0 ? { renders: results.filter(entry => entry.url).map(entry => ({ index: entry.index, assetId: entry.assetId, url: entry.url })) } : {}),
      ...(zipUrl ? { zipUrl } : {}),
    },
  })

  log.set({ requested: renders.length, succeeded: ok })
  return {
    count: ok,
    requested: renders.length,
    renders: results.filter(entry => entry.url).map(entry => ({ index: entry.index, assetId: entry.assetId, url: entry.url })),
    failures: results.filter(entry => entry.error).map(entry => ({ index: entry.index, error: entry.error })),
    ...(zipUrl ? { zipUrl } : {}),
    importWarnings: source.warnings.length > 0 ? source.warnings.slice(0, 20) : [],
    rateLimit: rateLimitStatus(principal.userId, DESIGN_RATE_RULES.batch),
  }
})

/** Kick off webhook deliveries detached from the HTTP response. */
function fireWebhooks(userId: string, payload: { event: DesignWebhookEvent; data: Record<string, unknown> }): void {
  void (async () => {
    try {
      const targets = await designWebhookService.listDeliveryTargets(userId)
      for (const target of targets) {
        const outcome = await deliverDesignWebhook(target, payload)
        await designWebhookService.recordAttempt(userId, target.id, payload.event, outcome, undefined)
      }
    } catch {
      // webhook failures never affect the batch result
    }
  })()
}

function outputName(body: { nameTemplate?: string; templateId?: string }, index: number, extension: string): string {
  if (body.nameTemplate && /^[A-Za-z0-9_-]*\{i\}[A-Za-z0-9_.-]*$/.test(body.nameTemplate)) {
    return `${body.nameTemplate.replace('{i}', String(index).padStart(4, '0'))}.${extension}`
  }
  return `design-batch-${String(index).padStart(4, '0')}.${extension}`
}

function extensionFor(format: DesignFormat): string {
  const map: Record<string, string> = { png: 'png', jpeg: 'jpg', webp: 'webp', svg: 'svg' }
  return map[format] ?? 'png'
}

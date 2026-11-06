import { z } from 'zod'
import { bindDocument, type DynamicFieldEntry } from '../../../../shared/image-editor/bind-fields'
import { FIELD_SUFFIXES } from '../../../../shared/image-editor/document'
import { renderDesignFrames, encodeFramesToMp4, MP4_LIMITS, FfmpegUnavailableError } from '../../../utils/image-editor-render'
import { requireDesignAuth } from '../../../utils/design-auth'
import { sourceSchema, resolveDesignSource } from '../../../utils/design-source'
import { designRateLimit, DESIGN_RATE_RULES } from '../../../utils/design-rate-limit'
import { signAssetPath } from '#layers/BaseShared/server/utils/signed-url'
import { assetService } from '#layers/BaseShared/server/services/asset.service'
import { safeFetch } from '#layers/BaseShared/server/utils/ssrf'
import { isDesignAssetPath } from '../../../utils/design-image-resolver'
import { readDesignAsset } from '../../../utils/design-asset-store'

/**
 * Server-side MP4 export via ffmpeg (automation path). Interactive editing
 * keeps the browser mediabunny path; this route is for API/MCP callers.
 */

const suffixValues = z.union([z.string(), z.number(), z.boolean()])
const dynamicFieldSchema = z.object({
  name: z.string().min(1).max(60).regex(/^[A-Za-z0-9_]+$/, 'Field names are [A-Za-z0-9_]'),
  ...Object.fromEntries(FIELD_SUFFIXES.map(suffix => [suffix, suffixValues.optional()])),
})

const mp4Schema = sourceSchema.extend({
  page: z.number().int().min(0).max(50).optional(),
  fps: z.number().int().min(6).max(MP4_LIMITS.maxFps).optional(),
  durationMs: z.number().int().min(500).max(MP4_LIMITS.maxDurationMs).optional(),
  maxHeight: z.number().int().min(120).max(MP4_LIMITS.maxTargetHeight).optional(),
  dynamic_fields: z.array(dynamicFieldSchema).max(64).optional(),
  dynamic_fields_flat: z.record(z.string(), suffixValues).optional(),
  audio: z.string().min(1).max(2000).optional(),
  audioVolume: z.number().min(0).max(1).optional(),
})

/** Audio is either a design-asset path or a public http(s) URL. */
async function resolveAudioSource(src: string | undefined): Promise<{ bytes: Buffer; extension: string } | null> {
  if (!src) return null
  const name = isDesignAssetPath(src)
  if (name) {
    const file = await readDesignAsset(name)
    return file ? { bytes: file.bytes, extension: name.split('.').pop() ?? 'mp3' } : null
  }
  if (!/^https?:\/\//.test(src)) return null
  const response = await safeFetch(src, { maxBytes: 20 * 1024 * 1024, timeoutMs: 20_000 })
  if (response.status < 200 || response.status >= 300 || response.body.length === 0) return null
  const type = String(response.headers['content-type'] ?? '').split(';')[0]
  return { bytes: response.body, extension: type.split('/')[1] || 'mp3' }
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const principal = await requireDesignAuth(event)
  if (!designRateLimit(principal.userId, DESIGN_RATE_RULES.mp4)) {
    throw createError({ statusCode: 429, statusMessage: 'MP4 rate limit reached; try again shortly' })
  }

  const body = await readValidatedBody(event, raw => mp4Schema.parse(raw))
  const source = await resolveDesignSource(principal, body)

  if (body.dynamic_fields || body.dynamic_fields_flat) {
    bindDocument(source.document, {
      ...(body.dynamic_fields ? { dynamic_fields: body.dynamic_fields as DynamicFieldEntry[] } : {}),
      ...(body.dynamic_fields_flat ? { dynamic_fields_flat: body.dynamic_fields_flat } : {}),
    })
  }

  try {
    const series = await renderDesignFrames({
      document: source.document,
      pageIndex: body.page ?? 0,
      fps: body.fps,
      durationMs: body.durationMs,
      dynamicHeight: body.maxHeight,
    })
    const audio = await resolveAudioSource(body.audio)
    if (body.audio && !audio) throw createError({ statusCode: 400, statusMessage: 'Audio track could not be loaded' })
    const mp4 = await encodeFramesToMp4(series.frames, {
      fps: series.fps,
      timeoutMs: 120_000,
      ...(audio ? { audio, audioVolume: body.audioVolume ?? 1 } : {}),
    })
    const stored = await assetService.createFromBase64(principal.userId, {
      data: `data:video/mp4;base64,${mp4.toString('base64')}`,
      mimeType: 'video/mp4',
      originalName: `design-clip-${crypto.randomUUID().slice(0, 8)}.mp4`,
      ...(principal.key ? { businessId: principal.key.businessId } : {}),
    })
    if (!stored.success || !stored.data) throw createError({ statusCode: 500, statusMessage: stored.error ?? 'Failed to store MP4' })
    const serveUrl = signAssetPath(stored.data.url, { ttlSeconds: 7 * 24 * 3600 }).url
    log.set({ frames: series.frames.length, bytes: mp4.length, durationMs: series.durationMs })
    return {
      assetId: stored.data.id,
      url: serveUrl,
      durationMs: series.durationMs,
      fps: series.fps,
      width: series.width,
      height: series.height,
      warnings: series.warnings.slice(0, 20),
    }
  } catch (error) {
    if (error instanceof FfmpegUnavailableError) {
      throw createError({ statusCode: 501, statusMessage: 'MP4 export requires ffmpeg in the server environment' })
    }
    throw error
  }
})

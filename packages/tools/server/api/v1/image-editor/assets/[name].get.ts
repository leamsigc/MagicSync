import { readDesignAsset } from '../../../../utils/design-asset-store'
import { verifySignedAsset } from '#layers/BaseShared/server/utils/signed-url'

/**
 * Public design-asset serving (rendered outputs, stock copies, fonts).
 * Design assets are automation outputs, never user-private rows — unlike
 * `/api/v1/assets/serve` which is session-scoped.
 *
 * Bounded-lifetime links from batch/mp4/webhook responses carry
 * `?expires=<epochSeconds>&signature=<hmac>`; when either param is present
 * the request must validate or it is refused. Unsigned URLs keep working
 * because these assets are public brand/stock media.
 */

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const name = decodeURIComponent(getRouterParam(event, 'name') ?? '')
  const query = getQuery(event)
  const signed = typeof query.expires === 'string' || typeof query.signature === 'string'

  if (signed) {
    const path = getRequestURL(event).pathname
    const valid = verifySignedAsset(path, String(query.expires ?? ''), String(query.signature ?? ''))
    if (!valid) {
      log.set({ name, signed: true, valid: false })
      throw createError({ statusCode: 403, statusMessage: 'Invalid or expired signature' })
    }
  }

  if (!name || name.length > 128) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid asset name' })
  }

  const file = await readDesignAsset(name)
  if (!file) {
    log.set({ name, found: false })
    throw createError({ statusCode: 404, statusMessage: 'Asset not found' })
  }

  log.set({ name, bytes: file.bytes.length, signed })
  setResponseHeader(event, 'Content-Type', file.mimeType)
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  return file.bytes
})

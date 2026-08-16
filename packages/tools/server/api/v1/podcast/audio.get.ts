import { isSafeExternalUrl } from '#layers/BaseShared/server/utils/ssrf'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const query = getQuery(event)
  const audioUrl = String(query.url || '')
  log.set({ audioUrl })

  if (!audioUrl) {
    log.error('url parameter is required', {})
    throw createError({ statusCode: 400, message: 'url is required' })
  }

  // SAFE: block SSRF — reject internal/private/loopback/metadata hosts
  const { safe, reason } = await isSafeExternalUrl(audioUrl)
  if (!safe) {
    log.error('Blocked unsafe audio URL', { audioUrl, reason })
    throw createError({ statusCode: 400, message: reason })
  }

  log.info('Fetching audio', { audioUrl })

  const upstreamRes = await fetch(audioUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    redirect: 'follow',
  })

  if (!upstreamRes.ok) {
    log.error('Failed to fetch audio', { status: upstreamRes.status, audioUrl })
    throw createError({ statusCode: 502, message: 'Failed to fetch audio' })
  }

  const contentType = upstreamRes.headers.get('content-type') || 'audio/mpeg'
  const contentLength = upstreamRes.headers.get('content-length')

  setResponseHeaders(event, {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
    'Access-Control-Allow-Origin': '*',
    ...(contentLength ? { 'Content-Length': contentLength } : {}),
  })

  log.info('Audio streamed successfully', { audioUrl, contentType })
  return sendStream(event, upstreamRes.body!)
})

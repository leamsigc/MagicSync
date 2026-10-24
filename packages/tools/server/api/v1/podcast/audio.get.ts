import { capStream, safeFetchStream } from '#layers/BaseShared/server/utils/ssrf'

const MAX_AUDIO_BYTES = 200 * 1024 * 1024
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/x-m4a',
  'application/octet-stream',
])

function isAllowedAudioType(contentType: string): boolean {
  const mime = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  return !mime || ALLOWED_AUDIO_TYPES.has(mime)
}

function isBlockedUrlError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('Blocked outbound URL')
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const audioUrl = String(getQuery(event).url || '').trim()

  if (!audioUrl) {
    log.error({ content: 'Podcast audio url parameter is required' })
    throw createError({ statusCode: 400, message: 'url is required' })
  }

  let upstream
  try {
    const range = getRequestHeader(event, 'range')
    // Every redirect hop is re-validated and the socket is pinned to the
    // resolved address, so a 302 to 169.254.169.254 cannot slip through.
    upstream = await safeFetchStream(audioUrl, {
      timeoutMs: 15_000,
      deadlineMs: 120_000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        ...(range ? { Range: range } : {}),
      },
    })
  }
  catch (error) {
    const blocked = isBlockedUrlError(error)
    log.error({
      content: blocked ? 'Blocked unsafe audio URL' : 'Podcast audio fetch failed',
      reason: error instanceof Error ? error.message : String(error),
    })
    throw createError({
      statusCode: blocked ? 400 : 502,
      message: blocked ? 'URL is not allowed' : 'Failed to fetch audio',
    })
  }

  if (upstream.status < 200 || upstream.status >= 300) {
    upstream.cleanup()
    log.error({ content: 'Failed to fetch audio', status: upstream.status })
    throw createError({ statusCode: 502, message: 'Failed to fetch audio' })
  }

  const contentType = String(upstream.headers['content-type'] || 'audio/mpeg')
  if (!isAllowedAudioType(contentType)) {
    upstream.cleanup()
    log.error({ content: 'Upstream audio content-type rejected', contentType })
    throw createError({ statusCode: 415, message: 'Upstream is not audio' })
  }

  const contentLength = upstream.headers['content-length']
  setResponseStatus(event, upstream.status)
  setResponseHeaders(event, {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    ...(contentLength ? { 'Content-Length': contentLength } : {}),
    ...(upstream.headers['content-range'] ? { 'Content-Range': String(upstream.headers['content-range']) } : {}),
  })

  log.info({ content: 'Audio stream started', finalUrl: upstream.finalUrl })
  return sendStream(event, capStream(upstream.stream, MAX_AUDIO_BYTES))
})

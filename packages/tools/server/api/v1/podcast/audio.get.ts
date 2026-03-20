export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const audioUrl = String(query.url || '')

  if (!audioUrl) {
    throw createError({ statusCode: 400, message: 'url is required' })
  }

  const upstreamRes = await fetch(audioUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    redirect: 'follow',
  })

  if (!upstreamRes.ok) {
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

  return sendStream(event, upstreamRes.body!)
})

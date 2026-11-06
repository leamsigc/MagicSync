import { createError, defineEventHandler, getQuery } from 'h3'
import { safeFetch } from '#layers/BaseShared/server/utils/ssrf'

/**
 * Backgrounds for the Background tab (Polotno-style).
 *
 * Public on purpose: the background picker is part of the free tool surface, so
 * it must work without a session. Uses the Unsplash Access Key server-side and
 * caches each query in memory for ten minutes.
 */

interface UnsplashPhoto {
  id: string
  description: string | null
  alt_description: string | null
  color: string
  width: number
  height: number
  urls: Record<string, string>
  links: { html?: string }
  user: { name?: string; links?: { html?: string } }
}

interface BackgroundPhoto {
  id: string
  url: string
  preview: string
  alt: string
  color: string
  photographer: string
  photographerUrl: string
  sourceUrl: string
}

const CACHE_TTL_MS = 10 * 60 * 1000
const MAX_QUERY = 80
const cache = new Map<string, { at: number; photos: BackgroundPhoto[] }>()

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const query = getQuery(event)
  const term = String(query.query ?? 'color background').trim().slice(0, MAX_QUERY) || 'color background'
  const page = Math.max(1, Number.parseInt(String(query.page ?? '1')) || 1)
  const perPage = Math.min(20, Math.max(1, Number.parseInt(String(query.per_page ?? '20')) || 20))
  const cacheKey = `${term.toLowerCase()}:${page}:${perPage}`

  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { query: term, photos: cached.photos, cached: true }
  }

  const accessKey = process.env.NUXT_UNSPLASH_ACCESS_KEY ?? ''
  if (!accessKey) {
    log.error('Unsplash Access Key not configured')
    throw createError({ statusCode: 500, statusMessage: 'Unsplash Access Key not configured (NUXT_UNSPLASH_ACCESS_KEY).' })
  }

  const endpoint = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(term)}&page=${page}&per_page=${perPage}&orientation=landscape&content_filter=high`
  try {
    const response = await safeFetch(endpoint, {
      method: 'GET',
      headers: { Authorization: `Client-ID ${accessKey}` },
      timeoutMs: 15_000,
      maxBytes: 5 * 1024 * 1024,
    })
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Unsplash responded ${response.status}`)
    }
    const payload = JSON.parse(String(response.body)) as { results?: UnsplashPhoto[] }
    const photos = (payload.results ?? []).map(photo => ({
      id: photo.id,
      url: photo.urls.regular ?? photo.urls.full ?? photo.urls.raw,
      preview: photo.urls.small ?? photo.urls.regular ?? photo.urls.raw,
      alt: photo.alt_description ?? photo.description ?? '',
      color: photo.color,
      photographer: photo.user?.name ?? '',
      photographerUrl: photo.user?.links?.html ?? '',
      sourceUrl: photo.links?.html ?? `https://unsplash.com/photos/${photo.id}`,
    }))
    cache.set(cacheKey, { at: Date.now(), photos })
    log.set({ query: term, page, photos: photos.length })
    return { query: term, photos, cached: false }
  } catch (error) {
    log.error({ message: 'Unsplash background search failed', error: String(error) })
    throw createError({ statusCode: 502, statusMessage: 'Failed to fetch backgrounds from Unsplash.' })
  }
})

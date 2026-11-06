import { createError, defineEventHandler, getQuery } from 'h3'
import { safeFetch } from '#layers/BaseShared/server/utils/ssrf'

/**
 * Unsplash search proxy — same contract as the Pexels route so the editor's
 * Photos/Backgrounds panels can query both providers interchangeably.
 * Uses the user-supplied Unsplash Access Key (NUXT_UNSPLASH_ACCESS_KEY).
 */

interface UnsplashPhoto {
  id: string
  description: string | null
  alt_description: string | null
  urls: Record<string, string>
  links: { download: string; html?: string }
  user: { name: string; links?: { html?: string } }
  width: number
  height: number
  color: string
}

interface UnsplashSearchResponse {
  total: number
  total_pages: number
  results: UnsplashPhoto[]
}

interface NormalizedPhoto {
  id: number | string
  width: number
  height: number
  url: string
  photographer: string
  photographer_url: string
  photographer_id: number | string
  avg_color: string
  src: { original: string; large2x: string; large: string; medium: string; small: string; tiny: string }
  alt: string
  /** Attribution: photo page + download endpoint (Unsplash API guidelines). */
  links: { download: string; html: string }
}

function normalize(photo: UnsplashPhoto): NormalizedPhoto {
  return {
    id: photo.id,
    width: photo.width,
    height: photo.height,
    url: photo.urls.raw,
    photographer: photo.user?.name ?? '',
    photographer_url: photo.user?.links?.html ?? '',
    photographer_id: '',
    avg_color: photo.color,
    src: {
      original: photo.urls.raw,
      large2x: photo.urls.regular ?? photo.urls.full,
      large: photo.urls.regular ?? photo.urls.full,
      medium: photo.urls.small ?? photo.urls.regular,
      small: photo.urls.small ?? photo.urls.regular,
      tiny: photo.urls.thumb ?? photo.urls.small,
    },
    alt: photo.alt_description ?? photo.description ?? '',
    links: {
      download: photo.links?.download ?? '',
      html: photo.links?.html ?? `https://unsplash.com/photos/${photo.id}`,
    },
  }
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const query = getQuery(event)
  const searchQuery = String(query.query ?? '')
  const page = Math.max(1, Number.parseInt(String(query.page ?? '1')) || 1)
  const perPage = Math.min(30, Math.max(1, Number.parseInt(String(query.per_page ?? '15')) || 15))
  const mode = String(query.mode ?? 'search')

  log.set({ searchQuery, page, perPage, mode })

  const accessKey = process.env.NUXT_UNSPLASH_ACCESS_KEY ?? ''
  if (!accessKey) {
    throw createError({ statusCode: 500, statusMessage: 'Unsplash Access Key not configured (NUXT_UNSPLASH_ACCESS_KEY).' })
  }

  const endpoint = mode === 'random'
    ? `https://api.unsplash.com/photos?page=${page}&per_page=${perPage}&order_by=popular`
    : `https://api.unsplash.com/search/photos?page=${page}&per_page=${perPage}${searchQuery ? `&query=${encodeURIComponent(searchQuery)}` : ''}`

  const response = await safeFetch(endpoint, {
    method: 'GET',
    headers: { Authorization: `Client-ID ${accessKey}` },
    timeoutMs: 15_000,
    maxBytes: 5 * 1024 * 1024,
  })
  if (response.status < 200 || response.status >= 300) {
    log.error({ message: 'Unsplash API error', status: response.status })
    throw createError({ statusCode: 502, statusMessage: 'Failed to fetch images from Unsplash.' })
  }

  const raw = JSON.parse(String(response.body)) as UnsplashSearchResponse
  if (mode === 'random') {
    const list = raw as unknown as UnsplashPhoto[]
    return { page, per_page: perPage, photos: list.map(normalize), total_results: list.length, next_page: '' }
  }
  return {
    page,
    per_page: perPage,
    photos: raw.results.map(normalize),
    total_results: raw.total,
    next_page: raw.total_pages > page ? String(page + 1) : '',
  }
})

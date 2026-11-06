import { defineEventHandler, createError, getQuery } from 'h3'
import { $fetch } from 'ofetch'

/**
 * Pexels video search proxy — same shape as the photo route
 * ({videos, total_results, next_page}) so the design editor and MCP
 * search-design-stock can offer stock clips as image_url/video_url values.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const query = getQuery(event)
  const searchQuery = String(query.query ?? '')
  const page = Number.parseInt(String(query.page ?? '1')) || 1
  const perPage = Math.min(30, Number.parseInt(String(query.per_page ?? '15')) || 15)

  log.set({ searchQuery, page, perPage })

  if (!searchQuery) {
    return { page: 1, per_page: perPage, videos: [], total_results: 0, next_page: '' }
  }

  const pexelsApiKey = process.env.NUXT_PEXELS_API_KEY || ''
  if (!pexelsApiKey) {
    log.error('Pexels API key not configured')
    throw createError({ statusCode: 500, statusMessage: 'Pexels API key not configured.' })
  }

  try {
    log.info('Searching Pexels videos', { searchQuery, page, perPage })
    const response = await $fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(searchQuery)}&per_page=${perPage}&page=${page}`, {
      headers: { Authorization: pexelsApiKey },
    })
    return response
  } catch (error) {
    log.error('Pexels video API error', { error })
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch videos from Pexels.' })
  }
})

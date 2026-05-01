import { defineEventHandler, getQuery, createError } from 'h3'
import { $fetch } from 'ofetch'


export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const query = getQuery(event)
  const searchQuery = query.query as string || ''
  const page = parseInt(query.page as string) || 1
  const perPage = parseInt(query.per_page as string) || 15

  log.set({ searchQuery, pagination: { page, perPage } })

  if (!searchQuery) {
    log.info('Empty search query, returning empty results', {})
    return {
      page: 1,
      per_page: perPage,
      photos: [],
      total_results: 0,
      next_page: '',
    }
  }

  const pexelsApiKey = process.env.NUXT_PEXELS_API_KEY || '';
  if (!pexelsApiKey) {
    log.error('Pexels API key not configured', {})
    throw createError({
      statusCode: 500,
      statusMessage: 'Pexels API key not configured.',
    })
  }

  try {
    log.info('Searching Pexels', { searchQuery, page, perPage })
    const response = await $fetch(`https://api.pexels.com/v1/search?query=${searchQuery}&per_page=${perPage}`, {
      headers: {
        Authorization: pexelsApiKey,
      },
    })
    return response
  } catch (error) {
    log.error('Pexels API error', { error })
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch images from Pexels.',
    })
  }
})

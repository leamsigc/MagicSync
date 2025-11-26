import { defineEventHandler, getQuery, createError } from 'h3'
import { $fetch } from 'ofetch'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const searchQuery = query.query as string || ''
  const page = parseInt(query.page as string) || 1
  const perPage = parseInt(query.per_page as string) || 15

  if (!searchQuery) {
    return {
      page: 1,
      per_page: perPage,
      photos: [],
      total_results: 0,
      next_page: '',
    }
  }

  const pexelsApiKey = process.env.NUXT_PEXELS_API_KEY
  if (!pexelsApiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Pexels API key not configured.',
    })
  }

  try {
    const response = await $fetch(`https://api.pexels.com/v1/search`, {
      headers: {
        Authorization: pexelsApiKey,
      },
      query: {
        query: searchQuery,
        page,
        per_page: perPage,
      },
    })
    return response
  } catch (error) {
    console.error('Pexels API error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch images from Pexels.',
    })
  }
})

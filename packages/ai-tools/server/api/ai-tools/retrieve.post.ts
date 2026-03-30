import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { chunkService } from '#layers/BaseDB/server/services/document.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.query) {
    throw createError({ statusCode: 400, statusMessage: 'Query is required' })
  }

  // Get query embedding from Python backend
  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  const retrieveResult = await $fetch<{
    query: string
    embedding: number[]
    top_k: number
  }>(`${backendUrl}/api/v1/rag/retrieve`, {
    method: 'POST',
    body: {
      query: body.query,
      top_k: body.top_k || 5,
    },
    headers: {
      'X-User-Id': user.id,
    },
  })

  // Search chunks in Turso using vector similarity
  const searchResult = await chunkService.search(
    user.id,
    retrieveResult.embedding,
    retrieveResult.top_k
  )

  if (searchResult.error) {
    throw createError({ statusCode: 500, statusMessage: searchResult.error })
  }

  return {
    query: body.query,
    results: searchResult.data,
  }
})

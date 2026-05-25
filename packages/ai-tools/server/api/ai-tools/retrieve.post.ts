import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const body = await readBody(event)

  log.set({ query: body.query?.substring(0, 100) })

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

  // Build optional filters
  const filters: { documentId?: string; metadataKey?: string; metadataValue?: string } = {}
  if (body.document_id) {
    filters.documentId = body.document_id
  }
  if (body.metadata_key && body.metadata_value) {
    filters.metadataKey = body.metadata_key
    filters.metadataValue = body.metadata_value
  }

  // Search chunks in Turso using vector similarity with optional filters
  const searchResult = await aiToolsFacade.searchChunks(
    user.id,
    retrieveResult.embedding,
    retrieveResult.top_k,
    Object.keys(filters).length > 0 ? filters : undefined
  )

  if (searchResult.error) {
    throw createError({ statusCode: 500, statusMessage: searchResult.error })
  }

  return {
    query: body.query,
    results: searchResult.data,
  }
})

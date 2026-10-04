import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { documentIngestService } from '#layers/BaseDB/server/services/document-ingest.service'
import { resolveEmbedder } from '#layers/BaseAgent/server/utils/embeddings'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.query?.trim()) throw createError({ statusCode: 400, statusMessage: 'Query is required' })

  const embedder = await resolveEmbedder(user.id, body.businessId ?? body.business_id ?? '', { log })
  if (!embedder.success) {
    throw createError({ statusCode: 400, statusMessage: embedder.error, data: { code: embedder.code } })
  }

  const searchResult = await documentIngestService.search(user.id, {
    query: body.query,
    limit: body.top_k ?? body.limit ?? 5,
  }, embedder.data)
  if (!searchResult.success) throw createError({ statusCode: 500, statusMessage: searchResult.error })

  return {
    query: body.query,
    results: searchResult.data.map(hit => ({
      id: hit.chunkId,
      document_id: hit.documentId,
      content: hit.content,
      distance: hit.distance,
    })),
  }
})

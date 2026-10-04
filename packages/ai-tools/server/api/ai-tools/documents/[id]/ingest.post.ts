import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'
import { documentIngestService } from '#layers/BaseDB/server/services/document-ingest.service'
import { resolveEmbedder } from '#layers/BaseAgent/server/utils/embeddings'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Document ID required' })

  const docResult = await aiToolsFacade.getDocument(id, user.id)
  if (docResult.error || !docResult.data) {
    throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  }
  const doc = docResult.data

  const embedder = await resolveEmbedder(user.id, '', { log })
  if (!embedder.success) {
    throw createError({ statusCode: 400, statusMessage: embedder.error, data: { code: embedder.code } })
  }

  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }
      try {
        send({ status: 'processing', message: 'Reading file...' })
        const filePath = join(process.cwd(), 'upload', doc.storagePath)
        const fileBuffer = await readFile(filePath)

        send({ status: 'processing', message: 'Chunking and embedding...' })
        const result = await documentIngestService.ingest(user.id, {
          filename: doc.originalName,
          mimeType: doc.mimeType,
          base64: fileBuffer.toString('base64'),
        }, embedder.data)

        if (!result.success) throw new Error(result.error)

        await aiToolsFacade.updateDocumentChunkCount(doc.id, user.id, result.data.chunks)
        await aiToolsFacade.updateDocumentStatus(id, user.id, 'completed')
        send({
          status: 'completed',
          message: result.data.deduped ? 'Document unchanged, skipped' : `Ingested ${result.data.chunks} chunks`,
          total_chunks: result.data.chunks,
          deduped: result.data.deduped,
        })
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        log.error('Ingest error', { error: message })
        await aiToolsFacade.updateDocumentStatus(id, user.id, 'failed', message)
        send({ status: 'failed', message })
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return sendStream(event, stream)
})

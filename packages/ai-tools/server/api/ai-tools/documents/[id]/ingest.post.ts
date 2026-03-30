import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { documentService, chunkService } from '#layers/BaseDB/server/services/document.service'
import { readFile } from 'fs/promises'
import { join } from 'path'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Document ID required' })
  }

  // Fetch document
  const docResult = await documentService.findById(id, user.id)
  if (docResult.error || !docResult.data) {
    throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  }

  const doc = docResult.data

  // Update status to processing
  await documentService.updateStatus(id, user.id, 'processing')

  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')

  const sendEvent = (data: object) => {
    return `data: ${JSON.stringify(data)}\n\n`
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial status
        controller.enqueue(encoder.encode(sendEvent({ status: 'processing', message: 'Reading file...' })))

        // Read file from disk
        const filePath = join(process.cwd(), 'upload', doc.storagePath)
        const fileBuffer = await readFile(filePath)
        const text = fileBuffer.toString('utf-8')

        controller.enqueue(encoder.encode(sendEvent({ status: 'processing', message: 'Chunking and embedding...' })))

        // Send to Python backend for chunking + embedding
        const config = useRuntimeConfig()
        const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

        const ingestResult = await $fetch<{
          document_id: string
          chunks: Array<{
            chunk_index: number
            content: string
            token_count: number
            embedding: number[]
            metadata: Record<string, any>
          }>
          total_chunks: number
        }>(`${backendUrl}/api/v1/rag/ingest`, {
          method: 'POST',
          body: {
            document_id: doc.id,
            filename: doc.originalName,
            text,
            chunk_size: 512,
            chunk_overlap: 64,
          },
          headers: {
            'X-User-Id': user.id,
          },
        })

        controller.enqueue(encoder.encode(sendEvent({
          status: 'storing',
          message: `Storing ${ingestResult.total_chunks} chunks...`,
          total_chunks: ingestResult.total_chunks,
        })))

        // Delete existing chunks if re-ingesting
        await chunkService.deleteByDocument(doc.id)

        // Store chunks with embeddings in Turso
        const chunkData = ingestResult.chunks.map(c => ({
          documentId: doc.id,
          userId: user.id,
          chunkIndex: c.chunk_index,
          content: c.content,
          embedding: c.embedding,
          tokenCount: c.token_count,
          metadata: c.metadata,
        }))

        // Insert in batches of 50
        for (let i = 0; i < chunkData.length; i += 50) {
          const batch = chunkData.slice(i, i + 50)
          await chunkService.createMany(batch)
          controller.enqueue(encoder.encode(sendEvent({
            status: 'storing',
            message: `Stored ${Math.min(i + 50, chunkData.length)}/${chunkData.length} chunks`,
            progress: Math.round(((i + 50) / chunkData.length) * 100),
          })))
        }

        // Update document status
        await documentService.updateChunkCount(doc.id, user.id, ingestResult.total_chunks)
        await documentService.updateStatus(id, user.id, 'completed')

        controller.enqueue(encoder.encode(sendEvent({
          status: 'completed',
          message: `Ingested ${ingestResult.total_chunks} chunks`,
          total_chunks: ingestResult.total_chunks,
        })))

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()

      } catch (error: any) {
        await documentService.updateStatus(id, user.id, 'failed', error.message)
        controller.enqueue(encoder.encode(sendEvent({
          status: 'failed',
          message: error.message || 'Ingestion failed',
        })))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
})

import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { documentService, chunkService } from '#layers/BaseDB/server/services/document.service'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'

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
        // Read file from disk
        controller.enqueue(encoder.encode(sendEvent({ status: 'processing', message: 'Reading file...' })))

        const filePath = join(process.cwd(), 'upload', doc.storagePath)
        const fileBuffer = await readFile(filePath)

        // Change detection: compute content hash and compare
        const fileContentHash = createHash('sha256').update(fileBuffer).digest('hex')

        if (doc.contentHash === fileContentHash && doc.status === 'completed') {
          controller.enqueue(encoder.encode(sendEvent({
            status: 'skipped',
            message: 'Document content unchanged, skipping re-ingestion',
            total_chunks: doc.chunkCount,
          })))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        // Content changed or first ingestion — proceed
        await documentService.updateStatus(id!, user.id, 'processing')

        controller.enqueue(encoder.encode(sendEvent({ status: 'processing', message: 'Chunking and embedding...' })))

        // Send to Python backend for chunking + embedding
        const config = useRuntimeConfig()
        const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

        const ingestResult = await $fetch<{
          document_id: string
          chunks: Array<{
            chunk_index: number
            content: string
            content_hash: string
            token_count: number
            embedding: number[]
            metadata: Record<string, any>
          }>
          total_chunks: number
          extracted_text: string
          document_metadata: Record<string, any>
        }>(`${backendUrl}/api/v1/rag/ingest`, {
          method: 'POST',
          body: {
            document_id: doc.id,
            filename: doc.originalName,
            file_content: fileBuffer.toString('base64'),
            mime_type: doc.mimeType,
            chunk_size: 512,
            chunk_overlap: 64,
          },
          headers: {
            'X-User-Id': user.id,
          },
        })

        // Incremental processing: compare with existing chunks
        const existingChunksResult = await chunkService.findByDocument(doc.id)
        const existingChunks = existingChunksResult.data || []

        // Build a set of existing content hashes for quick lookup
        const existingHashMap = new Map<string, string>() // contentHash -> chunkId
        for (const chunk of existingChunks) {
          if (chunk.contentHash) {
            existingHashMap.set(chunk.contentHash, chunk.id)
          }
        }

        // Build a set of new content hashes
        const newHashSet = new Set(ingestResult.chunks.map(c => c.content_hash))

        // Find chunks to delete (exist in DB but not in new set)
        const chunksToDelete: string[] = []
        for (const chunk of existingChunks) {
          if (chunk.contentHash && !newHashSet.has(chunk.contentHash)) {
            chunksToDelete.push(chunk.id)
          }
        }

        // Find chunks to insert (new hashes not in existing map)
        const chunksToInsert = ingestResult.chunks.filter(
          c => !existingHashMap.has(c.content_hash)
        )

        const unchangedCount = ingestResult.chunks.length - chunksToInsert.length

        controller.enqueue(encoder.encode(sendEvent({
          status: 'storing',
          message: `${unchangedCount} unchanged, ${chunksToInsert.length} new/changed, ${chunksToDelete.length} removed`,
          total_chunks: ingestResult.total_chunks,
          unchanged: unchangedCount,
          changed: chunksToInsert.length,
          removed: chunksToDelete.length,
        })))

        // Delete removed chunks
        if (chunksToDelete.length > 0) {
          await chunkService.deleteByIds(chunksToDelete)
        }

        // Insert new/changed chunks with embeddings
        if (chunksToInsert.length > 0) {
          const chunkData = chunksToInsert.map(c => ({
            documentId: doc.id,
            userId: user.id,
            chunkIndex: c.chunk_index,
            content: c.content,
            contentHash: c.content_hash,
            embedding: c.embedding,
            tokenCount: c.token_count,
            metadata: c.metadata,
          }))

          for (let i = 0; i < chunkData.length; i += 50) {
            const batch = chunkData.slice(i, i + 50)
            await chunkService.createMany(batch)
            controller.enqueue(encoder.encode(sendEvent({
              status: 'storing',
              message: `Stored ${Math.min(i + 50, chunkData.length)}/${chunkData.length} new chunks`,
              progress: Math.round(((i + 50) / chunkData.length) * 100),
            })))
          }
        }

        // Update document content hash and chunk count
        await documentService.updateContentHash(doc.id, user.id, fileContentHash)
        await documentService.updateChunkCount(doc.id, user.id, ingestResult.total_chunks)

        // Merge document-level metadata from structured extraction
        let existingMeta: Record<string, any> = {}
        try {
          existingMeta = doc.metadata ? JSON.parse(doc.metadata) : {}
        } catch { /* invalid JSON */ }

        const mergedMeta = {
          ...existingMeta,
          ...ingestResult.document_metadata,
        }

        // Extract document metadata via LLM (best-effort, don't block ingestion)
        controller.enqueue(encoder.encode(sendEvent({
          status: 'extracting',
          message: 'Extracting document metadata...',
        })))

        try {
          const metadataResult = await $fetch<{
            title: string
            author: string
            language: string
            topics: string[]
            summary: string
            document_type: string
          }>(`${backendUrl}/api/v1/rag/extract-metadata`, {
            method: 'POST',
            body: { text: ingestResult.extracted_text },
            headers: { 'X-User-Id': user.id },
          })

          await documentService.updateMetadata(doc.id, user.id, {
            ...mergedMeta,
            title: metadataResult.title,
            author: metadataResult.author,
            language: metadataResult.language,
            topics: metadataResult.topics,
            summary: metadataResult.summary,
            document_type: metadataResult.document_type,
            extractedAt: new Date().toISOString(),
          })

          controller.enqueue(encoder.encode(sendEvent({
            status: 'extracting',
            message: `Metadata extracted: "${metadataResult.title}"`,
            metadata: metadataResult,
          })))
        } catch (metaError: any) {
          // Still save the structured metadata even if LLM extraction fails
          await documentService.updateMetadata(doc.id, user.id, mergedMeta)

          controller.enqueue(encoder.encode(sendEvent({
            status: 'extracting',
            message: 'Metadata extraction skipped (LLM unavailable)',
          })))
        }

        await documentService.updateStatus(id!, user.id, 'completed')

        controller.enqueue(encoder.encode(sendEvent({
          status: 'completed',
          message: `Ingested ${ingestResult.total_chunks} chunks (${chunksToInsert.length} new, ${unchangedCount} unchanged)`,
          total_chunks: ingestResult.total_chunks,
          new_chunks: chunksToInsert.length,
          unchanged_chunks: unchangedCount,
        })))

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()

      } catch (error: any) {
        await documentService.updateStatus(id!, user.id, 'failed', error.message)
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

import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { documentService, chunkService } from '#layers/BaseDB/server/services/document.service'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'
import { createLlmJwt } from '#layers/BaseDB/server/utils/llm-jwt'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'

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

        // Get LLM config and create JWT for Python backend auth
        const config = useRuntimeConfig()
        const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'
        
        const llmConfigResult = await userLlmConfigService.getDefaultConfig(user.id)
        const llmConfig = llmConfigResult.data ?? null
        const llmJwt = createLlmJwt(user.id, user.email || '', llmConfig)

        // Get existing chunks before new ingestion
        const existingChunksResult = await chunkService.findByDocument(doc.id)
        const existingChunks = existingChunksResult.data || []

        controller.enqueue(encoder.encode(sendEvent({ status: 'processing', message: 'Calling backend...' })))

        // Call Python backend with streaming
        const backendResponse = await fetch(`${backendUrl}/api/v1/rag/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${llmJwt}`,
          },
          body: JSON.stringify({
            document_id: doc.id,
            filename: doc.originalName,
            file_content: fileBuffer.toString('base64'),
            mime_type: doc.mimeType,
            chunk_size: 256,
            chunk_overlap: 32,
          }),
        })

        if (!backendResponse.ok) {
          const errorText = await backendResponse.text()
          throw new Error(`Backend error: ${errorText}`)
        }

        if (!backendResponse.body) {
          throw new Error('No response body from backend')
        }

        // Parse SSE stream from Python backend
        const reader = backendResponse.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let finalChunks: any[] = []
        let totalChunks = 0
        let extractedText = ''
        let documentMetadata: Record<string, any> = {}

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const jsonStr = line.slice(6)
            if (jsonStr === '[DONE]') continue

            try {
              const event = JSON.parse(jsonStr)

              // Forward event to frontend
              controller.enqueue(encoder.encode(sendEvent(event)))

              // Collect chunks when received
              if (event.status === 'chunks' && event.chunks) {
                finalChunks = event.chunks
                totalChunks = event.total_chunks || finalChunks.length
              }

              // Collect final data when done
              if (event.status === 'done') {
                totalChunks = event.total_chunks || 0
                extractedText = event.extracted_text || ''
                documentMetadata = event.document_metadata || {}
              }
            } catch { /* skip invalid JSON */ }
          }
        }

        const ingestResult = {
          chunks: finalChunks,
          total_chunks: totalChunks,
          extracted_text: extractedText,
          document_metadata: documentMetadata,
        }

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

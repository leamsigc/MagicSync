import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
import { documentIngestService } from '#layers/BaseDB/server/services/document-ingest.service'
import { resolveEmbedder } from '#layers/BaseAgent/server/utils/embeddings'

const IngestSchema = z.object({
  businessId: z.string().min(1),
  filename: z.string().min(1).max(300),
  mimeType: z.string().min(1).max(120),
  text: z.string().max(500_000).optional(),
  base64: z.string().max(8_000_000).optional(),
}).refine(value => Boolean(value.text || value.base64), { message: 'text or base64 is required' })

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = IngestSchema.parse(await readBody(event))

  const access = await requireBusinessAccess(event, user.id, body.businessId)
  if (!access.success) {
    throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
  }

  const embedder = await resolveEmbedder(user.id, body.businessId)
  if (!embedder.success) {
    throw createError({ statusCode: 400, message: embedder.error })
  }

  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'X-Accel-Buffering', 'no')

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }
      send({ type: 'ingest.progress', stage: 'parsing' })
      const result = await documentIngestService.ingest(user.id, {
        filename: body.filename,
        mimeType: body.mimeType,
        text: body.text,
        base64: body.base64,
      }, embedder.data)
      if (!result.success) {
        send({ type: 'error', code: result.code ?? 'INGEST_FAILED', message: result.error })
      }
      else {
        send({ type: 'ingest.progress', stage: 'stored' })
        send({
          type: 'ingest.completed',
          documentId: result.data.document.id,
          chunks: result.data.chunks,
          deduped: result.data.deduped,
        })
      }
      controller.close()
    },
  })

  return sendStream(event, stream)
})

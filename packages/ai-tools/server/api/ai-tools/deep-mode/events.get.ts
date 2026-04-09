import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const query = getQuery(event)
  const threadId = query.thread_id as string | undefined
  
  if (!threadId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'thread_id is required'
    })
  }

  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')
  setHeader(event, 'X-Accel-Buffering', 'no')

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      
      const sendEvent = (data: Record<string, unknown>) => {
        const message = `data: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }

      const sendHeartbeat = () => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'))
      }

      let heartbeatInterval: ReturnType<typeof setInterval> | null = null
      let cleanupFn: (() => void) | null = null

      const cleanup = () => {
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval)
          heartbeatInterval = null
        }
        if (cleanupFn) {
          cleanupFn()
          cleanupFn = null
        }
      }

      try {
        heartbeatInterval = setInterval(sendHeartbeat, 30000)

        sendEvent({
          type: 'connected',
          thread_id: threadId,
          timestamp: Date.now()
        })

      } catch (error) {
        console.error('SSE error:', error)
        cleanup()
        controller.close()
      }

      event.node.req.on('close', () => {
        cleanup()
      })
    }
  })

  return sendEventStream(event, stream)
})

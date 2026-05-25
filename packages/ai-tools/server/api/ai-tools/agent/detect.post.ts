import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const body = await readBody(event)

  log.set({ message: body.message?.substring(0, 100) })

  if (!body?.message?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Message is required' })
  }

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  const result = await $fetch<{
    should_spawn: boolean
    task_type: string | null
    sub_agent_task: string | null
    confidence: number
  }>(`${backendUrl}/api/v1/agent/detect`, {
    method: 'POST',
    body: {
      message: body.message,
      context: body.context || [],
    },
    headers: { 'X-User-Id': user.id },
  })

  return result
})

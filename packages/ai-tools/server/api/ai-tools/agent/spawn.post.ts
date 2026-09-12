import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const body = await readBody(event)

  log.set({ task: body.task?.substring(0, 100), parentMessageId: body.parent_message_id })

  if (!body?.task?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Task is required' })
  }

  if (!body?.parent_message_id) {
    throw createError({ statusCode: 400, statusMessage: 'Parent message ID is required' })
  }

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  const spawnBusinessId = typeof body.businessId === 'string' ? body.businessId : (typeof body.business_id === 'string' ? body.business_id : null)
  const llmJwtResult = await aiToolsFacade.getLlmJwtContext(user.id, user.email || '', spawnBusinessId)
  const llmJwt = llmJwtResult.data?.token ?? ''

  // Spawn on Python backend
  const result = await $fetch<{
    id: string
    task: string
    status: string
    parent_message_id: string
    max_steps: number
    step_count: number
  }>(`${backendUrl}/api/v1/agent/spawn`, {
    method: 'POST',
    body: {
      task: body.task,
      parent_message_id: body.parent_message_id,
      context: body.context || null,
      max_steps: body.max_steps || 10,
      business_id: spawnBusinessId,
      use_business_context: body.useBusinessContext === true || body.use_business_context === true,
    },
    headers: { Authorization: `Bearer ${llmJwt}` },
  })

  // Persist in DB
  await aiToolsFacade.createAgentSession({
    id: result.id,
    userId: user.id,
    parentMessageId: body.parent_message_id,
    threadId: body.thread_id,
    task: result.task,
    taskType: body.task_type,
    maxSteps: result.max_steps,
    metadata: body.metadata,
  })

  return result
})

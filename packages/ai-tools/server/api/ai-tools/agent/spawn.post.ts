import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { agentService } from '#layers/BaseDB/server/services/agent.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  if (!body?.task?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Task is required' })
  }

  if (!body?.parent_message_id) {
    throw createError({ statusCode: 400, statusMessage: 'Parent message ID is required' })
  }

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

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
    },
    headers: { 'X-User-Id': user.id },
  })

  // Persist in DB
  await agentService.create({
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

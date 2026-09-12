import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { chatService } from '#layers/BaseDB/server/services/chat.service'
import { businessContextResolver, contextErrorStatus } from '#layers/BaseDB/server/services/business-context-resolver.service'
import { userLlmConfigService } from '#layers/BaseDB/server/services/user-llm-config.service'
import { createLlmJwt } from '#layers/BaseDB/server/utils/llm-jwt'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  const body = await readBody(event)

  log.set({ action: body.action, componentId: body.componentId, surfaceId: body.surfaceId })

  if (!body?.action) {
    throw createError({ statusCode: 400, statusMessage: 'Action is required' })
  }

  const config = useRuntimeConfig()
  const backendUrl = config.pythonBackendUrl || 'http://localhost:8000'

  const contextResult = await businessContextResolver.resolve(user.id, {
    businessId: body.businessId ?? body.business_id ?? null,
    useBusinessContext: body.useBusinessContext === true || body.use_business_context === true,
  }, event)
  if (!contextResult.success || !contextResult.data) {
    throw createError({ statusCode: contextErrorStatus(contextResult.code), message: contextResult.error })
  }
  const brandContext = contextResult.data
  const llmConfig = await userLlmConfigService.getEffectiveConfig(user.id, brandContext.businessId)
  const llmJwt = createLlmJwt(user.id, user.email || '', llmConfig.data ?? null)

  // Build a system-readable message from the A2UI action
  const actionMessage = `[A2UI Action] ${body.action} on component ${body.componentId || 'unknown'} (surface: ${body.surfaceId || 'default'})${body.payload ? ` with data: ${JSON.stringify(body.payload)}` : ''}`

  // Forward the action to the Python backend as a chat message
  const response = await $fetch(`${backendUrl}/api/v1/chat/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llmJwt}`,
    },
    body: {
      // /chat/complete injects business_context as the system message.
      messages: [
        { role: 'user', content: actionMessage },
      ],
      model: 'llama3.2',
      temperature: 0.3,
      business_id: brandContext.businessId,
      use_business_context: brandContext.enabled,
      context_edition_id: brandContext.editionId,
      business_context: brandContext.prompt || undefined,
    },
  })

  return {
    action: body.action,
    componentId: body.componentId,
    response: response?.message?.content || '',
  }
})

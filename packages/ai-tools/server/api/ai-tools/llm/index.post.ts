import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const body = await readBody(event)

  log.set({ provider: body.provider, model: body.model })

  if (!body?.provider || !body?.model) {
    throw createError({ statusCode: 400, statusMessage: 'Provider and model are required' })
  }

  const result = await aiToolsFacade.createLlmConfig(user.id, {
    provider: body.provider,
    model: body.model,
    apiKey: body.apiKey,
    apiBaseUrl: body.apiBaseUrl,
    isDefault: body.isDefault,
    temperature: body.temperature,
    maxTokens: body.maxTokens,
  })

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})

import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const configId = getRouterParam(event, 'id')

  log.set({ configId })

  if (!configId) {
    throw createError({ statusCode: 400, statusMessage: 'Config ID is required' })
  }

  const result = await aiToolsFacade.setDefaultLlmConfig(user.id, configId)

  if (result.error) {
    const statusCode = result.code === 'NOT_FOUND' ? 404 : 500
    throw createError({ statusCode, statusMessage: result.error })
  }

  return result.data
})

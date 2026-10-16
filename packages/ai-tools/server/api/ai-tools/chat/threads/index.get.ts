import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const businessId = getQuery(event).businessId
  const scope = typeof businessId === 'string' && businessId.length > 0 ? businessId : undefined

  log.info('Listing threads', { businessId: scope ?? null })

  const result = await aiToolsFacade.getThreads(user.id, scope)

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})

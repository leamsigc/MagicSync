import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)

  log.info('Listing documents', {})

  const result = await aiToolsFacade.getDocuments(user.id)

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})

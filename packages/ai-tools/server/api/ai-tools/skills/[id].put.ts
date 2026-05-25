import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const id = getRouterParam(event, 'id')

  log.set({ skillId: id })

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Skill ID required' })
  }

  const body = await readBody(event)

  const result = await aiToolsFacade.updateSkill(id, user.id, body)

  if (result.error) {
    throw createError({ statusCode: 404, statusMessage: result.error })
  }

  return result.data
})
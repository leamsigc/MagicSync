import { aiToolsFacade } from '#ai-tools/server/services/aiToolsFacade.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await aiToolsFacade.authenticate(event)
  const body = await readBody(event)

  log.set({ skillName: body.name })

  if (!body.name || !body.description || !body.instructions) {
    throw createError({ statusCode: 400, statusMessage: 'Name, description, and instructions are required' })
  }

  const result = await aiToolsFacade.createSkill(user.id, {
    name: body.name,
    description: body.description,
    instructions: body.instructions,
    isGlobal: body.isGlobal
  })

  if (result.error) {
    throw createError({ statusCode: 500, statusMessage: result.error })
  }

  return result.data
})
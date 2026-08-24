import { menuBoardService } from '#layers/BaseDB/server/services/menu-board.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    const result = await menuBoardService.listForUser(user.id)

    if (result.error) {
      throw createError({ statusCode: 500, statusMessage: result.error })
    }

    return { boards: result.data ?? [] }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error
    log.error({ content: 'List menu boards failed', error: String(error) })
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})

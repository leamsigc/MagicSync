import { menuBoardService } from '#layers/BaseDB/server/services/menu-board.service'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    const boardId = getRouterParam(event, 'id')

    if (!boardId) {
      throw createError({ statusCode: 400, statusMessage: 'Board id is required' })
    }

    const result = await menuBoardService.remove(user.id, boardId)
    if (result.error) {
      throw createError({ statusCode: 500, statusMessage: result.error })
    }

    return { success: true }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error
    log.error({ content: 'Delete menu board failed', error: String(error) })
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})

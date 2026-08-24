import { menuBoardService } from '#layers/BaseDB/server/services/menu-board.service'

/**
 * Public endpoint — renders a shared menu board by slug.
 * No auth required.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const slug = getRouterParam(event, 'slug')

    if (!slug || slug.length > 64 || !/^[a-zA-Z0-9-]+$/.test(slug)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid share id' })
    }

    const result = await menuBoardService.getPublic(slug)
    if (result.error || !result.data) {
      throw createError({ statusCode: 404, statusMessage: result.error ?? 'Shared menu not found' })
    }

    return { board: result.data }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error
    log.error({ content: 'Get public menu board failed', error: String(error) })
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})

import { z } from 'zod'
import { menuBoardService } from '#layers/BaseDB/server/services/menu-board.service'

const shareSchema = z.object({
  isPublic: z.boolean(),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  try {
    const user = await checkUserIsLogin(event)
    const boardId = getRouterParam(event, 'id')

    if (!boardId) {
      throw createError({ statusCode: 400, statusMessage: 'Board id is required' })
    }

    const body = await readBody(event)
    const parsed = shareSchema.safeParse(body)
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'isPublic boolean is required' })
    }

    const result = parsed.data.isPublic
      ? await menuBoardService.publish(user.id, boardId)
      : await menuBoardService.unpublish(user.id, boardId)

    if (result.error) {
      throw createError({ statusCode: 500, statusMessage: result.error })
    }

    return {
      isPublic: parsed.data.isPublic,
      slug: 'data' in result && result.data ? (result.data as { slug?: string }).slug ?? null : null,
    }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error
    log.error({ content: 'Share menu board failed', error: String(error) })
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})

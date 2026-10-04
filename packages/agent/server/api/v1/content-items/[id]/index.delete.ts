import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { contentBoardService } from '#layers/BaseDB/server/services/content-board.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  const businessId = getQuery(event).businessId
  if (!id || typeof businessId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'businessId and item id are required' })
  }

  const result = await contentBoardService.remove(user.id, businessId, id, event)
  if (!result.success) {
    throw createError({ statusCode: result.code === 'NOT_FOUND' ? 404 : 400, statusMessage: result.error })
  }
  return { id: result.data.id }
})

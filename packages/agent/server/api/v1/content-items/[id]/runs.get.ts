import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { contentBoardService } from '#layers/BaseDB/server/services/content-board.service'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const id = getRouterParam(event, 'id')
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : ''
  if (!id || !businessId) {
    throw createError({ statusCode: 400, statusMessage: 'businessId and item id are required' })
  }

  const result = await contentBoardService.listRuns(user.id, businessId, id, event)
  if (!result.success) {
    throw createError({
      statusCode: result.code === 'NOT_FOUND' ? 404 : 500,
      statusMessage: result.error,
    })
  }
  return { runs: result.data }
})

import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
import { contentBoardService } from '#layers/BaseDB/server/services/content-board.service'
import type { ContentItemState } from '#layers/BaseDB/db/schema'

export default defineEventHandler(async (event) => {
  const user = await checkUserIsLogin(event)
  const query = getQuery(event)
  const businessId = typeof query.businessId === 'string' ? query.businessId : ''
  if (!businessId) throw createError({ statusCode: 400, statusMessage: 'businessId is required' })

  const access = await requireBusinessAccess(event, user.id, businessId)
  if (!access.success) {
    throw createError({ statusCode: accessErrorStatus(access.code), statusMessage: access.error })
  }

  const result = await contentBoardService.list(user.id, businessId, {
    state: typeof query.state === 'string' ? query.state as ContentItemState : undefined,
    limit: typeof query.limit === 'string' ? Number(query.limit) : undefined,
  }, event)
  if (!result.success) throw createError({ statusCode: 500, statusMessage: result.error })
  return { items: result.data }
})

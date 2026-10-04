import { z } from 'zod'
import { assetService } from '#layers/BaseShared/server/services/asset.service'

const querySchema = z.object({
  businessId: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const folderId = getRouterParam(event, 'id')
  const parsed = querySchema.safeParse(getQuery(event))
  if (!folderId || !parsed.success) {
    log.error('Invalid folder delete request', { folderId })
    throw createError({ statusCode: 400, statusMessage: 'businessId and folder id are required' })
  }

  const result = await assetService.deleteFolder(folderId, parsed.data.businessId, user.id, event)
  if (!result.success) {
    log.error('Failed to delete asset folder', { code: result.code, error: result.error })
    throw createError({
      statusCode: result.code === 'NOT_FOUND' ? 404 : 500,
      statusMessage: result.error,
    })
  }

  log.info('Asset folder deleted', { folderId, unfiledCount: result.data.unfiledCount })
  return { success: true, data: result.data }
})
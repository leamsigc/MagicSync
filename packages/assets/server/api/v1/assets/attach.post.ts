import { z } from 'zod'
import { assetService } from '#layers/BaseShared/server/services/asset.service'

/**
 * POST /api/v1/assets/attach — adopt the caller's personal assets into a
 * business they belong to. Rows that already belong to a business are left
 * untouched; another member's personal rows can never match.
 */

const bodySchema = z.object({
  assetIds: z.array(z.string().min(1)).min(1).max(500),
  businessId: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    log.error('Invalid attach payload', { issues: parsed.error.issues })
    throw createError({ statusCode: 400, statusMessage: 'assetIds and businessId are required' })
  }

  const result = await assetService.attachToBusiness(
    parsed.data.assetIds,
    user.id,
    parsed.data.businessId,
    event,
  )

  if (!result.success) {
    log.error('Failed to attach assets', { code: result.code, error: result.error })
    throw createError({
      statusCode: result.code === 'NOT_FOUND' ? 404 : result.code === 'FORBIDDEN' ? 403 : 500,
      statusMessage: result.error,
    })
  }

  log.info('Assets attached to business', { attached: result.data.attached })
  return { success: true, data: result.data }
})

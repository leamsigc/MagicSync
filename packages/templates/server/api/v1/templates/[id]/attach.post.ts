/**
 * POST /api/v1/templates/[id]/attach — attach an owned template to a business.
 *
 * Templates created without an active workspace have `businessId = NULL` and
 * only their creator can see them. This adopts the row into a business the
 * caller belongs to, so the rest of the team can use it.
 */

import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { templateService } from '#layers/BaseDB/server/services/template.service'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'

const bodySchema = z.object({
  businessId: z.string().min(1),
})

function attachErrorStatus(code?: string): number {
  if (code === 'NOT_FOUND') return 404
  if (code === 'FORBIDDEN') return 403
  return 500
}

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const user = await checkUserIsLogin(event)
  log.set({ userId: user.id })

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Template ID is required' })
  }

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'businessId is required' })
  }

  const access = await requireBusinessAccess(event, user.id, parsed.data.businessId)
  if (!access.success) {
    throw createError({
      statusCode: accessErrorStatus(access.code),
      statusMessage: access.error ?? 'Business not found',
    })
  }

  const result = await templateService.attachToBusiness(id, user.id, parsed.data.businessId)
  if (!result.success) {
    throw createError({
      statusCode: attachErrorStatus(result.code),
      statusMessage: result.error ?? 'Failed to attach template',
    })
  }

  log.info('Template attached to business', { templateId: id, businessId: parsed.data.businessId })
  return { success: true, data: result.data }
})

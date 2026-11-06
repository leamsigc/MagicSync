import { z } from 'zod'
import { designService, brandKitService } from '#layers/BaseDB/server/services/design.service'
import { accessErrorStatus, requireBusinessAccess } from '#layers/BaseDB/server/utils/business-access'
import { requireDesignAuth } from '../../../utils/design-auth'

const brandSchema = z.object({
  action: z.enum(['list', 'create', 'update', 'delete']),
  id: z.string().max(64).optional(),
  businessId: z.string().max(64).optional(),
  name: z.string().max(80).optional(),
  colors: z.unknown().optional(),
  fonts: z.unknown().optional(),
  logoUrl: z.string().max(600).nullable().optional(),
  defaults: z.unknown().optional(),
})

/**
 * Brand kits — one compact endpoint (list/create/update/delete) to keep the
 * studio panel simple. The panel applies a kit with one click.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const principal = await requireDesignAuth(event)
  log.set({ userId: principal.userId })
  const body = await readValidatedBody(event, raw => brandSchema.parse(raw))

  const access = body.businessId
    ? await requireBusinessAccess(event, principal.userId, body.businessId)
    : null
  if (body.businessId && (!access || !access.success || !access.data)) {
    throw createError({
      statusCode: access ? accessErrorStatus(access.code) : 403,
      statusMessage: access?.error ?? 'You do not have access to this business',
    })
  }

  if (body.action === 'list') {
    const result = await brandKitService.list(principal.userId, body.businessId)
    return { kits: result.success ? result.data : [] }
  }
  if (body.action === 'create') {
    const result = await brandKitService.create(principal.userId, {
      name: body.name ?? '',
      colors: body.colors,
      fonts: body.fonts,
      logoUrl: body.logoUrl,
      defaults: body.defaults,
    }, body.businessId, access?.data?.ownerUserId)
    if (!result.success || !result.data) throw createError({ statusCode: 400, statusMessage: result.error ?? 'Failed to create brand kit' })
    return { kit: result.data }
  }
  if (body.action === 'update') {
    if (!body.id) throw createError({ statusCode: 400, statusMessage: 'Brand kit id is required' })
    const result = await brandKitService.update(body.id, principal.userId, {
      name: body.name,
      colors: body.colors,
      fonts: body.fonts,
      logoUrl: body.logoUrl,
      defaults: body.defaults,
    })
    if (!result.success || !result.data) throw createError({ statusCode: 400, statusMessage: result.error ?? 'Failed to update brand kit' })
    return { kit: result.data }
  }
  if (!body.id) throw createError({ statusCode: 400, statusMessage: 'Brand kit id is required' })
  const deleted = await brandKitService.remove(body.id, principal.userId)
  if (!deleted.success) throw createError({ statusCode: 400, statusMessage: deleted.error ?? 'Failed to delete brand kit' })
  return { id: body.id }
})

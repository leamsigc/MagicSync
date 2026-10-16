import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { adminDataService } from '#layers/BaseDB/server/services/admin-data.service'
import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service'

/**
 * Row keys travel in the body, not the URL: composite primary keys are joined
 * with a control character and text keys may contain `/`, neither of which
 * survives a path segment intact.
 */
const AdminRowUpdateSchema = z.object({
  key: z.string().min(1).max(512),
  values: z.record(
    z.string().min(1).max(120),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  ),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const table = getRouterParam(event, 'table') ?? ''
  const body = await readValidatedBody(event, AdminRowUpdateSchema.parse)
  const result = await adminDataService.updateRow(table, body.key, body.values)
  if (!result.success) {
    const statusCode = result.code === 'NOT_FOUND' ? 404 : result.code === 'VALIDATION_ERROR' ? 400 : 500
    throw createError({ statusCode, message: result.error })
  }

  await logAuditService.logAuditEvent({
    userId: currentUser.id,
    category: 'admin',
    action: 'ADMIN_DATA_UPDATE',
    targetType: table,
    targetId: body.key,
    status: 'success',
    details: `Updated row in ${table} (fields: ${Object.keys(body.values).join(', ')})`,
  }, { log })

  return { row: result.data }
})

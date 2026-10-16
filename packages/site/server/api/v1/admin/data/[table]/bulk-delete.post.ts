import { z } from 'zod'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { adminDataService } from '#layers/BaseDB/server/services/admin-data.service'
import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service'

const AdminBulkDeleteSchema = z.object({
  keys: z.array(z.string().min(1).max(512)).min(1).max(500),
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const table = getRouterParam(event, 'table') ?? ''
  const body = await readValidatedBody(event, AdminBulkDeleteSchema.parse)
  const result = await adminDataService.deleteRows(table, body.keys)
  if (!result.success) {
    const statusCode = result.code === 'NOT_FOUND' ? 404 : result.code === 'VALIDATION_ERROR' ? 400 : 500
    throw createError({ statusCode, message: result.error })
  }

  await logAuditService.logAuditEvent({
    userId: currentUser.id,
    category: 'admin',
    action: 'ADMIN_DATA_DELETE_ROWS',
    targetType: table,
    status: 'success',
    details: `Deleted ${result.data.deleted} row(s) from ${table}`,
  }, { log })

  return { deleted: result.data.deleted }
})

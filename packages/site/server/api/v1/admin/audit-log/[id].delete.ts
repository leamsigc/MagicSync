import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const idParam = getRouterParam(event, 'id')
  const id = Number(idParam)
  if (!idParam || Number.isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid log id' })
  }

  const result = await logAuditService.deleteById(id)
  if (!result.success) {
    throw createError({ statusCode: 500, message: result.error || 'Failed to delete log' })
  }

  await logAuditService.logAuditEvent({
    userId: currentUser.id,
    category: 'admin',
    action: 'AUDIT_LOG_DELETE',
    targetType: 'audit_log',
    targetId: String(id),
    status: 'success',
    details: `Deleted audit log entry ${id}`
  })

  return { success: true }
})

import { z } from 'zod'
import { logAuditService } from '#layers/BaseDB/server/services/auditLog.service'
import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'

const DeleteAuditLogSchema = z.object({
  ids: z.array(z.number()).optional(),
  all: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const body = await readValidatedBody(event, DeleteAuditLogSchema.parse)

  let result
  if (body.all) {
    result = await logAuditService.deleteAll()
  } else {
    const ids = body.ids || []
    if (ids.length === 0) {
      throw createError({ statusCode: 400, message: 'No logs selected' })
    }
    result = await logAuditService.deleteMany(ids)
  }

  if (!result.success) {
    throw createError({ statusCode: 500, message: result.error || 'Failed to delete logs' })
  }

  await logAuditService.logAuditEvent({
    userId: currentUser.id,
    category: 'admin',
    action: body.all ? 'AUDIT_LOG_DELETE_ALL' : 'AUDIT_LOG_DELETE_MANY',
    targetType: 'audit_log',
    status: 'success',
    details: body.all ? 'Deleted all audit log entries' : `Deleted ${body.ids?.length} audit log entries`
  }, { log })

  return { success: true }
})

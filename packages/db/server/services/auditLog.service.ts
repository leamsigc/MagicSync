import { auditLog } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle';
export class LogAuditService {

  private db = useDrizzle();



  async logAuditEvent(data: {
    userId?: string
    category: 'auth' | 'email' | 'payment' | string
    action: string
    targetType?: string
    targetId?: string
    ipAddress?: string
    userAgent?: string
    status?: 'success' | 'failure' | 'pending'
    details?: string
  }) {
    try {
      await this.db.insert(auditLog).values({
        userId: data.userId,
        category: data.category,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: data.status || 'success',
        details: data.details,
        createdAt: dayjs.utc().toDate()
      })
    } catch (error) {
      console.error('Failed to log audit event:', error)
    }
  }
}


export const logAuditService = new LogAuditService()

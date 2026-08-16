import { eq, inArray } from 'drizzle-orm'
import { auditLog } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import type { LogAuditServiceType } from './interfaces'

export class LogAuditService implements LogAuditServiceType {

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

  async deleteById(id: number) {
    try {
      await this.db.delete(auditLog).where(eq(auditLog.id, id))
      return { success: true }
    } catch (error) {
      console.error('Failed to delete audit log:', error)
      return { success: false, error: 'Failed to delete audit log' }
    }
  }

  async deleteMany(ids: number[]) {
    try {
      if (ids.length === 0) return { success: true }
      await this.db.delete(auditLog).where(inArray(auditLog.id, ids))
      return { success: true }
    } catch (error) {
      console.error('Failed to delete audit logs:', error)
      return { success: false, error: 'Failed to delete audit logs' }
    }
  }

  async deleteAll() {
    try {
      await this.db.delete(auditLog)
      return { success: true }
    } catch (error) {
      console.error('Failed to delete all audit logs:', error)
      return { success: false, error: 'Failed to delete all audit logs' }
    }
  }
}


export const logAuditService = new LogAuditService()

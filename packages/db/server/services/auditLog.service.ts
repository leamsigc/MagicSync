import { eq, inArray } from 'drizzle-orm'
import type { RequestLogger } from 'evlog'
import { auditLog } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { auditEvent } from '#layers/BaseShared/server/utils/evlog'
import { redactSecrets } from '../utils/redact-secrets'
import type { LogAuditServiceType } from './interfaces'

interface DualAuditData {
  userId?: string
  action: string
  targetType?: string
  targetId?: string
  status?: 'success' | 'failure' | 'pending'
  details?: string
}

/**
 * Dual-write: the DB row stays the system of record, the same fact is also
 * emitted onto the request wide event for the log drains. Skipped when no
 * request logger or no actor is available.
 */
function emitDualAudit(log: RequestLogger | undefined, data: DualAuditData): void {
  if (!log || !data.userId) return
  auditEvent(log, {
    action: data.action,
    actorId: data.userId,
    targetType: data.targetType,
    targetId: data.targetId,
    outcome: data.status === 'failure' ? 'failure' : 'success',
    reason: data.details,
  })
}

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
  }, opts?: { log?: RequestLogger }) {
    try {
      // The sink is the last boundary before durable storage and the log drain,
      // so it redacts for itself. Call sites currently hand-pick non-sensitive
      // fields, but that is a convention nothing enforces.
      const details = data.details === undefined ? undefined : redactSecrets(data.details)
      await this.db.insert(auditLog).values({
        userId: data.userId,
        category: data.category,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: data.status || 'success',
        details,
        createdAt: dayjs.utc().toDate()
      })
      emitDualAudit(opts?.log, { ...data, details })
    } catch (error) {
      log.error({ message: 'Failed to log audit event', error: String(error) })
    }
  }

  async deleteById(id: number) {
    try {
      await this.db.delete(auditLog).where(eq(auditLog.id, id))
      return { success: true }
    } catch (error) {
      log.error({ message: 'Failed to delete audit log', error: String(error) })
      return { success: false, error: 'Failed to delete audit log' }
    }
  }

  async deleteMany(ids: number[]) {
    try {
      if (ids.length === 0) return { success: true }
      await this.db.delete(auditLog).where(inArray(auditLog.id, ids))
      return { success: true }
    } catch (error) {
      log.error({ message: 'Failed to delete audit logs', error: String(error) })
      return { success: false, error: 'Failed to delete audit logs' }
    }
  }

  async deleteAll() {
    try {
      await this.db.delete(auditLog)
      return { success: true }
    } catch (error) {
      log.error({ message: 'Failed to delete all audit logs', error: String(error) })
      return { success: false, error: 'Failed to delete all audit logs' }
    }
  }
}


export const logAuditService = new LogAuditService()

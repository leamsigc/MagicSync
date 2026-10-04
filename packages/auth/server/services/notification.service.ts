import { and, desc, eq, gte } from 'drizzle-orm'
import { NOTIFICATION_EVENTS, notificationPreferences, notifications, user, type Notification, type NotificationEvent } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import type { ServiceResponse } from '#layers/BaseDB/server/services/types'

/**
 * Notification Service
 * Handles user notification operations.
 * All methods return ServiceResponse<T> and never throw.
 */

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface CreateNotificationData {
    type: NotificationType
    title: string
    message: string
    actionUrl?: string
    metadata?: unknown
    event?: NotificationEvent
}

export interface NotifyInput {
    userId: string
    event: NotificationEvent
    type: NotificationType
    title: string
    message: string
    actionUrl?: string
    metadata?: unknown
}

export interface PreferenceInput {
    event: string
    inApp?: boolean
    email?: boolean
    mutedUntil?: string | null
}

export interface EffectivePreference {
    event: NotificationEvent
    inApp: boolean
    email: boolean
    customized: boolean
    mutedUntil?: string | null
}

export interface DigestRecipient {
    userId: string
    email: string
    name: string
    items: { title: string; message: string; actionUrl?: string | null }[]
}

export interface NotificationQueryOptions {
    limit?: number
    offset?: number
    unreadOnly?: boolean
}

class NotificationService {
    /**
     * Get user notifications with pagination
     */
    async getNotifications(userId: string, options: NotificationQueryOptions = {}): Promise<ServiceResponse<Notification[]>> {
        try {
            const db = useDrizzle()
            const { limit = 20, offset = 0, unreadOnly = false } = options

            const conditions = [eq(notifications.userId, userId)]

            if (unreadOnly) {
                conditions.push(eq(notifications.read, false))
            }

            const results = await db
                .select()
                .from(notifications)
                .where(and(...conditions))
                .orderBy(desc(notifications.createdAt))
                .limit(limit)
                .offset(offset)

            return { success: true, data: results }
        } catch {
            return { success: false, error: 'Failed to fetch notifications' }
        }
    }

    /**
     * Create a new notification
     */
    async createNotification(userId: string, data: CreateNotificationData): Promise<ServiceResponse<Notification>> {
        try {
            const db = useDrizzle()

            // Respect per-event preferences: each channel is independent
            const event = data.event ?? 'general'
            const [inAppEnabled, emailEnabled] = await Promise.all([
                this.isInAppEnabled(userId, event),
                this.isEmailEnabled(userId, event),
            ])
            if (!inAppEnabled && !emailEnabled) {
                return { success: true, code: 'SKIPPED_BY_PREF' }
            }

            let row: Notification | undefined
            if (inAppEnabled) {
                const result = await db
                    .insert(notifications)
                    .values({
                        userId,
                        event,
                        type: data.type,
                        title: data.title,
                        message: data.message,
                        actionUrl: data.actionUrl,
                        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
                        read: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    })
                    .returning()

                if (!result[0]) {
                    return { success: false, error: 'Failed to create notification' }
                }
                row = result[0]
            }

            // Immediate email is best-effort: failures are logged, never thrown.
            // Skip quietly when Mailgun is not configured (dev) to avoid log spam.
            const mailConfigured = !!process.env.NUXT_MAILGUN_API_KEY && !!process.env.NUXT_MAILGUN_DOMAIN
            if (emailEnabled && mailConfigured) {
                try {
                    const owners = await db
                        .select({ email: user.email })
                        .from(user)
                        .where(eq(user.id, userId))
                    const email = owners[0]?.email
                    if (email) {
                        const { sendNotificationEmail } = await import('#layers/BaseEmail/server/utils/email')
                        await sendNotificationEmail(email, data.title, data.message, data.actionUrl)
                    }
                } catch (emailError) {
                    log.error({ message: 'Failed to send immediate notification email', detail: emailError })
                }
            }

            if (row) {
                return { success: true, data: row }
            }
            return { success: true, code: 'EMAIL_ONLY' }
        } catch {
            return { success: false, error: 'Failed to create notification' }
        }
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId: number, userId: string): Promise<ServiceResponse<Notification>> {
        try {
            const db = useDrizzle()

            const result = await db
                .update(notifications)
                .set({
                    read: true,
                    updatedAt: new Date()
                })
                .where(
                    and(
                        eq(notifications.id, notificationId),
                        eq(notifications.userId, userId)
                    )
                )
                .returning()

            if (!result || result.length === 0 || !result[0]) {
                return { success: false, error: 'Notification not found', code: 'NOT_FOUND' }
            }

            return { success: true, data: result[0] }
        } catch {
            return { success: false, error: 'Failed to mark notification as read' }
        }
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(userId: string): Promise<ServiceResponse<{ success: boolean; message: string }>> {
        try {
            const db = useDrizzle()

            await db
                .update(notifications)
                .set({
                    read: true,
                    updatedAt: new Date()
                })
                .where(eq(notifications.userId, userId))

            return { success: true, data: { success: true, message: 'All notifications marked as read' } }
        } catch {
            return { success: false, error: 'Failed to mark all notifications as read' }
        }
    }

    /**
     * Delete notification
     */
    async deleteNotification(notificationId: number, userId: string): Promise<ServiceResponse<{ success: boolean; message: string }>> {
        try {
            const db = useDrizzle()

            const result = await db
                .delete(notifications)
                .where(
                    and(
                        eq(notifications.id, notificationId),
                        eq(notifications.userId, userId)
                    )
                )
                .returning()

            if (!result || result.length === 0) {
                return { success: false, error: 'Notification not found', code: 'NOT_FOUND' }
            }

            return { success: true, data: { success: true, message: 'Notification deleted successfully' } }
        } catch {
            return { success: false, error: 'Failed to delete notification' }
        }
    }

    /**
     * Fire-and-forget friendly entry point for event triggers.
     * Never throws — returns ServiceResponse like every other method.
     */
    async notify(input: NotifyInput): Promise<ServiceResponse<Notification>> {
        return this.createNotification(input.userId, {
            event: input.event,
            type: input.type,
            title: input.title,
            message: input.message,
            actionUrl: input.actionUrl,
            metadata: input.metadata,
        })
    }

    /**
     * Effective per-event preferences for a user.
     * Events without a stored row resolve to defaults (in-app + email on).
     */
    async getPreferences(userId: string): Promise<ServiceResponse<EffectivePreference[]>> {
        try {
            const db = useDrizzle()

            const rows = await db
                .select()
                .from(notificationPreferences)
                .where(eq(notificationPreferences.userId, userId))

            const byEvent = new Map(rows.map(r => [r.event, r]))
            const effective: EffectivePreference[] = NOTIFICATION_EVENTS.map(event => {
                const row = byEvent.get(event)
                return {
                    event,
                    inApp: row ? row.inApp : true,
                    email: row ? row.email : true,
                    customized: !!row,
                    mutedUntil: row?.mutedUntil ? row.mutedUntil.toISOString() : null,
                }
            })

            return { success: true, data: effective }
        } catch {
            return { success: false, error: 'Failed to fetch notification preferences' }
        }
    }

    /**
     * Upsert per-event preferences. Unknown events are rejected.
     */
    async updatePreferences(userId: string, prefs: PreferenceInput[]): Promise<ServiceResponse<EffectivePreference[]>> {
        try {
            const db = useDrizzle()

            for (const pref of prefs) {
                if (!(NOTIFICATION_EVENTS as readonly string[]).includes(pref.event)) {
                    return { success: false, error: `Unknown notification event: ${pref.event}`, code: 'INVALID_EVENT' }
                }
            }

            for (const pref of prefs) {
                const existing = await db
                    .select({ id: notificationPreferences.id })
                    .from(notificationPreferences)
                    .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.event, pref.event)))

                const mutedUntil = pref.mutedUntil === undefined
                    ? undefined
                    : (pref.mutedUntil === null ? null : new Date(pref.mutedUntil))
                if (mutedUntil !== undefined && mutedUntil !== null && Number.isNaN(mutedUntil.getTime())) {
                    return { success: false, error: `Invalid mutedUntil date: ${pref.mutedUntil}`, code: 'INVALID_MUTED_UNTIL' }
                }

                if (existing.length > 0) {
                    await db
                        .update(notificationPreferences)
                        .set({
                            ...(pref.inApp !== undefined ? { inApp: pref.inApp } : {}),
                            ...(pref.email !== undefined ? { email: pref.email } : {}),
                            ...(mutedUntil !== undefined ? { mutedUntil } : {}),
                            updatedAt: new Date(),
                        })
                        .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.event, pref.event)))
                } else {
                    await db
                        .insert(notificationPreferences)
                        .values({
                            userId,
                            event: pref.event,
                            inApp: pref.inApp ?? true,
                            email: pref.email ?? true,
                            mutedUntil: mutedUntil ?? null,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        })
                }
            }

            return this.getPreferences(userId)
        } catch {
            return { success: false, error: 'Failed to update notification preferences' }
        }
    }

    private isRowMuted(row: { mutedUntil: Date | null } | undefined): boolean {
        if (!row?.mutedUntil) return false
        return row.mutedUntil.getTime() > Date.now()
    }

    /**
     * Whether the in-app channel is enabled for an event. Fail-open (true)
     * so a prefs lookup failure never drops a notification.
     */
    async isInAppEnabled(userId: string, event: string): Promise<boolean> {
        try {
            const db = useDrizzle()
            const rows = await db
                .select({ inApp: notificationPreferences.inApp, mutedUntil: notificationPreferences.mutedUntil })
                .from(notificationPreferences)
                .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.event, event)))
            const row = rows[0]
            if (!row) return true
            if (this.isRowMuted(row)) return false
            return row.inApp
        } catch {
            return true
        }
    }

    /**
     * Whether the email channel is enabled for an event. Fail-open (true);
     * mute suppresses email like every other channel.
     */
    async isEmailEnabled(userId: string, event: string): Promise<boolean> {
        try {
            const db = useDrizzle()
            const rows = await db
                .select({ email: notificationPreferences.email, mutedUntil: notificationPreferences.mutedUntil })
                .from(notificationPreferences)
                .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.event, event)))
            const row = rows[0]
            if (!row) return true
            if (this.isRowMuted(row)) return false
            return row.email
        } catch {
            return true
        }
    }

    /**
     * Daily-digest batch: unread notifications since `since`, grouped per
     * user with their email + name. Users without an email are skipped.
     */
    async getDigestBatch(since: Date): Promise<ServiceResponse<DigestRecipient[]>> {
        try {
            const db = useDrizzle()

            const rows = await db
                .select({
                    userId: notifications.userId,
                    title: notifications.title,
                    message: notifications.message,
                    actionUrl: notifications.actionUrl,
                    email: user.email,
                    name: user.name,
                })
                .from(notifications)
                .innerJoin(user, eq(user.id, notifications.userId))
                .where(and(eq(notifications.read, false), gte(notifications.createdAt, since)))

            const byUser = new Map<string, DigestRecipient>()
            for (const row of rows) {
                if (!row.email) continue
                const existing = byUser.get(row.userId)
                if (existing) {
                    existing.items.push({ title: row.title, message: row.message, actionUrl: row.actionUrl })
                } else {
                    byUser.set(row.userId, {
                        userId: row.userId,
                        email: row.email,
                        name: row.name,
                        items: [{ title: row.title, message: row.message, actionUrl: row.actionUrl }],
                    })
                }
            }

            return { success: true, data: [...byUser.values()] }
        } catch {
            return { success: false, error: 'Failed to build notification digest batch' }
        }
    }

    /**
     * Get unread notification count
     */
    async getUnreadCount(userId: string): Promise<ServiceResponse<{ count: number }>> {
        try {
            const db = useDrizzle()

            const result = await db
                .select({ id: notifications.id })
                .from(notifications)
                .where(
                    and(
                        eq(notifications.userId, userId),
                        eq(notifications.read, false)
                    )
                )

            return { success: true, data: { count: result.length } }
        } catch {
            return { success: false, error: 'Failed to get unread count' }
        }
    }
}

export const notificationService = new NotificationService()

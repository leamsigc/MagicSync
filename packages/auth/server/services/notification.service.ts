import { and, desc, eq } from 'drizzle-orm'
import { notifications } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'

/**
 * Notification Service
 * Handles user notification operations
 */

export const notificationService = {
    /**
     * Get user notifications with pagination
     */
    async getNotifications(userId: string, options: {
        limit?: number
        offset?: number
        unreadOnly?: boolean
    } = {}) {
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

        return results
    },

    /**
     * Create a new notification
     */
    async createNotification(userId: string, data: {
        type: 'info' | 'success' | 'warning' | 'error'
        title: string
        message: string
        actionUrl?: string
        metadata?: any
    }) {
        const db = useDrizzle()

        const result = await db
            .insert(notifications)
            .values({
                userId,
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

        return result[0]
    },

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId: number, userId: string) {
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

        if (!result || result.length === 0) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Notification not found'
            })
        }

        return result[0]
    },

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(userId: string) {
        const db = useDrizzle()

        await db
            .update(notifications)
            .set({
                read: true,
                updatedAt: new Date()
            })
            .where(eq(notifications.userId, userId))

        return { success: true, message: 'All notifications marked as read' }
    },

    /**
     * Delete notification
     */
    async deleteNotification(notificationId: number, userId: string) {
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
            throw createError({
                statusCode: 404,
                statusMessage: 'Notification not found'
            })
        }

        return { success: true, message: 'Notification deleted successfully' }
    },

    /**
     * Get unread notification count
     */
    async getUnreadCount(userId: string) {
        const db = useDrizzle()

        const result = await db
            .select()
            .from(notifications)
            .where(
                and(
                    eq(notifications.userId, userId),
                    eq(notifications.read, false)
                )
            )

        return { count: result.length }
    }
}

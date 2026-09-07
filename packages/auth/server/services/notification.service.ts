import { and, desc, eq } from 'drizzle-orm'
import { notifications, type Notification } from '#layers/BaseDB/db/schema'
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

            if (!result[0]) {
                return { success: false, error: 'Failed to create notification' }
            }
            return { success: true, data: result[0] }
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

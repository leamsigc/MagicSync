import type { Notification } from '#layers/BaseDB/db/schema'

interface NotificationResponse<T> {
  success: boolean
  data: T
}

interface UnreadCountData {
  count: number
}

export function useNotificationManagement() {
    const { notifications, unreadCount, loading, error } = useNotification()

    const fetchNotifications = async (options: {
        limit?: number
        offset?: number
        unreadOnly?: boolean
    } = {}) => {
        loading.value = true
        error.value = null

        try {
            const response = await $fetch<NotificationResponse<Notification[]>>('/api/v1/notifications', {
                method: 'GET',
                query: options
            })

            if (response.success) {
                notifications.value = response.data
            }

            return response
        } catch (err: unknown) {
            error.value = err instanceof Error ? err.message : 'Failed to fetch notifications'
            throw err
        } finally {
            loading.value = false
        }
    }

    const markAsRead = async (notificationId: number) => {
        loading.value = true
        error.value = null

        try {
            const response = await $fetch<NotificationResponse<null>>('/api/v1/notifications/mark-read', {
                method: 'POST',
                body: { notificationId }
            })

            if (response.success) {
                const index = notifications.value.findIndex(n => n.id === notificationId)
                if (index !== -1) {
                    notifications.value[index].read = true
                }
                await fetchUnreadCount()
            }

            return response
        } catch (err: unknown) {
            error.value = err instanceof Error ? err.message : 'Failed to mark notification as read'
            throw err
        } finally {
            loading.value = false
        }
    }

    const markAllAsRead = async () => {
        loading.value = true
        error.value = null

        try {
            const response = await $fetch<NotificationResponse<null>>('/api/v1/notifications/mark-read', {
                method: 'POST',
                body: { markAll: true }
            })

            if (response.success) {
                notifications.value = notifications.value.map(n => ({ ...n, read: true }))
                unreadCount.value = 0
            }

            return response
        } catch (err: unknown) {
            error.value = err instanceof Error ? err.message : 'Failed to mark all notifications as read'
            throw err
        } finally {
            loading.value = false
        }
    }

    const deleteNotification = async (notificationId: number) => {
        loading.value = true
        error.value = null

        try {
            const response = await $fetch<NotificationResponse<null>>('/api/v1/notifications/delete', {
                method: 'DELETE',
                body: { notificationId }
            })

            if (response.success) {
                notifications.value = notifications.value.filter(n => n.id !== notificationId)
                await fetchUnreadCount()
            }

            return response
        } catch (err: unknown) {
            error.value = err instanceof Error ? err.message : 'Failed to delete notification'
            throw err
        } finally {
            loading.value = false
        }
    }

    const fetchUnreadCount = async () => {
        try {
            const response = await $fetch<NotificationResponse<UnreadCountData>>('/api/v1/notifications/unread-count', {
                method: 'GET'
            })

            if (response.success) {
                unreadCount.value = response.data.count
            }

            return response
        } catch (err: unknown) {
            error.value = err instanceof Error ? err.message : 'Failed to fetch unread count'
            throw err
        }
    }

    return {
        notifications,
        unreadCount,
        loading,
        error,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        fetchUnreadCount
    }
}

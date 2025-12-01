/**
 * Notification Management Composable
 * Handles CRUD operations for notifications
 */

export function useNotificationManagement() {
    const { notifications, unreadCount, loading, error } = useNotification()

    /**
     * Fetch notifications
     */
    const fetchNotifications = async (options: {
        limit?: number
        offset?: number
        unreadOnly?: boolean
    } = {}) => {
        loading.value = true
        error.value = null

        try {
            const response = await $fetch('/api/v1/notifications', {
                method: 'GET',
                query: options
            })

            if (response.success) {
                notifications.value = response.data
            }

            return response
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch notifications'
            throw err
        } finally {
            loading.value = false
        }
    }

    /**
     * Mark notification as read
     */
    const markAsRead = async (notificationId: number) => {
        loading.value = true
        error.value = null

        try {
            const response = await $fetch('/api/v1/notifications/mark-read', {
                method: 'POST',
                body: { notificationId }
            })

            // Update local state
            if (response.success) {
                const index = notifications.value.findIndex(n => n.id === notificationId)
                if (index !== -1) {
                    notifications.value[index].read = true
                }
                await fetchUnreadCount()
            }

            return response
        } catch (err: any) {
            error.value = err.message || 'Failed to mark notification as read'
            throw err
        } finally {
            loading.value = false
        }
    }

    /**
     * Mark all notifications as read
     */
    const markAllAsRead = async () => {
        loading.value = true
        error.value = null

        try {
            const response = await $fetch('/api/v1/notifications/mark-read', {
                method: 'POST',
                body: { markAll: true }
            })

            // Update local state
            if (response.success) {
                notifications.value = notifications.value.map(n => ({ ...n, read: true }))
                unreadCount.value = 0
            }

            return response
        } catch (err: any) {
            error.value = err.message || 'Failed to mark all notifications as read'
            throw err
        } finally {
            loading.value = false
        }
    }

    /**
     * Delete notification
     */
    const deleteNotification = async (notificationId: number) => {
        loading.value = true
        error.value = null

        try {
            const response = await $fetch('/api/v1/notifications/delete', {
                method: 'DELETE',
                body: { notificationId }
            })

            // Update local state
            if (response.success) {
                notifications.value = notifications.value.filter(n => n.id !== notificationId)
                await fetchUnreadCount()
            }

            return response
        } catch (err: any) {
            error.value = err.message || 'Failed to delete notification'
            throw err
        } finally {
            loading.value = false
        }
    }

    /**
     * Fetch unread notification count
     */
    const fetchUnreadCount = async () => {
        try {
            const response = await $fetch('/api/v1/notifications/unread-count', {
                method: 'GET'
            })

            if (response.success) {
                unreadCount.value = response.data.count
            }

            return response
        } catch (err: any) {
            error.value = err.message || 'Failed to fetch unread count'
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

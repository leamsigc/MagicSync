import type { Notification } from '#layers/BaseDB/db/schema'

/**
 * Single Notification Composable
 * Manages reactive state for notifications
 */

export function useNotification() {
    const notifications = useState<Notification[]>('notifications:data', () => [])
    const unreadCount = useState<number>('notifications:unread', () => 0)
    const loading = useState<boolean>('notifications:loading', () => false)
    const error = useState<string | null>('notifications:error', () => null)

    return {
        notifications,
        unreadCount,
        loading,
        error
    }
}

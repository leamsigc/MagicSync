import { notificationService } from '#layers/BaseAuth/server/services/notification.service'

export default defineEventHandler(async (event) => {
    const log = useLogger(event)
    try {
        // Get authenticated user
        const user = await checkUserIsLogin(event)
        log.set({ userId: user.id })

        // Get unread count
        const result = await notificationService.getUnreadCount(user.id)

        log.info({ content: 'Unread notification count retrieved', count: result })

        return {
            success: true,
            data: result
        }
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        log.error({ content: 'Failed to get unread count', error: msg })
        const err = error as { statusCode?: number; statusMessage?: string }

        throw createError({
            statusCode: err.statusCode || 500,
            statusMessage: err.statusMessage || 'Failed to get unread count'
        })
    }
})

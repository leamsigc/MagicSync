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
    } catch (error: any) {
        log.error({ content: 'Failed to get unread count', error: error.message })

        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Failed to get unread count'
        })
    }
})

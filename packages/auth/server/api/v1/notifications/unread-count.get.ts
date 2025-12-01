import { notificationService } from '#layers/BaseAuth/server/services/notification.service'

export default defineEventHandler(async (event) => {
    try {
        // Get authenticated user
        const user = await checkUserIsLogin(event)

        // Get unread count
        const result = await notificationService.getUnreadCount(user.id)

        return {
            success: true,
            data: result
        }
    } catch (error: any) {
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Failed to get unread count'
        })
    }
})

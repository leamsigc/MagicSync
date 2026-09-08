import { notificationService } from '#layers/BaseAuth/server/services/notification.service'

export default defineEventHandler(async (event) => {
    const log = useLogger(event)
    try {
        // Get authenticated user
        const user = await checkUserIsLogin(event)
        log.set({ userId: user.id })

        // Get effective preferences (stored rows merged with defaults)
        const result = await notificationService.getPreferences(user.id)
        if (result.error || !result.data) {
            throw createError({
                statusCode: 500,
                statusMessage: result.error || 'Failed to get notification preferences'
            })
        }

        log.info({ content: 'Notification preferences retrieved', count: result.data.length })

        return {
            success: true,
            data: result.data
        }
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        log.error({ content: 'Failed to get notification preferences', error: msg })

        const err = error as { statusCode?: number; statusMessage?: string }
        throw createError({
            statusCode: err.statusCode || 500,
            statusMessage: err.statusMessage || 'Failed to get notification preferences'
        })
    }
})

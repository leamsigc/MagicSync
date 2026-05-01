import { z } from 'zod'
import { notificationService } from '#layers/BaseAuth/server/services/notification.service'

const deleteNotificationSchema = z.object({
    notificationId: z.number().min(1, 'Notification ID is required')
})

export default defineEventHandler(async (event) => {
    const log = useLogger(event)
    try {
        // Get authenticated user
        const user = await checkUserIsLogin(event)
        log.set({ userId: user.id })

        // Parse and validate request body
        const body = await readBody(event)
        const validatedData = deleteNotificationSchema.parse(body)

        log.set({ notificationId: validatedData.notificationId })

        // Delete notification
        const result = await notificationService.deleteNotification(validatedData.notificationId, user.id)

        log.info({ content: 'Notification deleted', notificationId: validatedData.notificationId })

        return result
    } catch (error: any) {
        log.error({ content: 'Failed to delete notification', error: error.message })

        if (error instanceof z.ZodError) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Validation Error',
                data: error.issues
            })
        }

        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Failed to delete notification'
        })
    }
})

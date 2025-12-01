import { z } from 'zod'
import { notificationService } from '#layers/BaseAuth/server/services/notification.service'

const deleteNotificationSchema = z.object({
    notificationId: z.number().min(1, 'Notification ID is required')
})

export default defineEventHandler(async (event) => {
    try {
        // Get authenticated user
        const user = await checkUserIsLogin(event)

        // Parse and validate request body
        const body = await readBody(event)
        const validatedData = deleteNotificationSchema.parse(body)

        // Delete notification
        const result = await notificationService.deleteNotification(validatedData.notificationId, user.id)

        return result
    } catch (error: any) {
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

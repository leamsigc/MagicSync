import { z } from 'zod'
import { notificationService } from '#layers/BaseAuth/server/services/notification.service'

const markReadSchema = z.object({
    notificationId: z.number().optional(),
    markAll: z.boolean().optional().default(false)
})

export default defineEventHandler(async (event) => {
    const log = useLogger(event)
    try {
        // Get authenticated user
        const user = await checkUserIsLogin(event)
        log.set({ userId: user.id })

        // Parse and validate request body
        const body = await readBody(event)
        const validatedData = markReadSchema.parse(body)

        log.set({ markAll: validatedData.markAll, notificationId: validatedData.notificationId })

        let result

        if (validatedData.markAll) {
            // Mark all notifications as read
            result = await notificationService.markAllAsRead(user.id)
            log.info({ content: 'All notifications marked as read' })
        } else if (validatedData.notificationId) {
            // Mark single notification as read
            result = await notificationService.markAsRead(validatedData.notificationId, user.id)
            log.info({ content: 'Notification marked as read', notificationId: validatedData.notificationId })
        } else {
            throw createError({
                statusCode: 400,
                statusMessage: 'Either notificationId or markAll must be provided'
            })
        }

        return {
            success: true,
            message: 'Notification(s) marked as read',
            data: result
        }
    } catch (error: any) {
        log.error({ content: 'Failed to mark notification as read', error: error.message })

        if (error instanceof z.ZodError) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Validation Error',
                data: error.issues
            })
        }

        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Failed to mark notification as read'
        })
    }
})

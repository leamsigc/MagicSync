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
            const allResult = await notificationService.markAllAsRead(user.id)
            if (allResult.error || !allResult.data) {
                throw createError({
                    statusCode: 500,
                    statusMessage: allResult.error || 'Failed to mark notification as read'
                })
            }
            result = allResult.data
            log.info({ content: 'All notifications marked as read' })
        } else if (validatedData.notificationId) {
            // Mark single notification as read
            const single = await notificationService.markAsRead(validatedData.notificationId, user.id)
            if (single.error || !single.data) {
                throw createError({
                    statusCode: single.code === 'NOT_FOUND' ? 404 : 500,
                    statusMessage: single.error || 'Failed to mark notification as read'
                })
            }
            result = single.data
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
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        log.error({ content: 'Failed to mark notification as read', error: msg })

        if (error instanceof z.ZodError) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Validation Error',
                data: error.issues
            })
        }

        const err = error as { statusCode?: number; statusMessage?: string }
        throw createError({
            statusCode: err.statusCode || 500,
            statusMessage: err.statusMessage || 'Failed to mark notification as read'
        })
    }
})

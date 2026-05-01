import { z } from 'zod'
import { notificationService } from '#layers/BaseAuth/server/services/notification.service'

const querySchema = z.object({
    limit: z.coerce.number().min(1).max(100).optional().default(20),
    offset: z.coerce.number().min(0).optional().default(0),
    unreadOnly: z.coerce.boolean().optional().default(false)
})

export default defineEventHandler(async (event) => {
    const log = useLogger(event)
    try {
        // Get authenticated user
        const user = await checkUserIsLogin(event)
        log.set({ userId: user.id })

        // Parse and validate query parameters
        const query = getQuery(event)
        const validatedQuery = querySchema.parse(query)

        log.set({ unreadOnly: validatedQuery.unreadOnly })

        // Get notifications
        const notifications = await notificationService.getNotifications(user.id, validatedQuery)

        log.info({ content: 'Notifications retrieved', count: notifications.length })

        return {
            success: true,
            data: notifications,
            pagination: {
                limit: validatedQuery.limit,
                offset: validatedQuery.offset
            }
        }
    } catch (error: any) {
        log.error({ content: 'Failed to get notifications', error: error.message })

        if (error instanceof z.ZodError) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Validation Error',
                data: error.issues
            })
        }

        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Failed to get notifications'
        })
    }
})

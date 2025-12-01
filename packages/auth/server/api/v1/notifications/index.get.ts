import { z } from 'zod'
import { notificationService } from '#layers/BaseAuth/server/services/notification.service'

const querySchema = z.object({
    limit: z.coerce.number().min(1).max(100).optional().default(20),
    offset: z.coerce.number().min(0).optional().default(0),
    unreadOnly: z.coerce.boolean().optional().default(false)
})

export default defineEventHandler(async (event) => {
    try {
        // Get authenticated user
        const user = await checkUserIsLogin(event)

        // Parse and validate query parameters
        const query = getQuery(event)
        const validatedQuery = querySchema.parse(query)

        // Get notifications
        const notifications = await notificationService.getNotifications(user.id, validatedQuery)

        return {
            success: true,
            data: notifications,
            pagination: {
                limit: validatedQuery.limit,
                offset: validatedQuery.offset
            }
        }
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
            statusMessage: error.statusMessage || 'Failed to get notifications'
        })
    }
})

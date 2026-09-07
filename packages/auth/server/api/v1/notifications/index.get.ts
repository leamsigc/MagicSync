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
        const result = await notificationService.getNotifications(user.id, validatedQuery)
        if (result.error || !result.data) {
            throw createError({
                statusCode: 500,
                statusMessage: result.error || 'Failed to get notifications'
            })
        }

        log.info({ content: 'Notifications retrieved', count: result.data.length })

        return {
            success: true,
            data: result.data,
            pagination: {
                limit: validatedQuery.limit,
                offset: validatedQuery.offset
            }
        }
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        log.error({ content: 'Failed to get notifications', error: msg })

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
            statusMessage: err.statusMessage || 'Failed to get notifications'
        })
    }
})

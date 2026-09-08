import { z } from 'zod'
import { notificationService } from '#layers/BaseAuth/server/services/notification.service'

const preferencesSchema = z.object({
    preferences: z.array(z.object({
        event: z.string().min(1),
        inApp: z.boolean().optional(),
        email: z.boolean().optional(),
        mutedUntil: z.string().datetime().nullable().optional()
    })).min(1).max(20)
})

export default defineEventHandler(async (event) => {
    const log = useLogger(event)
    try {
        // Get authenticated user
        const user = await checkUserIsLogin(event)
        log.set({ userId: user.id })

        // Parse and validate request body
        const body = await readBody(event)
        const validatedData = preferencesSchema.parse(body)

        log.set({ preferenceCount: validatedData.preferences.length })

        // Upsert preferences (unknown events / bad dates → 400)
        const result = await notificationService.updatePreferences(user.id, validatedData.preferences)
        if (result.error || !result.data) {
            throw createError({
                statusCode: result.code === 'INVALID_EVENT' || result.code === 'INVALID_MUTED_UNTIL' ? 400 : 500,
                statusMessage: result.error || 'Failed to update notification preferences'
            })
        }

        log.info({ content: 'Notification preferences updated' })

        return {
            success: true,
            message: 'Notification preferences updated',
            data: result.data
        }
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        log.error({ content: 'Failed to update notification preferences', error: msg })

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
            statusMessage: err.statusMessage || 'Failed to update notification preferences'
        })
    }
})

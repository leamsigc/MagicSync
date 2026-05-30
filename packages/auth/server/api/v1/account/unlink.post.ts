import { z } from 'zod'
import { accountService } from '#layers/BaseAuth/server/services/account.service'

const unlinkAccountSchema = z.object({
    accountId: z.string().min(1, 'Account ID is required')
})

export default defineEventHandler(async (event) => {
    const log = useLogger(event)
    try {
        // Get authenticated user
        const user = await checkUserIsLogin(event)
        log.set({ userId: user.id })

        // Parse and validate request body
        const body = await readBody(event)
        const validatedData = unlinkAccountSchema.parse(body)

        log.set({ accountId: validatedData.accountId })

        // Unlink account
        const result = await accountService.unlinkAccount(user.id, validatedData.accountId)

        log.info({ content: 'Account unlinked successfully', accountId: validatedData.accountId })

        return result
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        log.error({ content: 'Failed to unlink account', error: msg })

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
            statusMessage: err.statusMessage || 'Failed to unlink account'
        })
    }
})

import { z } from 'zod'
import { accountService } from '#layers/BaseAuth/server/services/account.service'

const unlinkAccountSchema = z.object({
    accountId: z.string().min(1, 'Account ID is required')
})

export default defineEventHandler(async (event) => {
    try {
        // Get authenticated user
        const user = await checkUserIsLogin(event)

        // Parse and validate request body
        const body = await readBody(event)
        const validatedData = unlinkAccountSchema.parse(body)

        // Unlink account
        const result = await accountService.unlinkAccount(user.id, validatedData.accountId)

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
            statusMessage: error.statusMessage || 'Failed to unlink account'
        })
    }
})

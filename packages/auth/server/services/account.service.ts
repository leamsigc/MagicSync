import { eq } from 'drizzle-orm'
import { account } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'

/**
 * Account Service
 * Handles user account operations not covered by Better Auth
 */

export const accountService = {
    /**
     * Unlink a social account
     */
    async unlinkAccount(userId: string, accountId: string) {
        const db = useDrizzle()

        // Check if this is the last account
        const userAccounts = await db
            .select()
            .from(account)
            .where(eq(account.userId, userId))

        if (userAccounts.length <= 1) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Cannot unlink the last account. You must have at least one authentication method.'
            })
        }

        const result = await db
            .delete(account)
            .where(eq(account.id, accountId))
            .returning()

        if (!result || result.length === 0) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Account not found'
            })
        }

        return { success: true, message: 'Account unlinked successfully' }
    }
}

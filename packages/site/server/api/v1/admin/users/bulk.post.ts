import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { useAuthApi, type AuthApi } from '#layers/BaseAuth/server/utils/useAuthApi'
import { z } from 'zod'

const BulkSchema = z.object({
  action: z.enum(['ban', 'unban', 'delete']),
  userIds: z.array(z.string().min(1)).min(1).max(100),
  banReason: z.string().max(500).optional().default('Violated terms of service')
})

interface BulkItemResult {
  userId: string
  ok: boolean
  skipped?: boolean
  error?: string
}

async function applyAction(
  authApi: AuthApi,
  action: 'ban' | 'unban' | 'delete',
  userId: string,
  banReason: string
) {
  if (action === 'ban') {
    await authApi.banUser({ body: { userId, banReason } })
  } else if (action === 'unban') {
    await authApi.unbanUser({ body: { userId } })
  } else {
    await authApi.removeUser({ body: { userId } })
  }
}

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const body = await readValidatedBody(event, BulkSchema.parse)
  const authApi = useAuthApi(event)

  const results: BulkItemResult[] = []
  for (const userId of body.userIds) {
    if (userId === currentUser.id) {
      results.push({ userId, ok: false, skipped: true, error: 'Cannot act on your own account' })
      continue
    }

    try {
      await applyAction(authApi, body.action, userId, body.banReason)
      results.push({ userId, ok: true })
    } catch (error) {
      results.push({
        userId,
        ok: false,
        error: error instanceof Error ? error.message : `Failed to ${body.action} user`
      })
    }
  }

  return { results }
})

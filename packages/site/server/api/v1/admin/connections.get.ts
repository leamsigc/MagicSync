import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { eq } from 'drizzle-orm'
import { account, user } from '#layers/BaseDB/db/schema'

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const db = useDrizzle()

  const connections = await db
    .select({
      id: account.id,
      providerId: account.providerId,
      accountId: account.accountId,
      createdAt: account.createdAt,
      userId: account.userId,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image
    })
    .from(account)
    .leftJoin(user, eq(account.userId, user.id))
    .orderBy(account.createdAt, 'desc')
    .all()

  return { connections }
})

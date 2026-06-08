import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { sql } from 'drizzle-orm'
import { account } from '#layers/BaseDB/db/schema'

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const db = useDrizzle()

  const integrations = await db
    .select({
      providerId: account.providerId,
      count: sql<number>`count(*)`
    })
    .from(account)
    .groupBy(account.providerId)
    .all()

  return { integrations }
})

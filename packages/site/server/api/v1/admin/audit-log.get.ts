import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { sql } from 'drizzle-orm'
import { auditLog } from '#layers/BaseDB/db/schema'

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const db = useDrizzle()

  const logs = await db
    .select()
    .from(auditLog)
    .orderBy(sql`created_at desc`)
    .limit(100)
    .all()

  return { logs }
})

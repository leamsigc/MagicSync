import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { sql } from 'drizzle-orm'
import { user } from '#layers/BaseDB/db/schema'

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const db = useDrizzle()

  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
      createdAt: user.createdAt
    })
    .from(user)
    .orderBy(sql`created_at desc`)
    .all()

  return { users }
})

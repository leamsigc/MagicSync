import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { sql } from 'drizzle-orm'
import { user, session, businessProfiles, posts } from '#layers/BaseDB/db/schema'

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const db = useDrizzle()

  const [userResult] = await db.select({ count: sql<number>`count(*)` }).from(user)
  const [businessResult] = await db.select({ count: sql<number>`count(*)` }).from(businessProfiles)
  const [postResult] = await db.select({ count: sql<number>`count(*)` }).from(posts)
  const [sessionResult] = await db.select({ count: sql<number>`count(*)` }).from(session)

  return {
    users: userResult?.count ?? 0,
    businesses: businessResult?.count ?? 0,
    posts: postResult?.count ?? 0,
    sessions: sessionResult?.count ?? 0
  }
})

import { checkUserIsLogin } from '#layers/BaseAuth/server/utils/AuthHelpers'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { sql } from 'drizzle-orm'
import { businessProfiles } from '#layers/BaseDB/db/schema'

export default defineEventHandler(async (event) => {
  const currentUser = await checkUserIsLogin(event)
  if (currentUser.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const db = useDrizzle()

  const businesses = await db
    .select({
      id: businessProfiles.id,
      name: businessProfiles.name,
      description: businessProfiles.description,
      category: businessProfiles.category,
      address: businessProfiles.address,
      website: businessProfiles.website,
      phone: businessProfiles.phone,
      isActive: businessProfiles.isActive,
      userId: businessProfiles.userId,
      createdAt: businessProfiles.createdAt
    })
    .from(businessProfiles)
    .orderBy(sql`created_at desc`)
    .all()

  return { businesses }
})

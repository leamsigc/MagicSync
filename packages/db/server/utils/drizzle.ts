import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { tursoConfig } from '../../config/turso.config'
import * as schema from '#layers/BaseDB/db/schema'

export const tursoClient = createClient({
  url: tursoConfig.url,
  authToken: tursoConfig.authToken
})

export const useDrizzle = () => {
  return drizzle(tursoClient, { schema })
}

export const tables = schema

export const UserInsert = schema.user.$inferInsert
export type UserRegisterType = Omit<typeof UserInsert, 'createdAt' | 'updatedAt' | 'id' | 'emailVerified'>

import type { FacebookPage } from '#layers/BaseConnect/utils/FacebookPages';
import type { InferSelectModel } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const entityDetails = sqliteTable('entity_details', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull(), // Generic foreign key
  entityType: text('entity_type').notNull(), // e.g., 'social_media_account', 'business_profile'
  details: text('details', { mode: 'json' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull()
})

export type EntityDetails = InferSelectModel<typeof entityDetails> & { details: { pages: FacebookPage[], username: string; picture: string; } }
export type NewEntityDetails = Omit<EntityDetails, 'id' | 'createdAt' | 'updatedAt'>

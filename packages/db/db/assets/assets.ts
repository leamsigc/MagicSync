import type { InferSelectModel } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { user } from '../auth/auth'
import { businessProfiles } from '../business/business'

// Assets
export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  businessId: text('business_id').references(() => businessProfiles.id, { onDelete: 'cascade' }), // Optional
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  metadata: text('metadata'), // JSON
  isPublic: integer('is_public', { mode: 'boolean' }).default(false).notNull(), // Public/Private visibility
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull()
})

export type Asset = InferSelectModel<typeof assets>

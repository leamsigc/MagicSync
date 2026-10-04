import type { InferSelectModel } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { user } from '../auth/auth'
import { businessProfiles } from '../business/business'

/**
 * Flat, business-scoped asset folders. No tree: an asset belongs to at most one
 * folder, and "no folder" is `assets.folder_id IS NULL` rather than a sentinel row,
 * so a user can never rename the unfiled bucket into a category.
 *
 * `businessId` is NOT NULL on purpose. A folder belonging to nobody is not a state
 * the domain has, and a non-null business id makes the ownership comparison in
 * AssetService a single equality test with no null branch.
 */
export const assetFolders = sqliteTable('asset_folders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  businessId: text('business_id').notNull().references(() => businessProfiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex('asset_folders_business_name_unique').on(table.businessId, table.name),
  index('asset_folders_business_idx').on(table.businessId),
])

export type AssetFolder = InferSelectModel<typeof assetFolders>
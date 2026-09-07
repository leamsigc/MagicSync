import type { InferSelectModel } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { posts } from '../posts/posts'
import { socialMediaAccounts } from '../socialMedia/socialMedia'

export const inboxItems = sqliteTable('inbox_items', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  type: text('type', { enum: ['comment', 'dm', 'notification'] }).notNull(),
  platform: text('platform').notNull(),
  socialAccountId: text('social_account_id').references(() => socialMediaAccounts.id, { onDelete: 'cascade' }),
  postId: text('post_id').references(() => posts.id, { onDelete: 'cascade' }),
  externalPostId: text('external_post_id'),
  authorId: text('author_id'),
  authorName: text('author_name'),
  authorAvatar: text('author_avatar'),
  content: text('content').notNull(),
  parentId: text('parent_id'),
  read: integer('read', { mode: 'boolean' }).notNull().default(false),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => [
  index('inbox_user_read_idx').on(table.userId, table.read),
  index('inbox_user_platform_idx').on(table.userId, table.platform),
  index('inbox_user_type_idx').on(table.userId, table.type),
  index('inbox_post_idx').on(table.postId),
])

export type InboxItem = InferSelectModel<typeof inboxItems>
export type NewInboxItem = typeof inboxItems.$inferInsert

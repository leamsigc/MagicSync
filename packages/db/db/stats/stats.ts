import type { InferSelectModel } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { platformPosts, posts } from '../posts/posts'
import { socialMediaAccounts } from '../socialMedia/socialMedia'

export const accountMetrics = sqliteTable('account_metrics', {
  id: text('id').primaryKey(),
  socialAccountId: text('social_account_id').notNull().references(() => socialMediaAccounts.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  followers: integer('followers'),
  following: integer('following'),
  posts: integer('posts'),
  engagement: text('engagement', { mode: 'json' }),
  rawPayload: text('raw_payload', { mode: 'json' }),
  source: text('source', { enum: ['auto', 'manual'] }).notNull().default('auto'),
  status: text('status', { enum: ['success', 'failed'] }).notNull().default('success'),
  error: text('error'),
  collectedAt: integer('collected_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => [
  index('account_metrics_account_collected_idx').on(table.socialAccountId, table.collectedAt),
  index('account_metrics_platform_idx').on(table.platform),
])

export const postMetrics = sqliteTable('post_metrics', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  platformPostId: text('platform_post_id').references(() => platformPosts.id, { onDelete: 'cascade' }),
  socialAccountId: text('social_account_id').notNull().references(() => socialMediaAccounts.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  externalPostId: text('external_post_id'),
  metrics: text('metrics', { mode: 'json' }).notNull(),
  rawPayload: text('raw_payload', { mode: 'json' }),
  status: text('status', { enum: ['success', 'failed'] }).notNull().default('success'),
  error: text('error'),
  collectedAt: integer('collected_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, (table) => [
  index('post_metrics_post_collected_idx').on(table.postId, table.collectedAt),
  index('post_metrics_platform_post_idx').on(table.platformPostId),
  index('post_metrics_account_collected_idx').on(table.socialAccountId, table.collectedAt),
])

export const statsSyncState = sqliteTable('stats_sync_state', {
  id: text('id').primaryKey(),
  socialAccountId: text('social_account_id').notNull().unique().references(() => socialMediaAccounts.id, { onDelete: 'cascade' }),
  lastAttemptAt: integer('last_attempt_at', { mode: 'timestamp' }),
  lastSuccessAt: integer('last_success_at', { mode: 'timestamp' }),
  nextDueAt: integer('next_due_at', { mode: 'timestamp' }),
  status: text('status', { enum: ['idle', 'running', 'error', 'rate_limited'] }).notNull().default('idle'),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  lastError: text('last_error'),
  backoffUntil: integer('backoff_until', { mode: 'timestamp' }),
})

export type AccountMetrics = InferSelectModel<typeof accountMetrics>
export type NewAccountMetrics = typeof accountMetrics.$inferInsert
export type PostMetric = InferSelectModel<typeof postMetrics>
export type NewPostMetric = typeof postMetrics.$inferInsert
export type StatsSyncState = InferSelectModel<typeof statsSyncState>
export type NewStatsSyncState = typeof statsSyncState.$inferInsert
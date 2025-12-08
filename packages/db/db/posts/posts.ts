import type { InferSelectModel } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { user, type User } from '../auth/auth'
import { businessProfiles } from '../business/business'
import { socialMediaAccounts, type SocialMediaAccount } from '../socialMedia/socialMedia'
import type { Asset } from '../schema'

// Posts
export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  businessId: text('business_id').notNull().references(() => businessProfiles.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  mediaAssets: text('media_assets'),
  scheduledAt: integer('scheduled_at', { mode: 'timestamp' }),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  status: text('status', {
    enum: ['pending', 'published', 'failed']
  }).notNull().default('pending'),
  targetPlatforms: text('target_platforms').notNull(),
  platformContent: text('platform_content', { mode: 'json' }),
  platformSettings: text('platform_settings', { mode: 'json' }),
  postFormat: text('post_format', { enum: ['post', 'reel', 'story', 'short'] }).default('post'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull()
})

// Platform-specific post tracking
export const platformPosts = sqliteTable('platform_posts', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  socialAccountId: text('social_account_id').notNull().references(() => socialMediaAccounts.id, { onDelete: 'cascade' }),
  platformPostId: text('platform_post_id'),
  status: text('status', {
    enum: ['pending', 'published', 'failed']
  }).notNull().default('pending'),
  errorMessage: text('error_message'),
  platformSettings: text('platform_settings', { mode: 'json' }), // JSON object for platform-specific settings
  publishDetail: text('publish_detail', { mode: 'json' }), // JSON object for publish details
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull()
})


export type PlatformSettingsRecord = Record<string, any>
export type PlatformContentOverride = {
  content: string
  comments?: string[]
}
export type PublishDetail = Map<string, {
  publishedId?: string
  publishedUrl?: string
}>
export type Post = InferSelectModel<typeof posts>
export type PlatformPost = InferSelectModel<typeof platformPosts>
export type PlatformPostInsert = typeof platformPosts.$inferInsert
export type PostWithPlatformPosts = Post & { platformPosts: PlatformPost[], socialMediaAccount: SocialMediaAccount }
export type PostWithAllData = Post & { platformPosts: PlatformPost[], user: User, assets: Asset[], }

export type PostCreate = Omit<Post, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'targetPlatforms' | 'mediaAssets' | 'publishedAt'>

export type PostCreateBase = PostCreate & {
  targetPlatforms: string[]
  mediaAssets: string[]
  comment: string[]
  platformContent?: Record<string, PlatformContentOverride>
  platformSettings?: PlatformSettingsRecord
  postFormat?: 'post' | 'reel' | 'story' | 'short'
}

import type { InferSelectModel } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { user } from '../auth/auth'
import { businessProfiles } from '../business/business'
import { entityDetails, type EntityDetails } from '../entityDetails/entityDetails'

// Social media accounts
export const socialMediaAccounts = sqliteTable('social_media_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  businessId: text('business_id').notNull().references(() => businessProfiles.id, { onDelete: 'cascade' }),
  platform: text('platform', {
    enum: [
      'facebook',
      'instagram',
      'instagram-standalone',
      'twitter',
      'tiktok',
      'google',
      'googlemybusiness',
      'discord',
      'linkedin',
      'linkedin-page',
      'threads',
      'youtube',
      'bluesky',
      'devto',
      'dribbble',
      'reddit',
      'wordpress'
    ]
  }).notNull(),
  accountId: text('account_id').notNull(),
  accountName: text('account_name').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: integer('token_expires_at', { mode: 'timestamp' }),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  entityDetailId: text('entity_detail_id').references(() => entityDetails.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull()
})

export const socialMediaAccountManagers = sqliteTable('social_media_account_managers', {
  socialMediaAccountId: text('social_media_account_id').notNull().references(() => socialMediaAccounts.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull()
})

export type SocialMediaAccountManager = InferSelectModel<typeof socialMediaAccountManagers>
export type NewSocialMediaAccountManager = Omit<SocialMediaAccountManager, 'createdAt' | 'updatedAt'>

export const socialMediaAccountsRelations = relations(socialMediaAccounts, ({ one, many }) => ({
  entityDetail: one(entityDetails, {
    fields: [socialMediaAccounts.entityDetailId],
    references: [entityDetails.id]
  }),
  managers: many(socialMediaAccountManagers)
}))

export const socialMediaAccountManagersRelations = relations(socialMediaAccountManagers, ({ one }) => ({
  socialMediaAccount: one(socialMediaAccounts, {
    fields: [socialMediaAccountManagers.socialMediaAccountId],
    references: [socialMediaAccounts.id]
  }),
  user: one(user, {
    fields: [socialMediaAccountManagers.userId],
    references: [user.id]
  })
}))

export type SocialMediaAccount = InferSelectModel<typeof socialMediaAccounts>
export type SocialMediaComplete = SocialMediaAccount & { entityDetail: EntityDetails, createdAt: String }
export type NewSocialMediaAccount = Omit<SocialMediaAccount, 'id' | 'createdAt' | 'updatedAt'>

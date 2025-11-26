import { relations } from 'drizzle-orm'
import { assets } from './assets/assets'

import { user } from './auth/auth'
// Import tables for relations
import { businessProfiles } from './business/business'
import { entityDetails } from './entityDetails/entityDetails'
import { platformPosts, posts } from './posts/posts'
import { reviews } from './reviews/reviews'
import { socialMediaAccountManagers, socialMediaAccounts } from './socialMedia/socialMedia'
import { subscriptions } from './subscriptions/subscriptions'

export * from './assets/assets'

// Export auth tables and types
export * from './auth/auth'
// Export feature-specific tables and types
export * from './business/business'
export * from './posts/posts'
export * from './reviews/reviews'
export * from './socialMedia/socialMedia'
export * from './subscriptions/subscriptions'
export * from './templates/templates'
export * from './audit/audit'
export * from './entityDetails/entityDetails'
export * from './socialMedia/socialMedia'

/***
* Cross-feature relationships
**/

// User relations - connecting to all features
export const userRelations = relations(user, ({ many }) => ({
  businessProfiles: many(businessProfiles),
  socialMediaAccounts: many(socialMediaAccounts),
  socialMediaAccountManagers: many(socialMediaAccountManagers),
  assets: many(assets),
  posts: many(posts),
  subscriptions: many(subscriptions)
}))

// Business profile relations - connecting to dependent features
export const businessProfilesRelations = relations(businessProfiles, ({ one, many }) => ({
  user: one(user, {
    fields: [businessProfiles.userId],
    references: [user.id]
  }),
  socialMediaAccounts: many(socialMediaAccounts),
  assets: many(assets),
  posts: many(posts),
  reviews: many(reviews)
}))

// Social media account relations - connecting to posts
export const socialMediaAccountsRelations = relations(socialMediaAccounts, ({ one, many }) => ({
  user: one(user, {
    fields: [socialMediaAccounts.userId],
    references: [user.id]
  }),
  businessProfile: one(businessProfiles, {
    fields: [socialMediaAccounts.businessId],
    references: [businessProfiles.id]
  }),
  entityDetail: one(entityDetails, {
    fields: [socialMediaAccounts.entityDetailId],
    references: [entityDetails.id]
  }),
  platformPosts: many(platformPosts)
}))

// Asset relations
export const assetsRelations = relations(assets, ({ one }) => ({
  user: one(user, {
    fields: [assets.userId],
    references: [user.id]
  }),
  businessProfile: one(businessProfiles, {
    fields: [assets.businessId],
    references: [businessProfiles.id]
  })
}))

// Post relations
export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(user, {
    fields: [posts.userId],
    references: [user.id]
  }),
  businessProfile: one(businessProfiles, {
    fields: [posts.businessId],
    references: [businessProfiles.id]
  }),
  platformPosts: many(platformPosts)
}))

// Platform post relations
export const platformPostsRelations = relations(platformPosts, ({ one }) => ({
  post: one(posts, {
    fields: [platformPosts.postId],
    references: [posts.id]
  }),
  socialMediaAccount: one(socialMediaAccounts, {
    fields: [platformPosts.socialAccountId],
    references: [socialMediaAccounts.id]
  })
}))

// Review relations
export const reviewsRelations = relations(reviews, ({ one }) => ({
  businessProfile: one(businessProfiles, {
    fields: [reviews.businessId],
    references: [businessProfiles.id]
  })
}))

// Subscription relations
export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(user, {
    fields: [subscriptions.userId],
    references: [user.id]
  })
}))

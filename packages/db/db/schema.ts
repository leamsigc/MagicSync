import { relations } from 'drizzle-orm'
import { assetFolders } from './assets/asset-folders'
import { assets } from './assets/assets'

import { user } from './auth/auth'
// Import tables for relations
import { businessProfiles } from './business/business'
import { businessBrandKeys, businessCorpusSections } from './business/corpus'
import { entityDetails } from './entityDetails/entityDetails'
import { jwks, oauthAccessToken, oauthClient, oauthClientAssertion, oauthClientResource, oauthConsent, oauthRefreshToken, oauthResource } from './oauth/oauth'
import { notifications } from './notifications/notifications'
import { platformPosts, posts } from './posts/posts'
import { reviews } from './reviews/reviews'
import { socialMediaAccountManagers, socialMediaAccounts } from './socialMedia/socialMedia'
import { templates, templateAssets } from './templates/templates'
import { documents, documentChunks, chatThreads, chatMessages } from './rag/rag'
import { pipelines, pipelineRuns, agentRuns } from './pipelines/pipelines'
import { agentGoalRuns } from './pipelines/goal-runs'
import { publishConnections } from './publishing/publishing'
import { userLlmConfigs } from './llm/llm'
import { accountMetrics, postMetrics, statsSyncState } from './stats/stats'
import { inboxItems } from './inbox/inbox'

export * from './assets/assets'
export * from './assets/asset-folders'

// Export auth tables and types
export * from './auth/auth'
// OAuth 2.1 / MCP authorization-server tables (better-auth mcp + jwt plugins)
export * from './oauth/oauth'
// Export feature-specific tables and types
export * from './business/business'
export * from './business/corpus'
export * from './posts/posts'
export * from './reviews/reviews'
export * from './socialMedia/socialMedia'
export * from './templates/templates'
export * from './audit/audit'
export * from './entityDetails/entityDetails'
export * from './socialMedia/socialMedia'
export * from './notifications/notifications'
export * from './rag/rag'
export * from './llm/llm'
export * from './skills/skills'
export * from './skills/registry'
export * from './pipelines/pipelines'
export * from './pipelines/goal-runs'
export * from './pipelines/workflow-graph'
export * from './content/contracts'
export * from './content/artifacts'
export * from './content/templates'
export * from './content/board'
export * from './publishing/publishing'
export * from './stats/stats'
export * from './inbox/inbox'

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
  notifications: many(notifications),
  templates: many(templates),
  documents: many(documents),
  chatThreads: many(chatThreads),
  llmConfigs: many(userLlmConfigs),
  inboxItems: many(inboxItems),
  pipelines: many(pipelines),
  pipelineRuns: many(pipelineRuns),
  agentRuns: many(agentRuns),
  publishConnections: many(publishConnections),
  assetFolders: many(assetFolders)
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
  reviews: many(reviews),
  corpusSections: many(businessCorpusSections),
  brandKeys: many(businessBrandKeys),
  publishConnections: many(publishConnections),
  pipelines: many(pipelines),
  pipelineRuns: many(pipelineRuns),
  assetFolders: many(assetFolders)
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
  platformPosts: many(platformPosts),
  accountMetrics: many(accountMetrics),
  postMetrics: many(postMetrics),
  statsSyncState: one(statsSyncState, {
    fields: [socialMediaAccounts.id],
    references: [statsSyncState.socialAccountId]
  })
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
  }),
  folder: one(assetFolders, {
    fields: [assets.folderId],
    references: [assetFolders.id]
  })
}))

// Asset folder relations
export const assetFoldersRelations = relations(assetFolders, ({ one, many }) => ({
  user: one(user, {
    fields: [assetFolders.userId],
    references: [user.id]
  }),
  businessProfile: one(businessProfiles, {
    fields: [assetFolders.businessId],
    references: [businessProfiles.id]
  }),
  assets: many(assets)
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
  platformPosts: many(platformPosts),
  postMetrics: many(postMetrics)
}))

// Platform post relations
export const platformPostsRelations = relations(platformPosts, ({ one, many }) => ({
  post: one(posts, {
    fields: [platformPosts.postId],
    references: [posts.id]
  }),
  socialMediaAccount: one(socialMediaAccounts, {
    fields: [platformPosts.socialAccountId],
    references: [socialMediaAccounts.id]
  }),
  postMetrics: many(postMetrics)
}))

// Stats relations
export const accountMetricsRelations = relations(accountMetrics, ({ one }) => ({
  socialMediaAccount: one(socialMediaAccounts, {
    fields: [accountMetrics.socialAccountId],
    references: [socialMediaAccounts.id]
  })
}))

export const postMetricsRelations = relations(postMetrics, ({ one }) => ({
  post: one(posts, {
    fields: [postMetrics.postId],
    references: [posts.id]
  }),
  socialMediaAccount: one(socialMediaAccounts, {
    fields: [postMetrics.socialAccountId],
    references: [socialMediaAccounts.id]
  })
}))

export const statsSyncStateRelations = relations(statsSyncState, ({ one }) => ({
  socialMediaAccount: one(socialMediaAccounts, {
    fields: [statsSyncState.socialAccountId],
    references: [socialMediaAccounts.id]
  })
}))

export const inboxItemsRelations = relations(inboxItems, ({ one }) => ({
  user: one(user, {
    fields: [inboxItems.userId],
    references: [user.id]
  }),
  post: one(posts, {
    fields: [inboxItems.postId],
    references: [posts.id]
  }),
  socialMediaAccount: one(socialMediaAccounts, {
    fields: [inboxItems.socialAccountId],
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

// Notification relations
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(user, {
    fields: [notifications.userId],
    references: [user.id]
  })
}))

// Template relations
export const templatesRelations = relations(templates, ({ one, many }) => ({
  user: one(user, {
    fields: [templates.ownerId],
    references: [user.id]
  }),
  assets: many(templateAssets)
}))

export const templateAssetsRelations = relations(templateAssets, ({ one }) => ({
  template: one(templates, {
    fields: [templateAssets.templateId],
    references: [templates.id]
  })
}))

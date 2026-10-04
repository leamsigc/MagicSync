import type { InferSelectModel } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import z from 'zod'
import { user } from '../auth/auth'
import { businessProfiles } from '../business/business'
import { posts } from '../posts/posts'
import { agentRuns } from '../pipelines/pipelines'
import { contentArtifacts } from './artifacts'
import { contentTemplates } from './templates'

// Nuxt-native agent platform (PRD §6). Content board, pi session persistence,
// and content checks/runs. All access goes through services.

export const ContentItemStateSchema = z.enum([
  'idea',
  'drafting',
  'review_required',
  'scheduled',
  'published',
  'failed',
  'archived',
])

export type ContentItemState = z.infer<typeof ContentItemStateSchema>

// Deliverable the card produces when generated. `generate` routes on this:
// carousel cards run the carousel workflow (slides), everything else runs the
// social-post content chain. Same vocabulary as the topic-batch kinds.
export const ContentItemFormatSchema = z.enum(['social_post', 'carousel', 'reel', 'article'])
export type ContentItemFormat = z.infer<typeof ContentItemFormatSchema>

export const ContentSourceTypeSchema = z.enum(['trend', 'manual', 'template', 'repurpose'])
export type ContentSourceType = z.infer<typeof ContentSourceTypeSchema>

export const ContentActorKindSchema = z.enum(['user', 'agent'])
export type ContentActorKind = z.infer<typeof ContentActorKindSchema>

export const ContentCheckKindSchema = z.enum(['seo', 'geo', 'links', 'virality', 'engagement'])
export type ContentCheckKind = z.infer<typeof ContentCheckKindSchema>

export const ContentCheckStatusSchema = z.enum(['pass', 'warn', 'fail'])
export type ContentCheckStatus = z.infer<typeof ContentCheckStatusSchema>

export const ContentRunStatusSchema = z.enum(['pending', 'running', 'completed', 'failed'])
export type ContentRunStatus = z.infer<typeof ContentRunStatusSchema>

// One kanban card per content idea/deliverable for a business.
export const contentItems = sqliteTable('content_items', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businessProfiles.id, { onDelete: 'cascade' }),
  ownerUserId: text('owner_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  brief: text('brief').notNull().default(''),
  state: text('state', {
    enum: ['idea', 'drafting', 'review_required', 'scheduled', 'published', 'failed', 'archived'],
  }).notNull().default('idea'),
  format: text('format', {
    enum: ['social_post', 'carousel', 'reel', 'article'],
  }).notNull().default('social_post'),
  platforms: text('platforms', { mode: 'json' }),
  sourceType: text('source_type', {
    enum: ['trend', 'manual', 'template', 'repurpose'],
  }).notNull().default('manual'),
  sourceRef: text('source_ref'),
  templateId: text('template_id').references(() => contentTemplates.id, { onDelete: 'set null' }),
  artifactId: text('artifact_id').references(() => contentArtifacts.id, { onDelete: 'set null' }),
  postId: text('post_id').references(() => posts.id, { onDelete: 'set null' }),
  scheduledAt: integer('scheduled_at', { mode: 'timestamp' }),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  priority: integer('priority').notNull().default(0),
  createdBy: text('created_by', { enum: ['user', 'agent'] }).notNull().default('user'),
  createdByUserId: text('created_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  retryCount: integer('retry_count').notNull().default(0),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, table => [
  index('content_items_business_state_idx').on(table.businessId, table.state),
  index('content_items_business_updated_idx').on(table.businessId, table.updatedAt),
])

// Append-only audit trail; also links chat/tool activity to a card.
export const contentItemEvents = sqliteTable('content_item_events', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => contentItems.id, { onDelete: 'cascade' }),
  actorUserId: text('actor_user_id').references(() => user.id, { onDelete: 'set null' }),
  actorKind: text('actor_kind', { enum: ['user', 'agent'] }).notNull().default('user'),
  event: text('event').notNull(),
  fromState: text('from_state'),
  toState: text('to_state'),
  payload: text('payload', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, table => [
  index('content_item_events_item_created_idx').on(table.itemId, table.createdAt),
])

// SEO/GEO/link/virality/engagement results per card.
export const contentChecks = sqliteTable('content_checks', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => contentItems.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['seo', 'geo', 'links', 'virality', 'engagement'] }).notNull(),
  status: text('status', { enum: ['pass', 'warn', 'fail'] }).notNull(),
  score: integer('score'),
  findings: text('findings', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, table => [
  index('content_checks_item_kind_idx').on(table.itemId, table.kind),
])

// One row per chain step execution against a card.
export const contentRuns = sqliteTable('content_runs', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => contentItems.id, { onDelete: 'cascade' }),
  agentRunId: text('agent_run_id').references(() => agentRuns.id, { onDelete: 'set null' }),
  step: text('step').notNull(),
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).notNull().default('pending'),
  attempt: integer('attempt').notNull().default(1),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
}, table => [
  index('content_runs_item_created_idx').on(table.itemId, table.createdAt),
])

// pi agent session <-> chat thread link.
export const agentChatSessions = sqliteTable('agent_chat_sessions', {
  id: text('id').primaryKey(),
  businessId: text('business_id').notNull().references(() => businessProfiles.id, { onDelete: 'cascade' }),
  ownerUserId: text('owner_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  threadId: text('thread_id'),
  piSessionId: text('pi_session_id').notNull(),
  lastEntrySeq: integer('last_entry_seq').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// pi session persistence: header-less SessionEntry rows in order.
export const agentChatEntries = sqliteTable('agent_chat_entries', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => agentChatSessions.id, { onDelete: 'cascade' }),
  seq: integer('seq').notNull(),
  entry: text('entry', { mode: 'json' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
}, table => [
  uniqueIndex('agent_chat_entries_session_seq_unique').on(table.sessionId, table.seq),
])

export const contentItemsRelations = relations(contentItems, ({ one, many }) => ({
  business: one(businessProfiles, {
    fields: [contentItems.businessId],
    references: [businessProfiles.id],
  }),
  owner: one(user, {
    fields: [contentItems.ownerUserId],
    references: [user.id],
  }),
  template: one(contentTemplates, {
    fields: [contentItems.templateId],
    references: [contentTemplates.id],
  }),
  artifact: one(contentArtifacts, {
    fields: [contentItems.artifactId],
    references: [contentArtifacts.id],
  }),
  post: one(posts, {
    fields: [contentItems.postId],
    references: [posts.id],
  }),
  events: many(contentItemEvents),
  checks: many(contentChecks),
  runs: many(contentRuns),
}))

export const contentItemEventsRelations = relations(contentItemEvents, ({ one }) => ({
  item: one(contentItems, {
    fields: [contentItemEvents.itemId],
    references: [contentItems.id],
  }),
}))

export const contentChecksRelations = relations(contentChecks, ({ one }) => ({
  item: one(contentItems, {
    fields: [contentChecks.itemId],
    references: [contentItems.id],
  }),
}))

export const contentRunsRelations = relations(contentRuns, ({ one }) => ({
  item: one(contentItems, {
    fields: [contentRuns.itemId],
    references: [contentItems.id],
  }),
  agentRun: one(agentRuns, {
    fields: [contentRuns.agentRunId],
    references: [agentRuns.id],
  }),
}))

export const agentChatSessionsRelations = relations(agentChatSessions, ({ one, many }) => ({
  business: one(businessProfiles, {
    fields: [agentChatSessions.businessId],
    references: [businessProfiles.id],
  }),
  owner: one(user, {
    fields: [agentChatSessions.ownerUserId],
    references: [user.id],
  }),
  entries: many(agentChatEntries),
}))

export const agentChatEntriesRelations = relations(agentChatEntries, ({ one }) => ({
  session: one(agentChatSessions, {
    fields: [agentChatEntries.sessionId],
    references: [agentChatSessions.id],
  }),
}))

export type ContentItem = InferSelectModel<typeof contentItems>
export type ContentItemEvent = InferSelectModel<typeof contentItemEvents>
export type ContentCheck = InferSelectModel<typeof contentChecks>
export type ContentRun = InferSelectModel<typeof contentRuns>
export type AgentChatSession = InferSelectModel<typeof agentChatSessions>
export type AgentChatEntry = InferSelectModel<typeof agentChatEntries>

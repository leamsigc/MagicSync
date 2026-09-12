import type { InferSelectModel } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import z from 'zod'
import { user } from '../auth/auth'
import { businessProfiles } from '../business/business'

// Per-business publishing connections (Phase 5).
// Token-storage note: `secret` is stored as plaintext in the DB, mirroring the
// existing practice for social accounts (`socialMediaAccounts.accessToken`).
// `secretRef` is reserved for a future encrypted-vault reference.
export const publishConnections = sqliteTable('publish_connections', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  businessId: text('business_id').notNull().references(() => businessProfiles.id, { onDelete: 'cascade' }),
  provider: text('provider', {
    enum: ['github', 'wordpress']
  }).notNull(),
  name: text('name').notNull(),
  // JSON TEXT: { repo, path, branch } for github | { siteUrl, username } for wordpress
  config: text('config').notNull().default('{}'),
  secret: text('secret'),
  secretRef: text('secret_ref'),
  // Delivery mode per connection (T120): github commit|pr, wordpress draft|live.
  deliveryMode: text('delivery_mode').notNull().default('commit'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull()
})

// Idempotent outbound deliveries (T120 §3). The natural idempotency key is
// sha256(artifactId, artifactVersion, connectionId, mode).
export const publishingJobs = sqliteTable('publishing_jobs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  businessId: text('business_id').notNull().references(() => businessProfiles.id, { onDelete: 'cascade' }),
  connectionId: text('connection_id').references(() => publishConnections.id, { onDelete: 'set null' }),
  artifactId: text('artifact_id'),
  artifactVersion: integer('artifact_version'),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  status: text('status', {
    enum: ['queued', 'running', 'succeeded', 'failed', 'conflict', 'cancelled'],
  }).notNull().default('queued'),
  attemptCount: integer('attempt_count').notNull().default(0),
  remoteId: text('remote_id'),
  remoteUrl: text('remote_url'),
  commitSha: text('commit_sha'),
  pullRequestUrl: text('pull_request_url'),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

export type PublishingJob = InferSelectModel<typeof publishingJobs>

export const publishConnectionsRelations = relations(publishConnections, ({ one }) => ({
  user: one(user, {
    fields: [publishConnections.userId],
    references: [user.id]
  }),
  businessProfile: one(businessProfiles, {
    fields: [publishConnections.businessId],
    references: [businessProfiles.id]
  })
}))

export type PublishConnection = InferSelectModel<typeof publishConnections>
export type NewPublishConnection = Omit<PublishConnection, 'id' | 'createdAt' | 'updatedAt'>
export type PublishProvider = PublishConnection['provider']

export const PublishProviderSchema = z.enum(['github', 'wordpress'])

export const PublishConnectionConfigSchema = z.record(z.string(), z.unknown())

export const DeliveryModeSchema = z.enum(['commit', 'pr', 'draft', 'live'])

export type DeliveryMode = z.infer<typeof DeliveryModeSchema>

export const CreatePublishConnectionSchema = z.object({
  businessId: z.string().min(1),
  provider: PublishProviderSchema,
  name: z.string().min(1),
  config: PublishConnectionConfigSchema.optional().default({}),
  secret: z.string().optional(),
  secretRef: z.string().optional(),
  deliveryMode: DeliveryModeSchema.optional(),
})

export const UpdatePublishConnectionSchema = z.object({
  provider: PublishProviderSchema.optional(),
  name: z.string().min(1).optional(),
  config: PublishConnectionConfigSchema.optional(),
  secret: z.string().optional(),
  secretRef: z.string().optional(),
  deliveryMode: DeliveryModeSchema.optional(),
  isActive: z.boolean().optional()
})

export const CreatePublishingJobSchema = z.object({
  businessId: z.string().min(1),
  connectionId: z.string().min(1),
  artifactId: z.string().min(1),
  artifactVersion: z.number().int().positive(),
})

export type CreatePublishingJobData = z.infer<typeof CreatePublishingJobSchema>

export const PushContentRequestSchema = z.object({
  businessId: z.string().min(1),
  provider: PublishProviderSchema,
  title: z.string().min(1),
  markdown: z.string().min(1),
  path: z.string().optional()
})

export type CreatePublishConnectionData = z.infer<typeof CreatePublishConnectionSchema>
export type UpdatePublishConnectionData = z.infer<typeof UpdatePublishConnectionSchema>
export type PushContentData = z.infer<typeof PushContentRequestSchema>

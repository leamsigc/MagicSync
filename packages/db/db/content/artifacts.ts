import type { InferSelectModel } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { user } from '../auth/auth'
import { businessProfiles } from '../business/business'
import { pipelineRuns } from '../pipelines/pipelines'
import z from 'zod'

export const ArtifactKindSchema = z.enum([
  'social_post',
  'carousel',
  'reel_storyboard',
  'research',
  'template',
])

export type ArtifactKind = z.infer<typeof ArtifactKindSchema>

export const ArtifactStatusSchema = z.enum([
  'generating',
  'review_required',
  'approved',
  'changes_requested',
  'rejected',
  'failed',
  'draft',
  'scheduled',
  'published',
  'archived',
])

export type ArtifactStatus = z.infer<typeof ArtifactStatusSchema>

export const ReviewDecisionSchema = z.enum(['approved', 'changes_requested', 'rejected'])

export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>

// Durable content artifacts (T70 materializer + T80 chat). The natural key
// (run_id, version, kind) makes materialization idempotent.
export const contentArtifacts = sqliteTable('content_artifacts', {
  id: text('id').primaryKey(),
  ownerUserId: text('owner_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  businessId: text('business_id').notNull().references(() => businessProfiles.id, { onDelete: 'cascade' }),
  runId: text('run_id').references(() => pipelineRuns.id, { onDelete: 'set null' }),
  threadId: text('thread_id'),
  kind: text('kind', {
    enum: ['social_post', 'carousel', 'reel_storyboard', 'research', 'template'],
  }).notNull(),
  outputKind: text('output_kind').notNull().default('social_post_draft'),
  version: integer('version').notNull().default(1),
  status: text('status', {
    enum: ['generating', 'review_required', 'approved', 'changes_requested', 'rejected', 'failed', 'draft', 'scheduled', 'published', 'archived'],
  }).notNull().default('generating'),
  output: text('output').notNull().default('{}'),
  postId: text('post_id'),
  createdBy: text('created_by'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

export const approvalRecords = sqliteTable('approval_records', {
  id: text('id').primaryKey(),
  artifactId: text('artifact_id').notNull().references(() => contentArtifacts.id, { onDelete: 'cascade' }),
  runId: text('run_id').references(() => pipelineRuns.id, { onDelete: 'set null' }),
  threadId: text('thread_id'),
  decision: text('decision', {
    enum: ['approved', 'changes_requested', 'rejected'],
  }).notNull(),
  feedback: text('feedback').notNull().default(''),
  actor: text('actor').notNull(),
  version: integer('version').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

export const contentArtifactsRelations = relations(contentArtifacts, ({ one, many }) => ({
  owner: one(user, {
    fields: [contentArtifacts.ownerUserId],
    references: [user.id],
  }),
  business: one(businessProfiles, {
    fields: [contentArtifacts.businessId],
    references: [businessProfiles.id],
  }),
  run: one(pipelineRuns, {
    fields: [contentArtifacts.runId],
    references: [pipelineRuns.id],
  }),
  approvals: many(approvalRecords),
}))

export const approvalRecordsRelations = relations(approvalRecords, ({ one }) => ({
  artifact: one(contentArtifacts, {
    fields: [approvalRecords.artifactId],
    references: [contentArtifacts.id],
  }),
}))

export type ContentArtifact = InferSelectModel<typeof contentArtifacts>
export type ApprovalRecord = InferSelectModel<typeof approvalRecords>

export const SubmitArtifactSchema = z.object({
  businessId: z.string().min(1),
  runId: z.string().min(1).nullish(),
  threadId: z.string().min(1).nullish(),
  kind: ArtifactKindSchema,
  outputKind: z.string().min(1),
  output: z.record(z.string(), z.unknown()),
})

export type SubmitArtifactData = z.infer<typeof SubmitArtifactSchema>

export const ReviewArtifactSchema = z.object({
  decision: ReviewDecisionSchema,
  feedback: z.string().max(5000).default(''),
  version: z.number().int().positive(),
})

export type ReviewArtifactData = z.infer<typeof ReviewArtifactSchema>

export const EditArtifactSchema = z.object({
  output: z.record(z.string(), z.unknown()),
})

export type EditArtifactData = z.infer<typeof EditArtifactSchema>

import type { InferSelectModel } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { user } from '../auth/auth'
import { businessProfiles } from '../business/business'
import { posts } from '../posts/posts'
import z from 'zod'

// Persistent reusable content templates destructured from winning posts
// (PRD-ANALYTICS-TEMPLATES §6). Templates store structure and constraints,
// never a request to copy protected text verbatim.
export const contentTemplates = sqliteTable('content_templates', {
  id: text('id').primaryKey(),
  ownerUserId: text('owner_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  businessId: text('business_id').notNull().references(() => businessProfiles.id, { onDelete: 'cascade' }),
  sourcePostId: text('source_post_id').references(() => posts.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  platform: text('platform').notNull().default(''),
  hookStyle: text('hook_style').notNull().default(''),
  structure: text('structure').notNull().default('[]'),
  bodyBlocks: text('body_blocks').notNull().default('[]'),
  ctaStyle: text('cta_style').notNull().default(''),
  toneNotes: text('tone_notes').notNull().default(''),
  visualPattern: text('visual_pattern').notNull().default(''),
  requiredInputs: text('required_inputs').notNull().default('[]'),
  sourceMetrics: text('source_metrics').notNull().default('{}'),
  version: integer('version').notNull().default(1),
  status: text('status', {
    enum: ['draft', 'active', 'archived'],
  }).notNull().default('active'),
  createdBy: text('created_by'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

export const contentTemplatesRelations = relations(contentTemplates, ({ one }) => ({
  owner: one(user, {
    fields: [contentTemplates.ownerUserId],
    references: [user.id],
  }),
  business: one(businessProfiles, {
    fields: [contentTemplates.businessId],
    references: [businessProfiles.id],
  }),
  sourcePost: one(posts, {
    fields: [contentTemplates.sourcePostId],
    references: [posts.id],
  }),
}))

export type ContentTemplate = InferSelectModel<typeof contentTemplates>

export const CreateTemplateSchema = z.object({
  businessId: z.string().min(1),
  sourcePostId: z.string().min(1).nullish(),
  name: z.string().min(1).max(160),
  description: z.string().max(2000).default(''),
  platform: z.string().max(40).default(''),
  hookStyle: z.string().max(200).default(''),
  structure: z.array(z.string().max(120)).max(30).default([]),
  bodyBlocks: z.array(z.string().max(500)).max(30).default([]),
  ctaStyle: z.string().max(200).default(''),
  toneNotes: z.string().max(2000).default(''),
  visualPattern: z.string().max(500).default(''),
  requiredInputs: z.array(z.string().max(120)).max(30).default([]),
  sourceMetrics: z.string().max(10000).default('{}'),
})

export type CreateTemplateData = z.infer<typeof CreateTemplateSchema>

export const UpdateTemplateSchema = CreateTemplateSchema.partial().omit({ businessId: true, sourcePostId: true })

export type UpdateTemplateData = z.infer<typeof UpdateTemplateSchema>

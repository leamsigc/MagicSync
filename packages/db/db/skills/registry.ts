import type { InferSelectModel } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { user } from '../auth/auth'
import { businessProfiles } from '../business/business'
import z from 'zod'

export const SkillOwnerScopeSchema = z.enum(['user', 'business'])
export type SkillOwnerScope = z.infer<typeof SkillOwnerScopeSchema>

export const SkillSourceTypeSchema = z.enum(['built_in', 'authored', 'imported'])
export type SkillSourceType = z.infer<typeof SkillSourceTypeSchema>

export const RegistryStatusSchema = z.enum(['draft', 'active', 'disabled', 'archived'])
export type RegistryStatus = z.infer<typeof RegistryStatusSchema>

// Versioned, business-scoped skill definitions (PRD-SKILLS-AGENTS §3).
// Versions are immutable: edits to an active skill snapshot a new version;
// runs record exact version ids.
export const skillDefinitions = sqliteTable('skill_definitions', {
  id: text('id').primaryKey(),
  ownerUserId: text('owner_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  businessId: text('business_id').references(() => businessProfiles.id, { onDelete: 'cascade' }),
  ownerScope: text('owner_scope', { enum: ['user', 'business'] }).notNull().default('business'),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description').notNull().default(''),
  instructions: text('instructions').notNull().default(''),
  inputSchema: text('input_schema').notNull().default('{}'),
  outputSchema: text('output_schema').notNull().default('{}'),
  allowedTools: text('allowed_tools').notNull().default('[]'),
  sourceType: text('source_type', { enum: ['built_in', 'authored', 'imported'] }).notNull().default('authored'),
  sourceUri: text('source_uri'),
  contentHash: text('content_hash').notNull().default(''),
  version: integer('version').notNull().default(1),
  status: text('status', { enum: ['draft', 'active', 'disabled', 'archived'] }).notNull().default('draft'),
  createdBy: text('created_by'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

export const skillVersions = sqliteTable('skill_versions', {
  id: text('id').primaryKey(),
  skillId: text('skill_id').notNull().references(() => skillDefinitions.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  snapshot: text('snapshot').notNull(),
  createdBy: text('created_by'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

// Specialized agents: prompt + output contract + skill/tool policy (PRD §4).
export const agentDefinitions = sqliteTable('agent_definitions', {
  id: text('id').primaryKey(),
  ownerUserId: text('owner_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  businessId: text('business_id').references(() => businessProfiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  systemPrompt: text('system_prompt').notNull().default(''),
  skillVersionIds: text('skill_version_ids').notNull().default('[]'),
  allowedToolNames: text('allowed_tool_names').notNull().default('[]'),
  outputKind: text('output_kind').notNull().default('social_post_draft'),
  outputSchema: text('output_schema').notNull().default('{}'),
  maxSteps: integer('max_steps').notNull().default(10),
  maxChildAgents: integer('max_child_agents').notNull().default(2),
  requiresBusinessContext: integer('requires_business_context', { mode: 'boolean' }).notNull().default(true),
  requiresHumanReview: integer('requires_human_review', { mode: 'boolean' }).notNull().default(true),
  status: text('status', { enum: ['draft', 'active', 'disabled', 'archived'] }).notNull().default('draft'),
  version: integer('version').notNull().default(1),
  createdBy: text('created_by'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

export const agentVersions = sqliteTable('agent_versions', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agentDefinitions.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  snapshot: text('snapshot').notNull(),
  createdBy: text('created_by'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
})

export const skillDefinitionsRelations = relations(skillDefinitions, ({ one, many }) => ({
  owner: one(user, {
    fields: [skillDefinitions.ownerUserId],
    references: [user.id],
  }),
  business: one(businessProfiles, {
    fields: [skillDefinitions.businessId],
    references: [businessProfiles.id],
  }),
  versions: many(skillVersions),
}))

export const skillVersionsRelations = relations(skillVersions, ({ one }) => ({
  skill: one(skillDefinitions, {
    fields: [skillVersions.skillId],
    references: [skillDefinitions.id],
  }),
}))

export const agentDefinitionsRelations = relations(agentDefinitions, ({ one, many }) => ({
  owner: one(user, {
    fields: [agentDefinitions.ownerUserId],
    references: [user.id],
  }),
  business: one(businessProfiles, {
    fields: [agentDefinitions.businessId],
    references: [businessProfiles.id],
  }),
  versions: many(agentVersions),
}))

export const agentVersionsRelations = relations(agentVersions, ({ one }) => ({
  agent: one(agentDefinitions, {
    fields: [agentVersions.agentId],
    references: [agentDefinitions.id],
  }),
}))

export type SkillDefinition = InferSelectModel<typeof skillDefinitions>
export type SkillVersion = InferSelectModel<typeof skillVersions>
export type AgentDefinition = InferSelectModel<typeof agentDefinitions>
export type AgentVersion = InferSelectModel<typeof agentVersions>

export const CreateSkillSchema = z.object({
  businessId: z.string().min(1).nullish(),
  ownerScope: SkillOwnerScopeSchema.default('business'),
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).default(''),
  instructions: z.string().max(20000).default(''),
  inputSchema: z.string().max(20000).default('{}'),
  outputSchema: z.string().max(20000).default('{}'),
  allowedTools: z.array(z.string().max(80)).max(50).default([]),
  sourceType: SkillSourceTypeSchema.default('authored'),
  sourceUri: z.string().max(2000).nullish(),
})

export type CreateSkillData = z.infer<typeof CreateSkillSchema>

export const UpdateSkillSchema = CreateSkillSchema.partial().omit({ businessId: true, ownerScope: true, sourceType: true, sourceUri: true })

export type UpdateSkillData = z.infer<typeof UpdateSkillSchema>

export const CreateAgentSchema = z.object({
  businessId: z.string().min(1).nullish(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).default(''),
  systemPrompt: z.string().max(20000).default(''),
  skillVersionIds: z.array(z.string().min(1)).max(20).default([]),
  allowedToolNames: z.array(z.string().max(80)).max(50).default([]),
  outputKind: z.string().min(1).max(80).default('social_post_draft'),
  outputSchema: z.string().max(20000).default('{}'),
  maxSteps: z.number().int().min(1).max(100).default(10),
  maxChildAgents: z.number().int().min(0).max(10).default(2),
  requiresBusinessContext: z.boolean().default(true),
  requiresHumanReview: z.boolean().default(true),
})

export type CreateAgentData = z.infer<typeof CreateAgentSchema>

export const UpdateAgentSchema = CreateAgentSchema.partial().omit({ businessId: true })

export type UpdateAgentData = z.infer<typeof UpdateAgentSchema>

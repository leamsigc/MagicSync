import type { InferSelectModel } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import z from 'zod'
import { user } from '../auth/auth'
import { businessProfiles } from '../business/business'

export interface PipelineStep {
  id: string
  name: string
  type: string
  prompt?: string
  kind?: string
  position?: { x: number, y: number }
  config?: Record<string, unknown>
  next?: string[]
}

export type PipelineStatus = 'queued' | 'running' | 'waiting_input' | 'waiting_review' | 'changes_requested' | 'completed' | 'failed' | 'cancelled'
export type AgentRunStatus = 'running' | 'completed' | 'failed' | 'cancelled'

export const pipelines = sqliteTable('pipelines', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  businessId: text('business_id').notNull().references(() => businessProfiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  steps: text('steps').notNull().default('[]'),
  // Versioned Vue Flow graph (PRD-WORKFLOW-EDITOR §3). The legacy `steps`
  // column stays for the phase flow until the studio migrates fully.
  graph: text('graph').notNull().default('{}'),
  version: integer('version').notNull().default(1),
  status: text('status', {
    enum: ['draft', 'active', 'archived']
  }).notNull().default('draft'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull()
})

export const pipelineRuns = sqliteTable('pipeline_runs', {
  id: text('id').primaryKey(),
  pipelineId: text('pipeline_id').notNull().references(() => pipelines.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  businessId: text('business_id').notNull().references(() => businessProfiles.id, { onDelete: 'cascade' }),
  status: text('status', {
    enum: ['queued', 'running', 'waiting_input', 'waiting_review', 'changes_requested', 'completed', 'failed', 'cancelled']
  }).notNull().default('running'),
  currentStep: integer('current_step').notNull().default(0),
  input: text('input'),
  stepResults: text('step_results').notNull().default('[]'),
  // Immutable run snapshot: graph + agent/skill versions + policy (PRD §5).
  graphSnapshot: text('graph_snapshot'),
  currentNodeId: text('current_node_id'),
  nodeResults: text('node_results').notNull().default('[]'),
  attempts: text('attempts').notNull().default('[]'),
  approvalState: text('approval_state').notNull().default('{}'),
  lastCheckpointAt: integer('last_checkpoint_at', { mode: 'timestamp' }),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' })
})

export const agentRuns = sqliteTable('agent_runs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  businessId: text('business_id').references(() => businessProfiles.id, { onDelete: 'cascade' }),
  pipelineRunId: text('pipeline_run_id').references(() => pipelineRuns.id, { onDelete: 'cascade' }),
  parentAgentId: text('parent_agent_id'),
  agentName: text('agent_name').notNull(),
  status: text('status', {
    enum: ['running', 'completed', 'failed', 'cancelled']
  }).notNull().default('running'),
  tokensUsed: integer('tokens_used').notNull().default(0),
  cost: integer('cost'),
  durationMs: integer('duration_ms'),
  toolEvents: text('tool_events').notNull().default('[]'),
  summary: text('summary').notNull().default(''),
  startedAt: integer('started_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' })
})

export const pipelinesRelations = relations(pipelines, ({ one, many }) => ({
  user: one(user, {
    fields: [pipelines.userId],
    references: [user.id]
  }),
  businessProfile: one(businessProfiles, {
    fields: [pipelines.businessId],
    references: [businessProfiles.id]
  }),
  runs: many(pipelineRuns)
}))

export const pipelineRunsRelations = relations(pipelineRuns, ({ one, many }) => ({
  pipeline: one(pipelines, {
    fields: [pipelineRuns.pipelineId],
    references: [pipelines.id]
  }),
  user: one(user, {
    fields: [pipelineRuns.userId],
    references: [user.id]
  }),
  businessProfile: one(businessProfiles, {
    fields: [pipelineRuns.businessId],
    references: [businessProfiles.id]
  }),
  agentRuns: many(agentRuns)
}))

export const agentRunsRelations = relations(agentRuns, ({ one }) => ({
  user: one(user, {
    fields: [agentRuns.userId],
    references: [user.id]
  }),
  pipelineRun: one(pipelineRuns, {
    fields: [agentRuns.pipelineRunId],
    references: [pipelineRuns.id]
  })
}))

export type Pipeline = InferSelectModel<typeof pipelines>
export type PipelineRun = InferSelectModel<typeof pipelineRuns>
export type AgentRun = InferSelectModel<typeof agentRuns>

export const PipelineStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  prompt: z.string().optional(),
  kind: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  next: z.array(z.string()).optional()
})

export const CreatePipelineSchema = z.object({
  businessId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  steps: z.array(PipelineStepSchema),
  isDefault: z.boolean().optional()
})

export const UpdatePipelineSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  steps: z.array(PipelineStepSchema).optional(),
  isDefault: z.boolean().optional()
})

export const StartPipelineRunSchema = z.object({
  businessId: z.string(),
  input: z.unknown().optional()
})

export const AdvancePipelineRunSchema = z.object({
  approved: z.boolean(),
  feedback: z.string().optional()
})

export const QuickActionKindSchema = z.enum(['posts', 'carousels', 'reels'])

function refineRepurposeFields(
  data: { sourcePostId?: string, formats?: unknown[] },
  ctx: z.RefinementCtx
): void {
  if (!data.sourcePostId) {
    ctx.addIssue({ code: 'custom', message: 'sourcePostId is required for repurpose', path: ['sourcePostId'] })
  }
  if (!data.formats || data.formats.length === 0) {
    ctx.addIssue({ code: 'custom', message: 'formats is required for repurpose', path: ['formats'] })
  }
}

function refineBatchDays(data: { action: string, days?: number }, ctx: z.RefinementCtx): void {
  if (data.action !== 'repurpose' && data.days === undefined) {
    ctx.addIssue({ code: 'custom', message: 'days is required', path: ['days'] })
  }
}

export const QuickActionRequestSchema = z.object({
  businessId: z.string().min(1),
  action: z.enum(['posts', 'carousels', 'reels', 'repurpose']),
  days: z.number().int().min(1).max(30).optional(),
  theme: z.string().optional(),
  sourcePostId: z.string().optional(),
  formats: z.array(QuickActionKindSchema).optional()
}).superRefine((data, ctx) => {
  if (data.action === 'repurpose') {
    refineRepurposeFields(data, ctx)
  }
  refineBatchDays(data, ctx)
})

export type CreatePipelineData = z.infer<typeof CreatePipelineSchema>
export type UpdatePipelineData = z.infer<typeof UpdatePipelineSchema>
export type StartPipelineRunData = z.infer<typeof StartPipelineRunSchema>
export type AdvancePipelineRunData = z.infer<typeof AdvancePipelineRunSchema>
export type QuickActionRequestData = z.infer<typeof QuickActionRequestSchema>

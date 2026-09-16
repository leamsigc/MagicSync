import type { InferSelectModel } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { user } from '../auth/auth'
import { businessProfiles } from '../business/business'

export type GoalRunStatus = 'planning' | 'running' | 'waiting_for_approval' | 'completed' | 'failed' | 'cancelled'

/**
 * Agentic goal runs (one row per natural-language business goal). The plan and
 * its step states are stored as JSON so the orchestrator can pause at
 * `waiting_for_approval` and resume exactly where it stopped.
 */
export const agentGoalRuns = sqliteTable('agent_goal_runs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  businessId: text('business_id').notNull().references(() => businessProfiles.id, { onDelete: 'cascade' }),
  goal: text('goal').notNull(),
  status: text('status', {
    enum: ['planning', 'running', 'waiting_for_approval', 'completed', 'failed', 'cancelled'],
  }).notNull().default('planning'),
  plan: text('plan').notNull().default('{}'),
  steps: text('steps').notNull().default('[]'),
  result: text('result'),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (table) => [index('agent_goal_runs_business_idx').on(table.userId, table.businessId)])

export type AgentGoalRun = InferSelectModel<typeof agentGoalRuns>

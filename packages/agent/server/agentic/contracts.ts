import { z } from 'zod'
import type { H3Event } from 'h3'
import type { RequestLogger } from 'evlog'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import type { AgentComplete } from '../agent/tool-context'
import type { LangSearchClient } from '../utils/langsearch'

/** Lifecycle of a goal run. `waiting_for_approval` pauses before a consequential step. */
export const GOAL_RUN_STATUSES = [
  'planning',
  'running',
  'waiting_for_approval',
  'completed',
  'failed',
  'cancelled',
] as const
export const GoalRunStatusSchema = z.enum(GOAL_RUN_STATUSES)
export type GoalRunStatus = (typeof GOAL_RUN_STATUSES)[number]

export const GOAL_STEP_STATUSES = ['pending', 'running', 'completed', 'failed', 'skipped', 'waiting_approval'] as const
export const GoalStepStatusSchema = z.enum(GOAL_STEP_STATUSES)
export type GoalStepStatus = (typeof GOAL_STEP_STATUSES)[number]

export const GOAL_STEP_TYPES = ['research', 'analysis', 'creation', 'planning', 'monitoring'] as const
export const GoalStepTypeSchema = z.enum(GOAL_STEP_TYPES)

/** Hard ceiling for plans; the planner may never emit more steps. */
export const MAX_PLAN_STEPS = 12

export const GoalStepSchema = z.object({
  id: z.string().min(1).max(80),
  skill: z.string().min(1).max(80),
  title: z.string().min(1).max(200),
  type: GoalStepTypeSchema,
  dependsOn: z.array(z.string()).max(MAX_PLAN_STEPS).default([]),
  /** Optional structured input passed to the skill (validated against its schema). */
  input: z.record(z.string(), z.unknown()).optional(),
})
export type GoalStep = z.infer<typeof GoalStepSchema>

export const AgentPlanSchema = z.object({
  goal: z.string().min(1),
  summary: z.string().max(1000).default(''),
  steps: z.array(GoalStepSchema).min(1).max(MAX_PLAN_STEPS),
})
export type AgentPlan = z.infer<typeof AgentPlanSchema>

export const GoalStepStateSchema = z.object({
  id: z.string(),
  skill: z.string(),
  title: z.string(),
  status: GoalStepStatusSchema,
  error: z.string().nullish(),
  result: z.unknown().optional(),
})
export type GoalStepState = z.infer<typeof GoalStepStateSchema>

export const GoalErrorKinds = ['retryable', 'recoverable', 'requires-user', 'fatal'] as const
export type GoalErrorKind = (typeof GoalErrorKinds)[number]

/**
 * Runtime context handed to every skill execution. Tenant identity is resolved
 * server-side by the entry point; skills never receive model-chosen identities.
 */
export interface SkillRunContext {
  userId: string
  businessId: string
  goal: string
  /** Business-grounded system context (Brand Playbook), assembled for this run. */
  systemContext: string
  complete: AgentComplete
  event?: H3Event
  log?: RequestLogger
  /** Results of previously completed steps, keyed by step id. */
  previous: Record<string, unknown>
  /** Test seam: injected LangSearch client (default resolver reads settings/env). */
  langsearch?: LangSearchClient
  /** Test seam: LangSearch key override; undefined falls back to settings/env. */
  langsearchKey?: string | null
}

export interface SkillVerification {
  ok: boolean
  reason?: string
}

/**
 * A composable capability with validated contracts. Skills own WHAT to do;
 * tools own HOW; the orchestrator owns WHEN and in which order.
 */
export interface ExecutableSkill {
  id: string
  name: string
  /** One-line, action-oriented description shown to the planner model. */
  description: string
  inputSchema: z.ZodType
  outputSchema: z.ZodType
  requiredContext: string[]
  requiredTools: string[]
  /** Consequential skills pause the run for explicit human approval. */
  consequential: boolean
  verify: (output: unknown) => SkillVerification
  run: (ctx: SkillRunContext, input: unknown) => Promise<ServiceResponse<unknown>>
}

/** Specialist domain agent: a named grouping of skills with capability metadata. */
export interface DomainAgentDefinition {
  id: string
  name: string
  description: string
  capabilities: string[]
  requiredContext: string[]
  skills: string[]
  /** Resolved lazily as the union of its skills' requiredTools. */
  outputKind: string
  requiresHumanReview: boolean
}

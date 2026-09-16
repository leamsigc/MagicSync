import { and, desc, eq } from 'drizzle-orm'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { agentGoalRuns, type AgentGoalRun, type GoalRunStatus } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'

export interface StartGoalRunData {
  businessId: string
  goal: string
}

export interface GoalPlanData {
  plan: unknown
  steps: unknown[]
}

export interface GoalStatusData {
  error?: string | null
  result?: unknown
}

// Persistence for agentic goal runs (plan, step states, approval status).
export class GoalRunService {
  private db = useDrizzle()

  async start(userId: string, data: StartGoalRunData): Promise<ServiceResponse<AgentGoalRun>> {
    try {
      const [row] = await this.db.insert(agentGoalRuns).values({
        id: crypto.randomUUID(),
        userId,
        businessId: data.businessId,
        goal: data.goal,
        status: 'planning',
      }).returning()
      if (!row) return { success: false, error: 'Failed to start goal run' }
      return { success: true, data: row }
    } catch {
      return { success: false, error: 'Failed to start goal run' }
    }
  }

  async setPlan(runId: string, data: GoalPlanData): Promise<ServiceResponse<AgentGoalRun>> {
    try {
      const [row] = await this.db.update(agentGoalRuns).set({
        plan: JSON.stringify(data.plan ?? {}),
        steps: JSON.stringify(data.steps ?? []),
        status: 'running',
        updatedAt: new Date(),
      }).where(eq(agentGoalRuns.id, runId)).returning()
      if (!row) return { success: false, error: 'Goal run not found', code: 'NOT_FOUND' }
      return { success: true, data: row }
    } catch {
      return { success: false, error: 'Failed to save goal plan' }
    }
  }

  /** Best-effort step state persistence; never breaks the run it records. */
  async updateSteps(runId: string, steps: unknown[]): Promise<void> {
    try {
      await this.db.update(agentGoalRuns).set({
        steps: JSON.stringify(steps),
        updatedAt: new Date(),
      }).where(eq(agentGoalRuns.id, runId))
    } catch {
      // progress persistence is best-effort
    }
  }

  async setStatus(runId: string, status: GoalRunStatus, data: GoalStatusData = {}): Promise<ServiceResponse<AgentGoalRun>> {
    try {
      const finished = status === 'completed' || status === 'failed' || status === 'cancelled'
      const [row] = await this.db.update(agentGoalRuns).set({
        status,
        error: data.error ?? null,
        result: data.result === undefined ? null : JSON.stringify(data.result),
        completedAt: finished ? new Date() : null,
        updatedAt: new Date(),
      }).where(eq(agentGoalRuns.id, runId)).returning()
      if (!row) return { success: false, error: 'Goal run not found', code: 'NOT_FOUND' }
      return { success: true, data: row }
    } catch {
      return { success: false, error: 'Failed to update goal run' }
    }
  }

  async get(userId: string, runId: string): Promise<ServiceResponse<AgentGoalRun>> {
    try {
      const [row] = await this.db.select().from(agentGoalRuns)
        .where(and(eq(agentGoalRuns.id, runId), eq(agentGoalRuns.userId, userId)))
      if (!row) return { success: false, error: 'Goal run not found', code: 'NOT_FOUND' }
      return { success: true, data: row }
    } catch {
      return { success: false, error: 'Failed to load goal run' }
    }
  }

  async listByBusiness(userId: string, businessId: string, limit = 50): Promise<ServiceResponse<AgentGoalRun[]>> {
    try {
      const rows = await this.db.select().from(agentGoalRuns)
        .where(and(eq(agentGoalRuns.userId, userId), eq(agentGoalRuns.businessId, businessId)))
        .orderBy(desc(agentGoalRuns.createdAt))
        .limit(limit)
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to list goal runs' }
    }
  }
}

export const goalRunService = new GoalRunService()

import { and, desc, eq } from 'drizzle-orm'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { agentRuns, type AgentRun } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'

export interface StartAgentRunData {
  businessId?: string | null
  agentName: string
  pipelineRunId?: string | null
}

export interface FinishAgentRunData {
  status: 'completed' | 'failed' | 'cancelled'
  tokensUsed?: number
  cost?: number | null
  durationMs?: number
  toolEvents?: unknown[]
  summary?: string
}

// pi run telemetry on the existing agent_runs table (PRD §3.2 / T12).
export class AgentRunService {
  private db = useDrizzle()

  async start(userId: string, data: StartAgentRunData): Promise<ServiceResponse<AgentRun>> {
    try {
      const [row] = await this.db.insert(agentRuns).values({
        id: crypto.randomUUID(),
        userId,
        businessId: data.businessId ?? null,
        pipelineRunId: data.pipelineRunId ?? null,
        agentName: data.agentName,
        status: 'running',
      }).returning()
      return { success: true, data: row }
    } catch {
      return { success: false, error: 'Failed to start agent run' }
    }
  }

  async finish(runId: string, data: FinishAgentRunData): Promise<ServiceResponse<AgentRun>> {
    try {
      const [row] = await this.db
        .update(agentRuns)
        .set({
          status: data.status,
          tokensUsed: data.tokensUsed ?? 0,
          cost: data.cost ?? null,
          durationMs: data.durationMs ?? null,
          toolEvents: JSON.stringify(data.toolEvents ?? []),
          summary: data.summary ?? '',
          completedAt: new Date(),
        })
        .where(eq(agentRuns.id, runId))
        .returning()
      if (!row) return { success: false, error: 'Agent run not found', code: 'NOT_FOUND' }
      return { success: true, data: row }
    } catch {
      return { success: false, error: 'Failed to finish agent run' }
    }
  }

  /**
   * Best-effort progress update (stage summaries for polling UIs). Never
   * throws — progress must not break the pipeline it reports on.
   */
  async touch(runId: string, summary: string): Promise<void> {
    try {
      await this.db.update(agentRuns).set({ summary }).where(eq(agentRuns.id, runId))
    } catch {
      // progress is best-effort
    }
  }

  async listByBusiness(userId: string, businessId: string, limit = 50): Promise<ServiceResponse<AgentRun[]>> {
    try {
      const rows = await this.db
        .select()
        .from(agentRuns)
        .where(and(eq(agentRuns.userId, userId), eq(agentRuns.businessId, businessId)))
        .orderBy(desc(agentRuns.startedAt))
        .limit(limit)
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to list agent runs' }
    }
  }
}

export const agentRunService = new AgentRunService()

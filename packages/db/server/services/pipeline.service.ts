import { eq, and, desc } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { type ServiceResponse } from './types'
import { businessProfileService } from './business-profile.service'
import {
  linearizeGraph,
  validateWorkflowGraph,
  type WorkflowGraph,
  type WorkflowNode,
} from '#layers/BaseDB/db/pipelines/workflow-graph'
import {
  AGENT_OUTPUT_KINDS,
  agentRegistryService,
} from './agent-registry.service'
import { skillRegistryService } from './skill-registry.service'
import {
  pipelines,
  pipelineRuns,
  agentRuns,
  type Pipeline,
  type PipelineRun,
  type AgentRun,
  type PipelineStep,
  type PipelineStatus,
  type CreatePipelineData,
  type UpdatePipelineData,
  type StartPipelineRunData,
  type AdvancePipelineRunData,
  type QuickActionRequestData
} from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'

export interface LogAgentRunData {
  pipelineRunId?: string
  businessId?: string
  parentAgentId?: string
  agentName: string
  status?: 'running' | 'completed' | 'failed' | 'cancelled'
  tokensUsed?: number
  cost?: number | null
  durationMs?: number | null
  toolEvents?: unknown[]
  summary?: string
  error?: string
}

export interface AgentRunListOptions {
  pipelineRunId?: string
  businessId?: string
  status?: string
  limit?: number
}

interface AdvancePatch {
  error?: string
  values?: {
    status?: PipelineStatus
    currentStep?: number
    stepResults?: string
    completedAt?: Date | null
    updatedAt?: Date
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isPipelineStep(value: Record<string, unknown>): value is PipelineStep {
  return typeof value.id === 'string' && typeof value.name === 'string' && typeof value.type === 'string'
}

function isWorkflowSnapshot(value: unknown): value is { graph: { nodes: WorkflowNode[] }, order: string[] } {
  if (!isRecord(value) || !Array.isArray(value.order) || !value.order.every(item => typeof item === 'string')) return false
  const graph = value.graph
  if (!isRecord(graph) || !Array.isArray(graph.nodes)) return false
  return graph.nodes.every(node => isRecord(node) && typeof node.id === 'string')
}

const DEFAULT_SOCIAL_PIPELINE_STEPS: PipelineStep[] = [
  {
    id: 'research',
    name: 'Research topics',
    type: 'llm_agent',
    prompt: 'You are a social media research agent. Given the user brief, business context, and any reference documents, return the best topics with angles, hooks, and source notes as JSON.'
  },
  {
    id: 'writer',
    name: 'Write post',
    type: 'llm_single',
    prompt: 'You are a social media content writer. Use the research output and business context to write the post caption and slide copy.'
  },
  {
    id: 'humanizer',
    name: 'Humanize',
    type: 'llm_single',
    prompt: 'You are a human behavior and sentiment editor. Rewrite the draft to sound human and emotional without changing facts or structure.'
  },
  {
    id: 'design',
    name: 'Design HTML',
    type: 'llm_single',
    prompt: 'You are a social design agent. Output HTML only for the post image, carousel slides, or hero thumbnail. No explanations.'
  },
  {
    id: 'review',
    name: 'Human review',
    type: 'llm_human_input',
    prompt: 'Review the generated post and design. Approve to finish or request changes with feedback.'
  }
]

export class PipelineService {
  private db = useDrizzle()

  private parseJsonArray(raw: string | null): Array<Record<string, unknown>> {
    if (!raw) {
      return []
    }
    try {
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : []
    } catch {
      return []
    }
  }

  private parseSteps(raw: string | null): PipelineStep[] {
    return this.parseJsonArray(raw).filter(isPipelineStep)
  }

  private parseJsonObject(raw: string | null): Record<string, unknown> {
    if (!raw) {
      return {}
    }
    try {
      const parsed: unknown = JSON.parse(raw)
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }

  private async resolveOwnerId(
    userId: string,
    businessId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<string>> {
    try {
      const profile = await businessProfileService.findById(businessId, userId, event)
      if (!profile.success || !profile.data) {
        return { success: false, error: 'Business profile not found', code: 'NOT_FOUND' }
      }
      return { success: true, data: profile.data.userId }
    } catch {
      return { success: false, error: 'Failed to verify business access' }
    }
  }

  private buildPipelinePatch(data: UpdatePipelineData): Partial<typeof pipelines.$inferInsert> {
    const patch: Partial<typeof pipelines.$inferInsert> = { updatedAt: new Date() }
    if (data.name !== undefined) {
      patch.name = data.name
    }
    if (data.description !== undefined) {
      patch.description = data.description
    }
    if (data.steps !== undefined) {
      patch.steps = JSON.stringify(data.steps)
    }
    if (data.isDefault !== undefined) {
      patch.isDefault = data.isDefault
    }
    return patch
  }

  private isPausedForResume(run: PipelineRun, entries: Array<Record<string, unknown>>): boolean {
    if (run.status !== 'waiting_input') {
      return false
    }
    const last = entries[entries.length - 1] as { event?: unknown } | undefined
    return !!last && last.event === 'paused'
  }

  async getPipelineWithAccess(
    id: string,
    userId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<Pipeline>> {
    try {
      const [pipeline] = await this.db
        .select()
        .from(pipelines)
        .where(eq(pipelines.id, id))
        .limit(1)
      if (!pipeline) {
        return { success: false, error: 'Pipeline not found', code: 'NOT_FOUND' }
      }
      const owner = await this.resolveOwnerId(userId, pipeline.businessId, event)
      if (!owner.success || !owner.data) {
        return { success: false, error: 'Pipeline not found', code: 'NOT_FOUND' }
      }
      if (pipeline.userId !== owner.data) {
        return { success: false, error: 'Pipeline not found', code: 'NOT_FOUND' }
      }
      return { success: true, data: pipeline }
    } catch {
      return { success: false, error: 'Failed to fetch pipeline' }
    }
  }

  async getRunWithAccess(
    id: string,
    userId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<PipelineRun>> {
    try {
      const [run] = await this.db
        .select()
        .from(pipelineRuns)
        .where(eq(pipelineRuns.id, id))
        .limit(1)
      if (!run) {
        return { success: false, error: 'Pipeline run not found', code: 'NOT_FOUND' }
      }
      const owner = await this.resolveOwnerId(userId, run.businessId, event)
      if (!owner.success || !owner.data) {
        return { success: false, error: 'Pipeline run not found', code: 'NOT_FOUND' }
      }
      if (run.userId !== owner.data) {
        return { success: false, error: 'Pipeline run not found', code: 'NOT_FOUND' }
      }
      return { success: true, data: run }
    } catch {
      return { success: false, error: 'Failed to fetch pipeline run' }
    }
  }

  private async scopedOwnerForPipeline(
    id: string,
    userId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<string>> {
    if (!event) {
      return { success: true, data: userId }
    }
    const found = await this.getPipelineWithAccess(id, userId, event)
    if (!found.success || !found.data) {
      return { success: false, error: 'Pipeline not found', code: 'NOT_FOUND' }
    }
    return { success: true, data: found.data.userId }
  }

  private async scopedRunScope(
    id: string,
    userId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<{ ownerId: string, run: PipelineRun }>> {
    if (!event) {
      const existing = await this.getRun(id, userId)
      if (!existing.success || !existing.data) {
        return { success: false, error: 'Pipeline run not found', code: 'NOT_FOUND' }
      }
      return { success: true, data: { ownerId: userId, run: existing.data } }
    }
    const found = await this.getRunWithAccess(id, userId, event)
    if (!found.success || !found.data) {
      return { success: false, error: 'Pipeline run not found', code: 'NOT_FOUND' }
    }
    return { success: true, data: { ownerId: found.data.userId, run: found.data } }
  }

  private async loadPipelineSteps(pipelineId: string, userId: string): Promise<PipelineStep[]> {
    try {
      const [pipeline] = await this.db
        .select()
        .from(pipelines)
        .where(and(eq(pipelines.id, pipelineId), eq(pipelines.userId, userId)))
        .limit(1)

      if (!pipeline) {
        return []
      }
      return this.parseSteps(pipeline.steps)
    } catch {
      return []
    }
  }

  private async seedDefaultPipeline(userId: string, businessId: string): Promise<Pipeline | null> {
    try {
      const now = new Date()
      const [seeded] = await this.db.insert(pipelines).values({
        id: crypto.randomUUID(),
        userId,
        businessId,
        name: 'social_pipeline',
        description: 'Research, write, humanize, design, and review a social post.',
        steps: JSON.stringify(DEFAULT_SOCIAL_PIPELINE_STEPS),
        isDefault: true,
        createdAt: now,
        updatedAt: now
      }).returning()

      return seeded ?? null
    } catch {
      return null
    }
  }

  private async buildAdvancePatch(
    run: PipelineRun,
    userId: string,
    approved: boolean,
    feedback: string
  ): Promise<AdvancePatch> {
    if (run.status === 'completed' || run.status === 'failed') {
      return { error: 'Run already finished' }
    }

    const steps = await this.loadPipelineSteps(run.pipelineId, userId)
    const stepResults = this.parseJsonArray(run.stepResults)
    const now = new Date()

    if (!approved) {
      stepResults.push({ feedback, at: now.toISOString() })
      return {
        values: { stepResults: JSON.stringify(stepResults), status: 'waiting_input', updatedAt: now }
      }
    }

    const isLast = steps.length === 0 || run.currentStep >= steps.length - 1
    if (isLast) {
      return { values: { status: 'completed', completedAt: now, updatedAt: now } }
    }
    return {
      values: { currentStep: run.currentStep + 1, status: 'waiting_input', updatedAt: now }
    }
  }

  async listPipelines(userId: string, businessId: string, event?: H3Event): Promise<ServiceResponse<Pipeline[]>> {
    try {
      const owner = await this.resolveOwnerId(userId, businessId, event)
      if (!owner.success || !owner.data) {
        return { success: false, error: owner.error ?? 'Business profile not found', code: 'NOT_FOUND' }
      }
      const rows = await this.db
        .select()
        .from(pipelines)
        .where(and(eq(pipelines.userId, owner.data), eq(pipelines.businessId, businessId)))
        .orderBy(desc(pipelines.updatedAt))

      if (rows.length === 0) {
        const seeded = await this.seedDefaultPipeline(owner.data, businessId)
        return { success: true, data: seeded ? [seeded] : [] }
      }

      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to fetch pipelines' }
    }
  }

  async getPipeline(id: string, userId: string, event?: H3Event): Promise<ServiceResponse<Pipeline>> {
    try {
      if (event) {
        return await this.getPipelineWithAccess(id, userId, event)
      }
      const [pipeline] = await this.db
        .select()
        .from(pipelines)
        .where(and(eq(pipelines.id, id), eq(pipelines.userId, userId)))
        .limit(1)

      if (!pipeline) {
        return { success: false, error: 'Pipeline not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: pipeline }
    } catch {
      return { success: false, error: 'Failed to fetch pipeline' }
    }
  }

  async createPipeline(userId: string, data: CreatePipelineData, event?: H3Event): Promise<ServiceResponse<Pipeline>> {
    try {
      if (!data.name || !data.businessId) {
        return { success: false, error: 'Name and businessId are required', code: 'VALIDATION_ERROR' }
      }
      const owner = await this.resolveOwnerId(userId, data.businessId, event)
      if (!owner.success || !owner.data) {
        return { success: false, error: owner.error ?? 'Business profile not found', code: 'NOT_FOUND' }
      }

      const now = new Date()
      const [pipeline] = await this.db.insert(pipelines).values({
        id: crypto.randomUUID(),
        userId: owner.data,
        businessId: data.businessId,
        name: data.name,
        description: data.description ?? '',
        steps: JSON.stringify(data.steps ?? []),
        isDefault: data.isDefault ?? false,
        createdAt: now,
        updatedAt: now
      }).returning()

      return { success: true, data: pipeline }
    } catch {
      return { success: false, error: 'Failed to create pipeline' }
    }
  }

  async updatePipeline(
    id: string,
    userId: string,
    data: UpdatePipelineData,
    event?: H3Event
  ): Promise<ServiceResponse<Pipeline>> {
    try {
      const scope = await this.scopedOwnerForPipeline(id, userId, event)
      if (!scope.success || !scope.data) {
        return { success: false, error: scope.error ?? 'Pipeline not found', code: 'NOT_FOUND' }
      }
      const patch = this.buildPipelinePatch(data)

      const [updated] = await this.db
        .update(pipelines)
        .set(patch)
        .where(and(eq(pipelines.id, id), eq(pipelines.userId, scope.data)))
        .returning()

      if (!updated) {
        return { success: false, error: 'Pipeline not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to update pipeline' }
    }
  }

  async deletePipeline(id: string, userId: string, event?: H3Event): Promise<ServiceResponse<Pipeline>> {
    try {
      const scope = await this.scopedOwnerForPipeline(id, userId, event)
      if (!scope.success || !scope.data) {
        return { success: false, error: scope.error ?? 'Pipeline not found', code: 'NOT_FOUND' }
      }
      const [deleted] = await this.db
        .delete(pipelines)
        .where(and(eq(pipelines.id, id), eq(pipelines.userId, scope.data)))
        .returning()

      if (!deleted) {
        return { success: false, error: 'Pipeline not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: deleted }
    } catch {
      return { success: false, error: 'Failed to delete pipeline' }
    }
  }

  async startRun(userId: string, data: StartPipelineRunData & { pipelineId: string }, event?: H3Event): Promise<ServiceResponse<PipelineRun>> {
    try {
      const pipeline = event
        ? await this.getPipelineWithAccess(data.pipelineId, userId, event)
        : await this.getPipeline(data.pipelineId, userId)
      if (!pipeline.success || !pipeline.data) {
        return { success: false, error: 'Pipeline not found', code: 'NOT_FOUND' }
      }
      if (pipeline.data.businessId !== data.businessId) {
        return { success: false, error: 'Pipeline does not belong to this business', code: 'VALIDATION_ERROR' }
      }

      const now = new Date()
      const [run] = await this.db.insert(pipelineRuns).values({
        id: crypto.randomUUID(),
        pipelineId: data.pipelineId,
        userId: pipeline.data.userId,
        businessId: data.businessId,
        status: 'running',
        currentStep: 0,
        input: data.input === undefined ? null : JSON.stringify(data.input),
        stepResults: '[]',
        createdAt: now,
        updatedAt: now
      }).returning()

      return { success: true, data: run }
    } catch {
      return { success: false, error: 'Failed to start pipeline run' }
    }
  }

  async listRuns(userId: string, businessId: string, event?: H3Event): Promise<ServiceResponse<PipelineRun[]>> {
    try {
      if (!businessId) {
        return { success: false, error: 'businessId is required', code: 'VALIDATION_ERROR' }
      }
      const owner = await this.resolveOwnerId(userId, businessId, event)
      if (!owner.success || !owner.data) {
        return { success: false, error: owner.error ?? 'Business profile not found', code: 'NOT_FOUND' }
      }
      const rows = await this.db
        .select()
        .from(pipelineRuns)
        .where(and(eq(pipelineRuns.userId, owner.data), eq(pipelineRuns.businessId, businessId)))
        .orderBy(desc(pipelineRuns.updatedAt))
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to fetch pipeline runs' }
    }
  }

  async getRun(id: string, userId: string, event?: H3Event): Promise<ServiceResponse<PipelineRun>> {
    try {
      if (event) {
        return await this.getRunWithAccess(id, userId, event)
      }
      const [run] = await this.db
        .select()
        .from(pipelineRuns)
        .where(and(eq(pipelineRuns.id, id), eq(pipelineRuns.userId, userId)))
        .limit(1)

      if (!run) {
        return { success: false, error: 'Pipeline run not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: run }
    } catch {
      return { success: false, error: 'Failed to fetch pipeline run' }
    }
  }

  async advanceRun(
    id: string,
    userId: string,
    data: AdvancePipelineRunData,
    event?: H3Event
  ): Promise<ServiceResponse<PipelineRun>> {
    try {
      const scope = await this.scopedRunScope(id, userId, event)
      if (!scope.success || !scope.data) {
        return { success: false, error: scope.error ?? 'Pipeline run not found', code: 'NOT_FOUND' }
      }

      const patch = await this.buildAdvancePatch(scope.data.run, scope.data.ownerId, data.approved, data.feedback ?? '')
      if (patch.error || !patch.values) {
        return { success: false, error: patch.error ?? 'Failed to advance pipeline run', code: 'VALIDATION_ERROR' }
      }

      const [updated] = await this.db
        .update(pipelineRuns)
        .set(patch.values)
        .where(and(eq(pipelineRuns.id, id), eq(pipelineRuns.userId, scope.data.ownerId)))
        .returning()

      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to advance pipeline run' }
    }
  }

  async recordExecution(
    id: string,
    userId: string,
    data: { status: PipelineStatus, stepResults: unknown[], agentName: string, tokensUsed?: number, summary?: string },
    event?: H3Event
  ): Promise<ServiceResponse<PipelineRun>> {
    try {
      const scope = await this.scopedRunScope(id, userId, event)
      if (!scope.success || !scope.data) {
        return { success: false, error: scope.error ?? 'Pipeline run not found', code: 'NOT_FOUND' }
      }
      const now = new Date()
      const finished = data.status === 'completed' || data.status === 'failed'
      const [updated] = await this.db
        .update(pipelineRuns)
        .set({
          status: data.status,
          stepResults: JSON.stringify(data.stepResults),
          completedAt: finished ? now : null,
          updatedAt: now
        })
        .where(and(eq(pipelineRuns.id, id), eq(pipelineRuns.userId, scope.data.ownerId)))
        .returning()
      await this.logAgentRun(scope.data.ownerId, {
        pipelineRunId: id,
        agentName: data.agentName,
        tokensUsed: data.tokensUsed ?? 0,
        summary: data.summary ?? `Executed, status ${data.status}`
      })
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to record pipeline execution' }
    }
  }

  async resetToStep(
    id: string,
    userId: string,
    step: number,
    event?: H3Event
  ): Promise<ServiceResponse<PipelineRun>> {
    try {
      const scope = await this.scopedRunScope(id, userId, event)
      if (!scope.success || !scope.data) {
        return { success: false, error: scope.error ?? 'Pipeline run not found', code: 'NOT_FOUND' }
      }
      if (!Number.isInteger(step) || step < 0) {
        return { success: false, error: 'Step must be a non-negative integer', code: 'VALIDATION_ERROR' }
      }
      const kept = this.parseJsonArray(scope.data.run.stepResults).filter((entry) => {
        const at = (entry as { step?: unknown }).step
        return typeof at !== 'number' || at < step
      })
      const [updated] = await this.db
        .update(pipelineRuns)
        .set({
          currentStep: step,
          status: 'running',
          stepResults: JSON.stringify(kept),
          completedAt: null,
          updatedAt: new Date()
        })
        .where(and(eq(pipelineRuns.id, id), eq(pipelineRuns.userId, scope.data.ownerId)))
        .returning()
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to reset pipeline run' }
    }
  }

  async updateRunInput(
    id: string,
    userId: string,
    input: Record<string, unknown>,
    event?: H3Event
  ): Promise<ServiceResponse<PipelineRun>> {
    try {
      const scope = await this.scopedRunScope(id, userId, event)
      if (!scope.success || !scope.data) {
        return { success: false, error: scope.error ?? 'Pipeline run not found', code: 'NOT_FOUND' }
      }
      const merged = { ...this.parseJsonObject(scope.data.run.input), ...input }
      const [updated] = await this.db
        .update(pipelineRuns)
        .set({ input: JSON.stringify(merged), updatedAt: new Date() })
        .where(and(eq(pipelineRuns.id, id), eq(pipelineRuns.userId, scope.data.ownerId)))
        .returning()
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to update pipeline run input' }
    }
  }

  async pauseRun(id: string, userId: string, event?: H3Event): Promise<ServiceResponse<PipelineRun>> {
    try {
      const scope = await this.scopedRunScope(id, userId, event)
      if (!scope.success || !scope.data) {
        return { success: false, error: scope.error ?? 'Pipeline run not found', code: 'NOT_FOUND' }
      }
      if (scope.data.run.status !== 'running') {
        return { success: false, error: 'Only running runs can be paused', code: 'VALIDATION_ERROR' }
      }
      const entries = this.parseJsonArray(scope.data.run.stepResults)
      entries.push({ event: 'paused', at: new Date().toISOString() })
      const [updated] = await this.db
        .update(pipelineRuns)
        .set({ status: 'waiting_input', stepResults: JSON.stringify(entries), updatedAt: new Date() })
        .where(and(eq(pipelineRuns.id, id), eq(pipelineRuns.userId, scope.data.ownerId)))
        .returning()
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to pause pipeline run' }
    }
  }

  async resumeRun(id: string, userId: string, event?: H3Event): Promise<ServiceResponse<PipelineRun>> {
    try {
      const scope = await this.scopedRunScope(id, userId, event)
      if (!scope.success || !scope.data) {
        return { success: false, error: scope.error ?? 'Pipeline run not found', code: 'NOT_FOUND' }
      }
      const entries = this.parseJsonArray(scope.data.run.stepResults)
      if (!this.isPausedForResume(scope.data.run, entries)) {
        return { success: false, error: 'Run is not paused', code: 'VALIDATION_ERROR' }
      }
      entries.push({ event: 'resumed', at: new Date().toISOString() })
      const [updated] = await this.db
        .update(pipelineRuns)
        .set({ status: 'running', stepResults: JSON.stringify(entries), updatedAt: new Date() })
        .where(and(eq(pipelineRuns.id, id), eq(pipelineRuns.userId, scope.data.ownerId)))
        .returning()
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to resume pipeline run' }
    }
  }

  async deleteRun(id: string, userId: string, event?: H3Event): Promise<ServiceResponse<{ id: string }>> {
    try {
      const scope = await this.scopedRunScope(id, userId, event)
      if (!scope.success || !scope.data) {
        return { success: false, error: scope.error ?? 'Pipeline run not found', code: 'NOT_FOUND' }
      }
      const [deleted] = await this.db
        .delete(pipelineRuns)
        .where(and(eq(pipelineRuns.id, id), eq(pipelineRuns.userId, scope.data.ownerId)))
        .returning({ id: pipelineRuns.id })
      if (!deleted) {
        return { success: false, error: 'Pipeline run not found', code: 'NOT_FOUND' }
      }
      return { success: true, data: { id: deleted.id } }
    } catch {
      return { success: false, error: 'Failed to delete pipeline run' }
    }
  }

  async logAgentRun(userId: string, data: LogAgentRunData, event?: H3Event): Promise<ServiceResponse<AgentRun>> {
    try {
      if (!data.agentName) {
        return { success: false, error: 'agentName is required', code: 'VALIDATION_ERROR' }
      }
      let ownerId = userId
      if (data.pipelineRunId && event) {
        const scope = await this.scopedRunScope(data.pipelineRunId, userId, event)
        if (!scope.success || !scope.data) {
          return { success: false, error: 'Pipeline run not found', code: 'NOT_FOUND' }
        }
        ownerId = scope.data.ownerId
      }

      const now = new Date()
      const status = data.status ?? 'running'
      const terminal = status === 'completed' || status === 'failed' || status === 'cancelled'
      const [run] = await this.db.insert(agentRuns).values({
        id: crypto.randomUUID(),
        userId: ownerId,
        businessId: data.businessId ?? null,
        pipelineRunId: data.pipelineRunId ?? null,
        parentAgentId: data.parentAgentId ?? null,
        agentName: data.agentName,
        status,
        tokensUsed: data.tokensUsed ?? 0,
        cost: data.cost ?? null,
        durationMs: data.durationMs ?? null,
        toolEvents: JSON.stringify(data.toolEvents ?? []),
        summary: data.summary ?? '',
        startedAt: now,
        completedAt: terminal ? now : null,
      }).returning()

      return { success: true, data: run }
    } catch {
      return { success: false, error: 'Failed to log agent run' }
    }
  }

  private async resolveDefaultPipeline(userId: string, businessId: string, event?: H3Event): Promise<ServiceResponse<Pipeline>> {
    try {
      const owner = await this.resolveOwnerId(userId, businessId, event)
      if (!owner.success || !owner.data) {
        return { success: false, error: owner.error ?? 'Business profile not found', code: 'NOT_FOUND' }
      }
      const [found] = await this.db
        .select()
        .from(pipelines)
        .where(and(eq(pipelines.userId, owner.data), eq(pipelines.businessId, businessId), eq(pipelines.isDefault, true)))
        .limit(1)

      if (found) {
        return { success: true, data: found }
      }
      const seeded = await this.seedDefaultPipeline(owner.data, businessId)
      if (!seeded) {
        return { success: false, error: 'No default pipeline available' }
      }
      return { success: true, data: seeded }
    } catch {
      return { success: false, error: 'Failed to resolve default pipeline' }
    }
  }

  private quickActionKindError(action: string | undefined): string | null {
    if (action === 'posts' || action === 'carousels' || action === 'reels') {
      return null
    }
    return 'Action must be posts, carousels, or reels'
  }

  private quickDaysError(days: number | undefined): string | null {
    if (Number.isInteger(days) && (days as number) >= 1 && (days as number) <= 30) {
      return null
    }
    return 'Days must be an integer between 1 and 30'
  }

  private quickActionError(data: QuickActionRequestData): string | null {
    if (!data.businessId) {
      return 'businessId is required'
    }
    const kindError = this.quickActionKindError(data.action)
    if (kindError) {
      return kindError
    }
    return this.quickDaysError(data.days)
  }

  private createQuickActionRun(
    userId: string,
    pipelineId: string,
    data: QuickActionRequestData,
    batchId: string,
    dayOffset: number,
    event?: H3Event
  ): Promise<ServiceResponse<PipelineRun>> {
    return this.startRun(userId, {
      pipelineId,
      businessId: data.businessId,
      input: { dayOffset, format: data.action, theme: data.theme ?? null, batchId }
    }, event)
  }

  private async createQuickActionBatch(
    userId: string,
    pipelineId: string,
    data: QuickActionRequestData,
    batchId: string,
    days: number,
    event?: H3Event
  ): Promise<ServiceResponse<PipelineRun[]>> {
    const runs: PipelineRun[] = []
    for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
      const created = await this.createQuickActionRun(userId, pipelineId, data, batchId, dayOffset, event)
      if (!created.success || !created.data) {
        return { success: false, error: created.error ?? 'Failed to queue quick action runs' }
      }
      runs.push(created.data)
    }
    return { success: true, data: runs }
  }

  async queueQuickAction(userId: string, data: QuickActionRequestData, event?: H3Event): Promise<ServiceResponse<PipelineRun[]>> {
    try {
      const invalid = this.quickActionError(data)
      if (invalid) {
        return { success: false, error: invalid, code: 'VALIDATION_ERROR' }
      }
      const pipeline = await this.resolveDefaultPipeline(userId, data.businessId, event)
      if (!pipeline.success || !pipeline.data) {
        return { success: false, error: pipeline.error ?? 'No default pipeline available' }
      }
      return await this.createQuickActionBatch(userId, pipeline.data.id, data, crypto.randomUUID(), data.days as number, event)
    } catch {
      return { success: false, error: 'Failed to queue quick action' }
    }
  }

  private repurposeFormatsError(formats: unknown): string | null {
    if (!Array.isArray(formats) || formats.length === 0) {
      return 'Formats must be a non-empty array'
    }
    const allowed = ['posts', 'carousels', 'reels']
    const invalid = formats.some((format) => !allowed.includes(format))
    if (invalid) {
      return 'Formats must be a subset of posts, carousels, reels'
    }
    return null
  }

  private repurposeError(data: QuickActionRequestData): string | null {
    if (data.action !== 'repurpose') {
      return 'Action must be repurpose'
    }
    if (!data.businessId) {
      return 'businessId is required'
    }
    if (!data.sourcePostId) {
      return 'sourcePostId is required'
    }
    return this.repurposeFormatsError(data.formats)
  }

  async repurposePost(userId: string, data: QuickActionRequestData, event?: H3Event): Promise<ServiceResponse<PipelineRun>> {
    try {
      const invalid = this.repurposeError(data)
      if (invalid) {
        return { success: false, error: invalid, code: 'VALIDATION_ERROR' }
      }
      const pipeline = await this.resolveDefaultPipeline(userId, data.businessId, event)
      if (!pipeline.success || !pipeline.data) {
        return { success: false, error: pipeline.error ?? 'No default pipeline available' }
      }
      return await this.startRun(userId, {
        pipelineId: pipeline.data.id,
        businessId: data.businessId,
        input: { repurposeFrom: data.sourcePostId, formats: data.formats }
      }, event)
    } catch {
      return { success: false, error: 'Failed to repurpose post' }
    }
  }

  async listAgentRuns(
    userId: string,
    options: AgentRunListOptions = {},
    event?: H3Event
  ): Promise<ServiceResponse<AgentRun[]>> {
    try {
      let ownerId = userId
      if (options.pipelineRunId && event) {
        const scope = await this.scopedRunScope(options.pipelineRunId, userId, event)
        if (!scope.success || !scope.data) {
          return { success: false, error: 'Pipeline run not found', code: 'NOT_FOUND' }
        }
        ownerId = scope.data.ownerId
      }
      const filters = [eq(agentRuns.userId, ownerId)]
      if (options.pipelineRunId) filters.push(eq(agentRuns.pipelineRunId, options.pipelineRunId))
      if (options.businessId) filters.push(eq(agentRuns.businessId, options.businessId))
      if (options.status) filters.push(eq(agentRuns.status, options.status as AgentRun['status']))

      const rows = await this.db
        .select()
        .from(agentRuns)
        .where(and(...filters))
        .orderBy(desc(agentRuns.startedAt))
        .limit(options.limit ?? 20)

      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to fetch agent runs' }
    }
  }

  private async canCloseAgentRun(target: AgentRun, userId: string, event?: H3Event): Promise<boolean> {
    if (target.userId === userId) return true
    if (!event || !target.businessId) return false
    const access = await businessProfileService.findById(target.businessId, userId, event)
    return access.success
  }

  async closeAgentRun(
    userId: string,
    id: string,
    data: { status: 'completed' | 'failed' | 'cancelled', tokensUsed?: number, cost?: number | null, durationMs?: number | null, summary?: string },
    event?: H3Event
  ): Promise<ServiceResponse<AgentRun>> {
    try {
      const [target] = await this.db
        .select()
        .from(agentRuns)
        .where(eq(agentRuns.id, id))
        .limit(1)
      if (!target) {
        return { success: false, error: 'Agent run not found', code: 'NOT_FOUND' }
      }
      if (!(await this.canCloseAgentRun(target, userId, event))) {
        return { success: false, error: 'Agent run not found', code: 'NOT_FOUND' }
      }
      if (target.status !== 'running') {
        return { success: false, error: 'Agent run is not open', code: 'VALIDATION_ERROR' }
      }
      const now = new Date()
      const [updated] = await this.db
        .update(agentRuns)
        .set({
          status: data.status,
          tokensUsed: data.tokensUsed ?? target.tokensUsed,
          cost: data.cost ?? target.cost,
          durationMs: data.durationMs ?? now.getTime() - new Date(target.startedAt).getTime(),
          summary: data.summary ?? target.summary,
          completedAt: now,
        })
        .where(eq(agentRuns.id, id))
        .returning()
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to close agent run' }
    }
  }

  // ---------------- T60 versioned graph workflows ----------------

  private parseGraph(raw: string | null): WorkflowGraph | null {
    if (!raw || raw === '{}') return null
    try {
      const parsed: unknown = JSON.parse(raw)
      const result = validateWorkflowGraph(parsed)
      return result.ok ? (parsed as WorkflowGraph) : null
    } catch {
      return null
    }
  }

  private parseNodeResults(raw: string | null): Array<Record<string, unknown>> {
    return this.parseJsonArray(raw)
  }

  async getGraph(userId: string, pipelineId: string, event?: H3Event): Promise<ServiceResponse<WorkflowGraph | null>> {
    try {
      const found = await this.getPipelineWithAccess(pipelineId, userId, event)
      if (!found.success || !found.data) {
        return { success: false, error: 'Pipeline not found', code: 'NOT_FOUND' }
      }
      return { success: true, data: this.parseGraph(found.data.graph) }
    } catch {
      return { success: false, error: 'Failed to fetch workflow graph' }
    }
  }

  private async checkGraphRefs(graph: WorkflowGraph): Promise<string | null> {
    for (const node of graph.nodes) {
      if (node.kind === 'agent' && node.agentId) {
        const resolved = await agentRegistryService.resolveAgentVersion(node.agentId, node.agentVersion ?? null)
        if (!resolved.success) return `Unknown agent version for node '${node.id}'`
      }
      if (node.kind === 'skill' && node.skillId) {
        const resolved = await skillRegistryService.resolveSkillVersion(node.skillId, node.skillVersion ?? null)
        if (!resolved.success) return `Unknown skill version for node '${node.id}'`
      }
    }
    return null
  }

  async saveGraph(userId: string, pipelineId: string, graph: unknown, event?: H3Event): Promise<ServiceResponse<Pipeline>> {
    try {
      const found = await this.getPipelineWithAccess(pipelineId, userId, event)
      if (!found.success || !found.data) {
        return { success: false, error: 'Pipeline not found', code: 'NOT_FOUND' }
      }
      if (found.data.status !== 'draft') {
        return { success: false, error: 'Only draft workflows can be edited', code: 'VALIDATION_ERROR' }
      }
      const validation = validateWorkflowGraph(graph)
      if (!validation.ok) {
        return { success: false, error: validation.errors[0] ?? 'Invalid graph', code: 'VALIDATION_ERROR' }
      }
      const missingRef = await this.checkGraphRefs(graph as WorkflowGraph)
      if (missingRef) {
        return { success: false, error: missingRef, code: 'VALIDATION_ERROR' }
      }
      const [updated] = await this.db
        .update(pipelines)
        .set({ graph: JSON.stringify(graph), updatedAt: new Date() })
        .where(eq(pipelines.id, pipelineId))
        .returning()
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to save workflow graph' }
    }
  }

  async activatePipeline(userId: string, pipelineId: string, event?: H3Event): Promise<ServiceResponse<Pipeline>> {
    try {
      const found = await this.getPipelineWithAccess(pipelineId, userId, event)
      if (!found.success || !found.data) {
        return { success: false, error: 'Pipeline not found', code: 'NOT_FOUND' }
      }
      if (found.data.status !== 'draft') {
        return { success: false, error: 'Only draft workflows can be activated', code: 'VALIDATION_ERROR' }
      }
      const graph = this.parseGraph(found.data.graph)
      if (!graph) {
        return { success: false, error: 'A valid graph is required before activation', code: 'VALIDATION_ERROR' }
      }
      const [updated] = await this.db
        .update(pipelines)
        .set({ status: 'active', version: found.data.version + 1, updatedAt: new Date() })
        .where(eq(pipelines.id, pipelineId))
        .returning()
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to activate workflow' }
    }
  }

  async archivePipeline(userId: string, pipelineId: string, event?: H3Event): Promise<ServiceResponse<Pipeline>> {
    try {
      const found = await this.getPipelineWithAccess(pipelineId, userId, event)
      if (!found.success || !found.data) {
        return { success: false, error: 'Pipeline not found', code: 'NOT_FOUND' }
      }
      if (found.data.status === 'archived') {
        return { success: false, error: 'Workflow is already archived', code: 'VALIDATION_ERROR' }
      }
      const [updated] = await this.db
        .update(pipelines)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(eq(pipelines.id, pipelineId))
        .returning()
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to archive workflow' }
    }
  }

  async clonePipeline(userId: string, pipelineId: string, event?: H3Event): Promise<ServiceResponse<Pipeline>> {
    try {
      const found = await this.getPipelineWithAccess(pipelineId, userId, event)
      if (!found.success || !found.data) {
        return { success: false, error: 'Pipeline not found', code: 'NOT_FOUND' }
      }
      const now = new Date()
      const [copy] = await this.db.insert(pipelines).values({
        id: crypto.randomUUID(),
        userId: found.data.userId,
        businessId: found.data.businessId,
        name: `${found.data.name} copy`,
        description: found.data.description,
        steps: found.data.steps,
        graph: found.data.graph,
        version: 1,
        status: 'draft',
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      }).returning()
      return { success: true, data: copy }
    } catch {
      return { success: false, error: 'Failed to clone workflow' }
    }
  }

  private async snapshotAgents(graph: WorkflowGraph): Promise<ServiceResponse<{ agents: Record<string, unknown>, skills: Record<string, unknown> }>> {
    const agents: Record<string, unknown> = {}
    const skills: Record<string, unknown> = {}
    for (const node of graph.nodes) {
      if (node.kind === 'agent' && node.agentId) {
        const resolved = await agentRegistryService.resolveRunSnapshot(node.agentId, node.agentVersion ?? null)
        if (!resolved.success || !resolved.data) {
          return { success: false, error: `Agent snapshot failed for node '${node.id}'`, code: 'VALIDATION_ERROR' }
        }
        agents[node.id] = resolved.data
      }
      if (node.kind === 'skill' && node.skillId) {
        const resolved = await skillRegistryService.resolveSkillVersion(node.skillId, node.skillVersion ?? null)
        if (!resolved.success || !resolved.data) {
          return { success: false, error: `Skill snapshot failed for node '${node.id}'`, code: 'VALIDATION_ERROR' }
        }
        skills[node.id] = resolved.data
      }
    }
    return { success: true, data: { agents, skills } }
  }

  async startGraphRun(
    userId: string,
    pipelineId: string,
    input: Record<string, unknown>,
    event?: H3Event,
  ): Promise<ServiceResponse<PipelineRun>> {
    try {
      const found = await this.getPipelineWithAccess(pipelineId, userId, event)
      if (!found.success || !found.data) {
        return { success: false, error: 'Pipeline not found', code: 'NOT_FOUND' }
      }
      if (found.data.status !== 'active') {
        return { success: false, error: 'Only active workflows can run', code: 'VALIDATION_ERROR' }
      }
      const graph = this.parseGraph(found.data.graph)
      const order = graph ? linearizeGraph(graph)?.map(node => node.id) ?? [] : []
      if (!graph || order.length === 0) {
        return { success: false, error: 'Workflow graph is not runnable', code: 'VALIDATION_ERROR' }
      }
      const snapshots = await this.snapshotAgents(graph)
      if (!snapshots.success || !snapshots.data) {
        return { success: false, error: snapshots.error ?? 'Failed to snapshot agents', code: 'VALIDATION_ERROR' }
      }
      const now = new Date()
      const [run] = await this.db.insert(pipelineRuns).values({
        id: crypto.randomUUID(),
        pipelineId: found.data.id,
        userId: found.data.userId,
        businessId: found.data.businessId,
        status: 'running',
        currentStep: 0,
        input: JSON.stringify(input),
        stepResults: '[]',
        graphSnapshot: JSON.stringify({
          graph,
          order,
          policy: graph.policy,
          workflowVersion: found.data.version,
          agents: snapshots.data.agents,
          skills: snapshots.data.skills,
          snapshottedAt: now.toISOString(),
        }),
        currentNodeId: order[0] ?? null,
        nodeResults: '[]',
        attempts: JSON.stringify([{ attemptId: crypto.randomUUID(), nodeId: order[0] ?? null, at: now.toISOString(), reason: 'run_started' }]),
        approvalState: '{}',
        lastCheckpointAt: now,
        createdAt: now,
        updatedAt: now,
      }).returning()
      return { success: true, data: run }
    } catch {
      return { success: false, error: 'Failed to start workflow run' }
    }
  }

  private readSnapshot(run: PipelineRun): { order: string[], nodes: Map<string, WorkflowNode> } | null {
    try {
      if (!run.graphSnapshot) return null
      const parsed: unknown = JSON.parse(run.graphSnapshot)
      if (!isWorkflowSnapshot(parsed)) return null
      return {
        order: parsed.order,
        nodes: new Map(parsed.graph.nodes.map(node => [node.id, node])),
      }
    } catch {
      return null
    }
  }

  private nextNodeId(order: string[], nodeId: string | null): string | null {
    const index = nodeId ? order.indexOf(nodeId) : -1
    return order[index + 1] ?? null
  }

  async checkpointNodeStart(
    userId: string,
    runId: string,
    attemptId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<{ run: PipelineRun, nodeId: string, attemptId: string }>> {
    try {
      const scope = await this.scopedRunScope(runId, userId, event)
      if (!scope.success || !scope.data) {
        return { success: false, error: 'Pipeline run not found', code: 'NOT_FOUND' }
      }
      const run = scope.data.run
      if (run.status !== 'running' && run.status !== 'changes_requested') {
        return { success: false, error: 'Run is not executable', code: 'VALIDATION_ERROR' }
      }
      const snapshot = this.readSnapshot(run)
      if (!snapshot || !run.currentNodeId) {
        return { success: false, error: 'Run has no graph snapshot', code: 'VALIDATION_ERROR' }
      }
      const now = new Date()
      const results = this.parseNodeResults(run.nodeResults)
      results.push({ nodeId: run.currentNodeId, status: 'started', attemptId, at: now.toISOString() })
      const [updated] = await this.db
        .update(pipelineRuns)
        .set({ nodeResults: JSON.stringify(results), lastCheckpointAt: now, updatedAt: now })
        .where(eq(pipelineRuns.id, run.id))
        .returning()
      return { success: true, data: { run: updated, nodeId: run.currentNodeId, attemptId } }
    } catch {
      return { success: false, error: 'Failed to checkpoint node start' }
    }
  }

  private validateNodeOutput(node: WorkflowNode | undefined, output: unknown): string | null {
    if (!node) return 'Unknown node'
    if (!output || typeof output !== 'object' || Array.isArray(output)) {
      return `Node '${node.id}' output must be an object`
    }
    const kind = (node.config?.outputKind as string | undefined) ?? null
    if (kind && !AGENT_OUTPUT_KINDS.includes(kind)) {
      return `Node '${node.id}' declares an unsupported output kind`
    }
    return null
  }

  async completeNode(
    userId: string,
    runId: string,
    nodeId: string,
    output: unknown,
    event?: H3Event,
  ): Promise<ServiceResponse<PipelineRun>> {
    try {
      const scope = await this.scopedRunScope(runId, userId, event)
      if (!scope.success || !scope.data) {
        return { success: false, error: 'Pipeline run not found', code: 'NOT_FOUND' }
      }
      const run = scope.data.run
      if (run.status !== 'running') {
        return { success: false, error: 'Run is not executable', code: 'VALIDATION_ERROR' }
      }
      const snapshot = this.readSnapshot(run)
      if (!snapshot || run.currentNodeId !== nodeId) {
        return { success: false, error: 'Node is not the current node', code: 'VALIDATION_ERROR' }
      }
      const invalid = this.validateNodeOutput(snapshot.nodes.get(nodeId), output)
      if (invalid) {
        return { success: false, error: invalid, code: 'VALIDATION_ERROR' }
      }
      return await this.advanceAfterNode(scope.data.ownerId, run, snapshot, nodeId, output)
    } catch {
      return { success: false, error: 'Failed to complete node' }
    }
  }

  private async advanceAfterNode(
    ownerId: string,
    run: PipelineRun,
    snapshot: { order: string[], nodes: Map<string, WorkflowNode> },
    nodeId: string,
    output: unknown,
  ): Promise<ServiceResponse<PipelineRun>> {
    const now = new Date()
    const results = this.parseNodeResults(run.nodeResults)
    results.push({ nodeId, status: 'completed', at: now.toISOString(), output })
    const nextId = this.nextNodeId(snapshot.order, nodeId)
    const next = nextId ? snapshot.nodes.get(nextId) : undefined
    const patch = this.advancePatch(nextId ?? null, next?.kind ?? 'terminal', now)
    const [updated] = await this.db
      .update(pipelineRuns)
      .set({ nodeResults: JSON.stringify(results), lastCheckpointAt: now, updatedAt: now, ...patch })
      .where(and(eq(pipelineRuns.id, run.id), eq(pipelineRuns.userId, ownerId)))
      .returning()
    return { success: true, data: updated }
  }

  private advancePatch(nextId: string | null, nextKind: string, now: Date): Partial<PipelineRun> {
    if (!nextId || nextKind === 'terminal') {
      return { currentNodeId: nextId, status: 'completed', completedAt: now }
    }
    if (nextKind === 'human_review') {
      return {
        currentNodeId: nextId,
        status: 'waiting_review',
        approvalState: JSON.stringify({ status: 'pending', nodeId: nextId, at: now.toISOString() }),
      }
    }
    return { currentNodeId: nextId, status: 'running' }
  }

  async approveReview(userId: string, runId: string, event?: H3Event): Promise<ServiceResponse<PipelineRun>> {
    try {
      const scope = await this.scopedRunScope(runId, userId, event)
      if (!scope.success || !scope.data) {
        return { success: false, error: 'Pipeline run not found', code: 'NOT_FOUND' }
      }
      const run = scope.data.run
      if (run.status !== 'waiting_review') {
        return { success: false, error: 'Run is not waiting for review', code: 'VALIDATION_ERROR' }
      }
      const snapshot = this.readSnapshot(run)
      if (!snapshot || !run.currentNodeId) {
        return { success: false, error: 'Run has no graph snapshot', code: 'VALIDATION_ERROR' }
      }
      const now = new Date()
      const approval = { status: 'approved', nodeId: run.currentNodeId, actor: userId, at: now.toISOString() }
      const nextId = this.nextNodeId(snapshot.order, run.currentNodeId)
      const next = nextId ? snapshot.nodes.get(nextId) : undefined
      const patch = this.advancePatch(nextId, next?.kind ?? 'terminal', now)
      const [updated] = await this.db
        .update(pipelineRuns)
        .set({ approvalState: JSON.stringify(approval), updatedAt: now, ...patch })
        .where(and(eq(pipelineRuns.id, run.id), eq(pipelineRuns.userId, scope.data.ownerId)))
        .returning()
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to approve review' }
    }
  }

  async requestChanges(userId: string, runId: string, feedback: string, attemptId: string, event?: H3Event): Promise<ServiceResponse<PipelineRun>> {
    try {
      const scope = await this.scopedRunScope(runId, userId, event)
      if (!scope.success || !scope.data) {
        return { success: false, error: 'Pipeline run not found', code: 'NOT_FOUND' }
      }
      const run = scope.data.run
      if (run.status !== 'waiting_review') {
        return { success: false, error: 'Run is not waiting for review', code: 'VALIDATION_ERROR' }
      }
      const snapshot = this.readSnapshot(run)
      if (!snapshot || !run.currentNodeId) {
        return { success: false, error: 'Run has no graph snapshot', code: 'VALIDATION_ERROR' }
      }
      const target = this.rerunTarget(snapshot, run.currentNodeId)
      const now = new Date()
      const attempts = this.parseJsonArray(run.attempts)
      attempts.push({ attemptId, nodeId: target, at: now.toISOString(), reason: 'changes_requested' })
      const approval = { status: 'changes_requested', nodeId: run.currentNodeId, feedback, actor: userId, at: now.toISOString() }
      const [updated] = await this.db
        .update(pipelineRuns)
        .set({
          currentNodeId: target,
          status: 'changes_requested',
          attempts: JSON.stringify(attempts),
          approvalState: JSON.stringify(approval),
          updatedAt: now,
        })
        .where(and(eq(pipelineRuns.id, run.id), eq(pipelineRuns.userId, scope.data.ownerId)))
        .returning()
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to request changes' }
    }
  }

  private rerunTarget(snapshot: { order: string[], nodes: Map<string, WorkflowNode> }, reviewNodeId: string): string {
    const review = snapshot.nodes.get(reviewNodeId)
    const configured = review?.config?.rerunNodeId
    if (typeof configured === 'string' && snapshot.order.includes(configured)) return configured
    const index = snapshot.order.indexOf(reviewNodeId)
    return snapshot.order[Math.max(index - 1, 0)] ?? reviewNodeId
  }

  async cancelGraphRun(userId: string, runId: string, event?: H3Event): Promise<ServiceResponse<PipelineRun>> {
    try {
      const scope = await this.scopedRunScope(runId, userId, event)
      if (!scope.success || !scope.data) {
        return { success: false, error: 'Pipeline run not found', code: 'NOT_FOUND' }
      }
      const run = scope.data.run
      if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
        return { success: false, error: 'Run already reached a terminal state', code: 'VALIDATION_ERROR' }
      }
      const now = new Date()
      const [updated] = await this.db
        .update(pipelineRuns)
        .set({ status: 'cancelled', completedAt: now, updatedAt: now })
        .where(and(eq(pipelineRuns.id, run.id), eq(pipelineRuns.userId, scope.data.ownerId)))
        .returning()
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to cancel run' }
    }
  }
}

export const pipelineService = new PipelineService()

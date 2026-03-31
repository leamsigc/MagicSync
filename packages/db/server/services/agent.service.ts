import { eq, and, desc } from 'drizzle-orm'
import { type ServiceResponse } from './types'
import { agentSessions, type AgentSession } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'

export interface CreateAgentSessionData {
  id: string
  userId: string
  parentMessageId: string
  threadId?: string
  task: string
  taskType?: string
  maxSteps?: number
  metadata?: Record<string, any>
}

export interface UpdateAgentSessionData {
  status?: 'created' | 'running' | 'completed' | 'failed'
  stepCount?: number
  result?: string
  errorMessage?: string
  metadata?: Record<string, any>
}

export class AgentService {
  private db = useDrizzle()

  async create(data: CreateAgentSessionData): Promise<ServiceResponse<AgentSession>> {
    try {
      const now = new Date()

      const [session] = await this.db.insert(agentSessions).values({
        id: data.id,
        userId: data.userId,
        parentMessageId: data.parentMessageId,
        threadId: data.threadId || null,
        task: data.task,
        status: 'created',
        taskType: data.taskType || null,
        maxSteps: data.maxSteps || 10,
        stepCount: 0,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        createdAt: now,
        updatedAt: now,
      }).returning()

      return { data: session }
    } catch (error) {
      return { error: 'Failed to create agent session' }
    }
  }

  async getById(sessionId: string, userId: string): Promise<ServiceResponse<AgentSession>> {
    try {
      const [session] = await this.db
        .select()
        .from(agentSessions)
        .where(and(eq(agentSessions.id, sessionId), eq(agentSessions.userId, userId)))
        .limit(1)

      if (!session) {
        return { error: 'Agent session not found', code: 'NOT_FOUND' }
      }

      return { data: session }
    } catch (error) {
      return { error: 'Failed to fetch agent session' }
    }
  }

  async listByUser(
    userId: string,
    parentMessageId?: string,
  ): Promise<ServiceResponse<AgentSession[]>> {
    try {
      const conditions = [eq(agentSessions.userId, userId)]

      if (parentMessageId) {
        conditions.push(eq(agentSessions.parentMessageId, parentMessageId))
      }

      const sessions = await this.db
        .select()
        .from(agentSessions)
        .where(and(...conditions))
        .orderBy(desc(agentSessions.createdAt))

      return { data: sessions }
    } catch (error) {
      return { error: 'Failed to fetch agent sessions' }
    }
  }

  async update(
    sessionId: string,
    userId: string,
    data: UpdateAgentSessionData,
  ): Promise<ServiceResponse<AgentSession>> {
    try {
      const updateData: Record<string, any> = {
        updatedAt: new Date(),
      }

      if (data.status !== undefined) updateData.status = data.status
      if (data.stepCount !== undefined) updateData.stepCount = data.stepCount
      if (data.result !== undefined) updateData.result = data.result
      if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage
      if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata)

      const [updated] = await this.db
        .update(agentSessions)
        .set(updateData)
        .where(and(eq(agentSessions.id, sessionId), eq(agentSessions.userId, userId)))
        .returning()

      if (!updated) {
        return { error: 'Agent session not found', code: 'NOT_FOUND' }
      }

      return { data: updated }
    } catch (error) {
      return { error: 'Failed to update agent session' }
    }
  }

  async delete(sessionId: string, userId: string): Promise<ServiceResponse<AgentSession>> {
    try {
      const [deleted] = await this.db
        .delete(agentSessions)
        .where(and(eq(agentSessions.id, sessionId), eq(agentSessions.userId, userId)))
        .returning()

      if (!deleted) {
        return { error: 'Agent session not found', code: 'NOT_FOUND' }
      }

      return { data: deleted }
    } catch (error) {
      return { error: 'Failed to delete agent session' }
    }
  }
}

export const agentService = new AgentService()

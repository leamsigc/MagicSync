import { and, asc, desc, eq, sql } from 'drizzle-orm'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import {
  agentChatEntries,
  agentChatSessions,
  type AgentChatEntry,
  type AgentChatSession,
} from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { businessAccessService } from '#layers/BaseDB/server/services/business-access.service'

export interface CreateAgentChatSessionData {
  businessId: string
  piSessionId: string
  threadId?: string | null
}

export interface AppendEntriesResult {
  lastEntrySeq: number
  appended: number
}

/**
 * Durable pi session persistence (PRD §6 agent_chat_sessions/agent_chat_entries).
 * `seq` is allocated with a single atomic UPDATE so concurrent appends never
 * share a sequence number; the unique index is the backstop.
 */
export class AgentSessionService {
  private db = useDrizzle()

  async createSession(userId: string, data: CreateAgentChatSessionData): Promise<ServiceResponse<AgentChatSession>> {
    try {
      const [row] = await this.db.insert(agentChatSessions).values({
        id: crypto.randomUUID(),
        businessId: data.businessId,
        ownerUserId: userId,
        piSessionId: data.piSessionId,
        threadId: data.threadId ?? null,
      }).returning()
      return { success: true, data: row }
    } catch {
      return { success: false, error: 'Failed to create agent chat session' }
    }
  }

  /** Session is readable by its creator or any member of its business. */
  private async canAccess(userId: string, session: AgentChatSession): Promise<boolean> {
    if (session.ownerUserId === userId) return true
    return businessAccessService.isMember(userId, session.businessId)
  }

  async getSession(userId: string, sessionId: string): Promise<ServiceResponse<AgentChatSession>> {
    try {
      const [row] = await this.db
        .select()
        .from(agentChatSessions)
        .where(eq(agentChatSessions.id, sessionId))
        .limit(1)
      if (!row) return { success: false, error: 'Agent chat session not found', code: 'NOT_FOUND' }
      if (!(await this.canAccess(userId, row))) {
        return { success: false, error: 'Agent chat session not found', code: 'NOT_FOUND' }
      }
      return { success: true, data: row }
    } catch {
      return { success: false, error: 'Failed to load agent chat session' }
    }
  }

  async getByThread(userId: string, threadId: string): Promise<ServiceResponse<AgentChatSession | null>> {
    try {
      const [row] = await this.db
        .select()
        .from(agentChatSessions)
        .where(eq(agentChatSessions.threadId, threadId))
        .orderBy(desc(agentChatSessions.updatedAt))
        .limit(1)
      if (!row) return { success: true, data: null }
      if (!(await this.canAccess(userId, row))) {
        return { success: true, data: null }
      }
      return { success: true, data: row }
    } catch {
      return { success: false, error: 'Failed to load agent chat session for thread' }
    }
  }

  async listSessions(
    userId: string,
    businessId?: string | null,
    limit = 50,
  ): Promise<ServiceResponse<AgentChatSession[]>> {
    try {
      // A business's chat history is shared by its members; without a business
      // the list stays personal.
      const scope = businessId
        ? eq(agentChatSessions.businessId, businessId)
        : eq(agentChatSessions.ownerUserId, userId)
      const rows = await this.db
        .select()
        .from(agentChatSessions)
        .where(scope)
        .orderBy(desc(agentChatSessions.updatedAt))
        .limit(limit)
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to list agent chat sessions' }
    }
  }

  async linkThread(userId: string, sessionId: string, threadId: string): Promise<ServiceResponse<AgentChatSession>> {
    return this.updateOwnedSession(userId, sessionId, { threadId })
  }

  async appendEntries(
    userId: string,
    sessionId: string,
    entries: unknown[],
  ): Promise<ServiceResponse<AppendEntriesResult>> {
    try {
      const existing = await this.getSession(userId, sessionId)
      if (!existing.success) {
        return { success: false, error: existing.error, code: existing.code }
      }

      const count = entries.length
      const [session] = await this.db
        .update(agentChatSessions)
        .set({
          lastEntrySeq: sql`${agentChatSessions.lastEntrySeq} + ${count}`,
          updatedAt: new Date(),
        })
        .where(eq(agentChatSessions.id, sessionId))
        .returning()
      if (!session) return { success: false, error: 'Agent chat session not found', code: 'NOT_FOUND' }

      if (count > 0) {
        const firstSeq = session.lastEntrySeq - count + 1
        await this.db.insert(agentChatEntries).values(entries.map((entry, index) => ({
          id: crypto.randomUUID(),
          sessionId,
          seq: firstSeq + index,
          entry,
        })))
      }
      return { success: true, data: { lastEntrySeq: session.lastEntrySeq, appended: count } }
    } catch {
      return { success: false, error: 'Failed to append agent chat entries' }
    }
  }

  async loadEntries(userId: string, sessionId: string): Promise<ServiceResponse<AgentChatEntry[]>> {
    try {
      const session = await this.getSession(userId, sessionId)
      if (!session.success) return { success: false, error: session.error, code: session.code }

      const rows = await this.db
        .select()
        .from(agentChatEntries)
        .where(eq(agentChatEntries.sessionId, sessionId))
        .orderBy(asc(agentChatEntries.seq))
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to load agent chat entries' }
    }
  }

  private async updateOwnedSession(
    userId: string,
    sessionId: string,
    patch: { threadId?: string },
  ): Promise<ServiceResponse<AgentChatSession>> {
    try {
      const existing = await this.getSession(userId, sessionId)
      if (!existing.success) return existing

      const [row] = await this.db
        .update(agentChatSessions)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(agentChatSessions.id, sessionId))
        .returning()
      if (!row) return { success: false, error: 'Agent chat session not found', code: 'NOT_FOUND' }
      return { success: true, data: row }
    } catch {
      return { success: false, error: 'Failed to update agent chat session' }
    }
  }
}

export const agentSessionService = new AgentSessionService()

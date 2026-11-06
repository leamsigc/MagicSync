import { eq, and, desc, asc, inArray, isNotNull, or } from 'drizzle-orm'
import { type ServiceResponse } from './types'
import type { ChatServiceType } from './interfaces'
import { chatThreads, chatMessages, agentChatSessions, type ChatThread, type ChatMessage } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { businessAccessService } from './business-access.service'

export interface CreateThreadData {
  title: string
  businessId?: string
}

export interface CreateMessageData {
  threadId: string
  userId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: Record<string, any>
}

export interface MessagePaginationOptions {
  limit?: number
  before?: string
  after?: string
}

export class ChatService implements ChatServiceType {
  private db = useDrizzle()

  // --- Threads ---

  async createThread(userId: string, data: CreateThreadData): Promise<ServiceResponse<ChatThread>> {
    try {
      const id = crypto.randomUUID()
      const now = new Date()

      const [thread] = await this.db.insert(chatThreads).values({
        id,
        userId,
        businessId: data.businessId ?? null,
        title: data.title,
        lastMessageAt: now,
        createdAt: now,
      }).returning()

      return { success: true, data: thread }
    } catch (error) {
      return { success: false, error: 'Failed to create thread' }
    }
  }

  async getThreads(userId: string): Promise<ServiceResponse<ChatThread[]>> {
    try {
      const threads = await this.db
        .select()
        .from(chatThreads)
        .where(eq(chatThreads.userId, userId))
        .orderBy(desc(chatThreads.lastMessageAt))

      return { success: true, data: threads }
    } catch (error) {
      return { success: false, error: 'Failed to fetch threads' }
    }
  }

  async getThreadsByBusiness(userId: string, businessId: string): Promise<ServiceResponse<ChatThread[]>> {
    try {
      const links = await this.db
        .select({ threadId: agentChatSessions.threadId })
        .from(agentChatSessions)
        .where(and(
          eq(agentChatSessions.businessId, businessId),
          isNotNull(agentChatSessions.threadId),
        ))
      const legacyThreadIds = links
        .map(link => link.threadId)
        .filter((id): id is string => Boolean(id))

      const scope = legacyThreadIds.length > 0
        ? or(eq(chatThreads.businessId, businessId), inArray(chatThreads.id, legacyThreadIds))!
        : eq(chatThreads.businessId, businessId)

      const threads = await this.db
        .select()
        .from(chatThreads)
        .where(scope)
        .orderBy(desc(chatThreads.lastMessageAt))

      return { success: true, data: threads }
    } catch (error) {
      return { success: false, error: 'Failed to fetch threads for business' }
    }
  }

  async getThread(threadId: string, userId: string): Promise<ServiceResponse<ChatThread>> {
    try {
      const [thread] = await this.db
        .select()
        .from(chatThreads)
        .where(eq(chatThreads.id, threadId))
        .limit(1)

      if (!thread) {
        return { success: false, error: 'Thread not found', code: 'NOT_FOUND' }
      }

      const allowed = thread.userId === userId
        || (!!thread.businessId && await businessAccessService.isMember(userId, thread.businessId))
      if (!allowed) {
        return { success: false, error: 'Thread not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: thread }
    } catch (error) {
      return { success: false, error: 'Failed to fetch thread' }
    }
  }

  async deleteThread(threadId: string, userId: string): Promise<ServiceResponse<ChatThread>> {
    try {
      const [thread] = await this.db
        .select()
        .from(chatThreads)
        .where(eq(chatThreads.id, threadId))
        .limit(1)

      if (!thread) {
        return { success: false, error: 'Thread not found', code: 'NOT_FOUND' }
      }

      const allowed = thread.userId === userId
        || (!!thread.businessId && await businessAccessService.isMember(userId, thread.businessId))
      if (!allowed) {
        return { success: false, error: 'Thread not found', code: 'NOT_FOUND' }
      }

      const [deleted] = await this.db
        .delete(chatThreads)
        .where(eq(chatThreads.id, threadId))
        .returning()

      if (!deleted) {
        return { success: false, error: 'Thread not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: deleted }
    } catch (error) {
      return { success: false, error: 'Failed to delete thread' }
    }
  }

  async updateThreadTitle(threadId: string, userId: string, title: string): Promise<ServiceResponse<ChatThread>> {
    try {
      const access = await this.getThread(threadId, userId)
      if (!access.success) return access

      const [updated] = await this.db
        .update(chatThreads)
        .set({ title })
        .where(eq(chatThreads.id, threadId))
        .returning()

      if (!updated) {
        return { success: false, error: 'Thread not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: updated }
    } catch (error) {
      return { success: false, error: 'Failed to update thread title' }
    }
  }

  // --- Messages ---

  async addMessage(data: CreateMessageData): Promise<ServiceResponse<ChatMessage>> {
    try {
      const access = await this.getThread(data.threadId, data.userId)
      if (!access.success) return access

      const id = crypto.randomUUID()
      const now = new Date()

      const [msg] = await this.db.insert(chatMessages).values({
        id,
        threadId: data.threadId,
        userId: data.userId,
        role: data.role,
        content: data.content,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        createdAt: now,
      }).returning()

      // Update thread lastMessageAt
      await this.db
        .update(chatThreads)
        .set({ lastMessageAt: now })
        .where(eq(chatThreads.id, data.threadId))

      return { success: true, data: msg }
    } catch (error) {
      return { success: false, error: 'Failed to add message' }
    }
  }

  async getMessages(
    threadId: string,
    userId: string,
    options: MessagePaginationOptions = {}
  ): Promise<ServiceResponse<ChatMessage[]>> {
    try {
      const access = await this.getThread(threadId, userId)
      if (!access.success) return access

      const { limit = 50, before, after } = options

      const conditions = [
        eq(chatMessages.threadId, threadId),
      ]

      let query = this.db
        .select()
        .from(chatMessages)
        .where(and(...conditions))
        .orderBy(asc(chatMessages.createdAt))
        .limit(limit + 1) // Fetch one extra to determine if there are more

      const messages = await query

      return { success: true, data: messages.slice(0, limit) }
    } catch (error) {
      return { success: false, error: 'Failed to fetch messages' }
    }
  }
}

export const chatService = new ChatService()

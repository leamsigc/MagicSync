import { eq, and, desc, asc, sql } from 'drizzle-orm'
import { type ServiceResponse } from './types'
import type { ChatServiceType } from './interfaces'
import { chatThreads, chatMessages, type ChatThread, type ChatMessage } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'

export interface CreateThreadData {
  title: string
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

  async getThread(threadId: string, userId: string): Promise<ServiceResponse<ChatThread>> {
    try {
      const [thread] = await this.db
        .select()
        .from(chatThreads)
        .where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)))
        .limit(1)

      if (!thread) {
        return { success: false, error: 'Thread not found', code: 'NOT_FOUND' }
      }

      return { success: true, data: thread }
    } catch (error) {
      return { success: false, error: 'Failed to fetch thread' }
    }
  }

  async deleteThread(threadId: string, userId: string): Promise<ServiceResponse<ChatThread>> {
    try {
      const [deleted] = await this.db
        .delete(chatThreads)
        .where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)))
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
      const [updated] = await this.db
        .update(chatThreads)
        .set({ title })
        .where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)))
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
      const { limit = 50, before, after } = options

      const conditions = [
        eq(chatMessages.threadId, threadId),
        eq(chatMessages.userId, userId),
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

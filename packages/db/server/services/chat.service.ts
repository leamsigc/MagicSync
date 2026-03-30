import { eq, and, desc, sql } from 'drizzle-orm'
import { type ServiceResponse } from './types'
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

export class ChatService {
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

      return { data: thread }
    } catch (error) {
      return { error: 'Failed to create thread' }
    }
  }

  async getThreads(userId: string): Promise<ServiceResponse<ChatThread[]>> {
    try {
      const threads = await this.db
        .select()
        .from(chatThreads)
        .where(eq(chatThreads.userId, userId))
        .orderBy(desc(chatThreads.lastMessageAt))

      return { data: threads }
    } catch (error) {
      return { error: 'Failed to fetch threads' }
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
        return { error: 'Thread not found', code: 'NOT_FOUND' }
      }

      return { data: thread }
    } catch (error) {
      return { error: 'Failed to fetch thread' }
    }
  }

  async deleteThread(threadId: string, userId: string): Promise<ServiceResponse<ChatThread>> {
    try {
      const [deleted] = await this.db
        .delete(chatThreads)
        .where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)))
        .returning()

      if (!deleted) {
        return { error: 'Thread not found', code: 'NOT_FOUND' }
      }

      return { data: deleted }
    } catch (error) {
      return { error: 'Failed to delete thread' }
    }
  }

  async updateThreadTitle(threadId: string, userId: string, title: string): Promise<void> {
    await this.db
      .update(chatThreads)
      .set({ title })
      .where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)))
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

      return { data: msg }
    } catch (error) {
      return { error: 'Failed to add message' }
    }
  }

  async getMessages(threadId: string, userId: string): Promise<ServiceResponse<ChatMessage[]>> {
    try {
      const messages = await this.db
        .select()
        .from(chatMessages)
        .where(and(
          eq(chatMessages.threadId, threadId),
          eq(chatMessages.userId, userId)
        ))
        .orderBy(sql`${chatMessages.createdAt} ASC`)

      return { data: messages }
    } catch (error) {
      return { error: 'Failed to fetch messages' }
    }
  }
}

export const chatService = new ChatService()

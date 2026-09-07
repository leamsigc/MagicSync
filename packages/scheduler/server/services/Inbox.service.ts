import { and, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { inboxItems, type InboxItem, type NewInboxItem } from '#layers/BaseDB/db/inbox/inbox'
import { posts } from '#layers/BaseDB/db/posts/posts'
import { socialMediaAccounts } from '#layers/BaseDB/db/socialMedia/socialMedia'

export interface InboxFilters {
  userId: string
  platform?: string
  type?: 'comment' | 'dm' | 'notification'
  postId?: string
  read?: boolean
  archived?: boolean
  limit?: number
  cursor?: string
}

export interface InboxResult {
  items: InboxItem[]
  unreadCount: number
  nextCursor?: string
}

export class InboxService {
  private db = useDrizzle()

  async getUnifiedInbox(filters: InboxFilters): Promise<InboxResult> {
    const { userId, platform, type, postId, read, archived, limit = 25, cursor } = filters

    const conditions = [eq(inboxItems.userId, userId)]
    if (platform) conditions.push(eq(inboxItems.platform, platform))
    if (type) conditions.push(eq(inboxItems.type, type))
    if (postId) conditions.push(eq(inboxItems.postId, postId))
    if (read !== undefined) conditions.push(eq(inboxItems.read, read))
    if (archived !== undefined) conditions.push(eq(inboxItems.archived, archived))
    if (cursor) {
      const cursorItem = await this.db.query.inboxItems.findFirst({
        where: eq(inboxItems.id, cursor),
      })
      if (cursorItem) {
        conditions.push(sql`${inboxItems.createdAt} < ${cursorItem.createdAt}`)
      }
    }

    const items = await this.db.query.inboxItems.findMany({
      where: and(...conditions),
      orderBy: desc(inboxItems.createdAt),
      limit: limit + 1,
      with: {
        post: true,
        socialMediaAccount: true,
      },
    })

    const hasMore = items.length > limit
    const resultItems = hasMore ? items.slice(0, limit) : items
    const nextCursor = hasMore ? resultItems[resultItems.length - 1]?.id : undefined

    const unreadCount = await this.getUnreadCount(userId)

    return { items: resultItems, unreadCount, nextCursor }
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(inboxItems)
      .where(and(eq(inboxItems.userId, userId), eq(inboxItems.read, false)))
    return result[0]?.count ?? 0
  }

  async markAsRead(userId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0
    const result = await this.db
      .update(inboxItems)
      .set({ read: true })
      .where(and(eq(inboxItems.userId, userId), inArray(inboxItems.id, ids)))
      .returning({ id: inboxItems.id })
    return result.length
  }

  async markAllAsRead(userId: string, filters?: { platform?: string; type?: string }): Promise<number> {
    const conditions = [eq(inboxItems.userId, userId), eq(inboxItems.read, false)]
    if (filters?.platform) conditions.push(eq(inboxItems.platform, filters.platform))
    if (filters?.type) conditions.push(eq(inboxItems.type, filters.type))
    const result = await this.db
      .update(inboxItems)
      .set({ read: true })
      .where(and(...conditions))
      .returning({ id: inboxItems.id })
    return result.length
  }

  async archiveItems(userId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0
    const result = await this.db
      .update(inboxItems)
      .set({ archived: true })
      .where(and(eq(inboxItems.userId, userId), inArray(inboxItems.id, ids)))
      .returning({ id: inboxItems.id })
    return result.length
  }

  async createItem(data: NewInboxItem): Promise<InboxItem> {
    const item: NewInboxItem = {
      ...data,
      id: data.id ?? randomUUID(),
      read: data.read ?? false,
      archived: data.archived ?? false,
    }
    const [created] = await this.db.insert(inboxItems).values(item).returning()
    return created
  }

  async getItemById(id: string, userId: string): Promise<InboxItem | undefined> {
    return this.db.query.inboxItems.findFirst({
      where: and(eq(inboxItems.id, id), eq(inboxItems.userId, userId)),
      with: { post: true, socialMediaAccount: true },
    })
  }

  async deleteItem(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(inboxItems)
      .where(and(eq(inboxItems.id, id), eq(inboxItems.userId, userId)))
      .returning({ id: inboxItems.id })
    return result.length > 0
  }

  async getPlatformsForUser(userId: string): Promise<string[]> {
    const result = await this.db
      .select({ platform: inboxItems.platform })
      .from(inboxItems)
      .where(eq(inboxItems.userId, userId))
      .groupBy(inboxItems.platform)
    return result.map((r) => r.platform)
  }
}

export const inboxService = new InboxService()

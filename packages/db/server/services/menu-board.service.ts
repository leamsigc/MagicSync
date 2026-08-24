import { and, like, eq } from 'drizzle-orm'
import { entityDetails } from '#layers/BaseDB/db/entityDetails/entityDetails'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import type { ServiceResponse } from './types'

export interface MenuBoardPage {
  id: string
  name: string
  type: 'html' | 'image'
  content: string
  isActive: boolean
  order: number
}

export interface MenuBoardSettings {
  transitionTime: number
  isLocked: boolean
  unlockPin: string
}

export interface MenuBoardData {
  name: string
  pages: MenuBoardPage[]
  settings: MenuBoardSettings
}

interface MenuBoardDetailsRow {
  entityId: string
  details: unknown
  updatedAt: Date | null
}

const BOARD_TYPE = 'menu_board'
const PUBLIC_TYPE = 'menu_board_public'

/** entityId format for owned boards: `<userId>::<boardId>` */
const ownedEntityId = (userId: string, boardId: string) => `${userId}::${boardId}`

function toBoard(row: MenuBoardDetailsRow): { id: string; name: string; pages: MenuBoardPage[]; settings: MenuBoardSettings; isPublic?: boolean; shareSlug?: string; updatedAt?: string } | null {
  const details = row.details as Partial<MenuBoardData> | null
  if (!details || typeof details !== 'object') return null
  const boardId = row.entityId.split('::')[1] ?? row.entityId
  const rawPages = Array.isArray(details.pages) ? details.pages : []
  return {
    id: boardId,
    name: typeof details.name === 'string' ? details.name : 'Untitled Board',
    pages: rawPages as MenuBoardPage[],
    settings: {
      transitionTime: Number(details.settings?.transitionTime) > 0 ? Number(details.settings?.transitionTime) : 10,
      isLocked: false,
      unlockPin: typeof details.settings?.unlockPin === 'string' ? details.settings.unlockPin : '0000',
    },
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
  }
}

export class MenuBoardService {
  private db = useDrizzle()

  async listForUser(userId: string): Promise<ServiceResponse<Array<ReturnType<typeof toBoard>>>> {
    try {
      const rows = await this.db
        .select()
        .from(entityDetails)
        .where(and(
          eq(entityDetails.entityType, BOARD_TYPE),
          like(entityDetails.entityId, `${userId}::%`)
        ))

      const boards = rows
        .map(row => toBoard(row))
        .filter((b): b is NonNullable<ReturnType<typeof toBoard>> => b !== null)
        .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))

      return { success: true, data: boards }
    } catch (error) {
      console.error('menuBoardService.listForUser failed:', error)
      return { success: false, error: 'Failed to list menu boards' }
    }
  }

  async getForUser(userId: string, boardId: string): Promise<ServiceResponse<NonNullable<ReturnType<typeof toBoard>>>> {
    try {
      const [row] = await this.db
        .select()
        .from(entityDetails)
        .where(and(
          eq(entityDetails.entityType, BOARD_TYPE),
          eq(entityDetails.entityId, ownedEntityId(userId, boardId))
        ))

      if (!row) {
        return { success: false, error: 'Menu board not found', code: 'NOT_FOUND' }
      }

      const board = toBoard(row)
      if (!board) {
        return { success: false, error: 'Menu board data is corrupted', code: 'CORRUPTED' }
      }

      const [publicRow] = await this.db
        .select({ id: entityDetails.id })
        .from(entityDetails)
        .where(and(eq(entityDetails.entityType, PUBLIC_TYPE), eq(entityDetails.entityId, boardId)))

      return { success: true, data: { ...board, isPublic: !!publicRow, shareSlug: publicRow ? board.id : undefined } }
    } catch (error) {
      console.error('menuBoardService.getForUser failed:', error)
      return { success: false, error: 'Failed to load menu board' }
    }
  }

  async upsert(userId: string, boardId: string, data: MenuBoardData): Promise<ServiceResponse<NonNullable<ReturnType<typeof toBoard>>>> {
    try {
      const entityId = ownedEntityId(userId, boardId)
      const existing = await this.db
        .select({ id: entityDetails.id })
        .from(entityDetails)
        .where(and(eq(entityDetails.entityType, BOARD_TYPE), eq(entityDetails.entityId, entityId)))
        .limit(1)

      const details = JSON.parse(JSON.stringify({ name: data.name, pages: data.pages, settings: data.settings }))

      if (existing.length > 0) {
        await this.db
          .update(entityDetails)
          .set({ details, updatedAt: new Date() })
          .where(eq(entityDetails.id, existing[0].id))
      } else {
        await this.db.insert(entityDetails).values({
          id: crypto.randomUUID(),
          entityId,
          entityType: BOARD_TYPE,
          details,
        })
      }

      const result = await this.getForUser(userId, boardId)
      if (result.error || !result.data) {
        return { success: false, error: result.error ?? 'Failed to save menu board' }
      }
      return { success: true, data: result.data }
    } catch (error) {
      console.error('menuBoardService.upsert failed:', error)
      return { success: false, error: 'Failed to save menu board' }
    }
  }

  async remove(userId: string, boardId: string): Promise<ServiceResponse<true>> {
    try {
      const entityId = ownedEntityId(userId, boardId)
      await this.db
        .delete(entityDetails)
        .where(and(eq(entityDetails.entityType, BOARD_TYPE), eq(entityDetails.entityId, entityId)))
      // Also remove any public snapshot of this board
      await this.db
        .delete(entityDetails)
        .where(and(eq(entityDetails.entityType, PUBLIC_TYPE), eq(entityDetails.entityId, boardId)))
      return { success: true, data: true }
    } catch (error) {
      console.error('menuBoardService.remove failed:', error)
      return { success: false, error: 'Failed to delete menu board' }
    }
  }

  /** Publish a public snapshot of the board. Returns the share slug. */
  async publish(userId: string, boardId: string): Promise<ServiceResponse<{ slug: string }>> {
    try {
      const owned = await this.getForUser(userId, boardId)
      if (owned.error || !owned.data) {
        return { success: false, error: owned.error ?? 'Menu board not found', code: owned.code ?? 'NOT_FOUND' }
      }

      const details = JSON.parse(JSON.stringify({
        name: owned.data.name,
        pages: owned.data.pages.filter(p => p.isActive).sort((a, b) => a.order - b.order),
        settings: owned.data.settings,
      }))

      const existing = await this.db
        .select({ id: entityDetails.id })
        .from(entityDetails)
        .where(and(eq(entityDetails.entityType, PUBLIC_TYPE), eq(entityDetails.entityId, boardId)))
        .limit(1)

      if (existing.length > 0) {
        await this.db
          .update(entityDetails)
          .set({ details, updatedAt: new Date() })
          .where(eq(entityDetails.id, existing[0].id))
      } else {
        await this.db.insert(entityDetails).values({
          id: crypto.randomUUID(),
          entityId: boardId,
          entityType: PUBLIC_TYPE,
          details,
        })
      }

      return { success: true, data: { slug: boardId } }
    } catch (error) {
      console.error('menuBoardService.publish failed:', error)
      return { success: false, error: 'Failed to publish menu board' }
    }
  }

  async unpublish(userId: string, boardId: string): Promise<ServiceResponse<true>> {
    try {
      const owned = await this.getForUser(userId, boardId)
      if (owned.error || !owned.data) {
        return { success: false, error: owned.error ?? 'Menu board not found', code: 'NOT_FOUND' }
      }
      await this.db
        .delete(entityDetails)
        .where(and(eq(entityDetails.entityType, PUBLIC_TYPE), eq(entityDetails.entityId, boardId)))
      return { success: true, data: true }
    } catch (error) {
      console.error('menuBoardService.unpublish failed:', error)
      return { success: false, error: 'Failed to unpublish menu board' }
    }
  }

  async getPublic(slug: string): Promise<ServiceResponse<{ name: string; pages: MenuBoardPage[]; settings: MenuBoardSettings }>> {
    try {
      const [row] = await this.db
        .select()
        .from(entityDetails)
        .where(and(eq(entityDetails.entityType, PUBLIC_TYPE), eq(entityDetails.entityId, slug)))
        .limit(1)

      if (!row) {
        return { success: false, error: 'Shared menu not found', code: 'NOT_FOUND' }
      }

      const details = row.details as Partial<MenuBoardData> | null
      if (!details || !Array.isArray(details.pages)) {
        return { success: false, error: 'Shared menu data is corrupted', code: 'CORRUPTED' }
      }

      return {
        success: true,
        data: {
          name: typeof details.name === 'string' ? details.name : 'Menu',
          pages: details.pages as MenuBoardPage[],
          settings: {
            transitionTime: Number(details.settings?.transitionTime) > 0 ? Number(details.settings?.transitionTime) : 10,
            isLocked: false,
            unlockPin: '',
          },
        },
      }
    } catch (error) {
      console.error('menuBoardService.getPublic failed:', error)
      return { success: false, error: 'Failed to load shared menu' }
    }
  }
}

export const menuBoardService = new MenuBoardService()

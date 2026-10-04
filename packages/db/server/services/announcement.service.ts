import { and, eq } from 'drizzle-orm'
import { entityDetails } from '#layers/BaseDB/db/entityDetails/entityDetails'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import type { ServiceResponse } from './types'

export interface AnnouncementInput {
  title: string
  html: string
  publishAt: string
  expiresAt: string | null
}

export interface Announcement extends AnnouncementInput {
  id: string
  createdBy: string
  createdAt: string
}

interface AnnouncementRow {
  entityId: string
  details: unknown
  updatedAt: Date | null
}

const ANNOUNCEMENT_TYPE = 'platform_announcement'
// Global (unowned) rows: no user prefix, readable for every logged-in user.
// Volume is tiny (a handful of banners), so a full-type scan is fine.
const entityIdFor = (id: string) => `global::${id}`

function extractId(entityId: string): string {
  return entityId.split('::')[1] ?? entityId
}

function parseAnnouncement(row: AnnouncementRow): Announcement | null {
  const details = row.details as Partial<Announcement> | null
  if (!details || typeof details !== 'object') return null
  if (typeof details.title !== 'string' || typeof details.html !== 'string') return null
  return {
    id: extractId(row.entityId),
    title: details.title,
    html: details.html,
    publishAt: typeof details.publishAt === 'string' ? details.publishAt : new Date(0).toISOString(),
    expiresAt: typeof details.expiresAt === 'string' || details.expiresAt === null ? details.expiresAt : null,
    createdBy: typeof details.createdBy === 'string' ? details.createdBy : 'unknown',
    createdAt: typeof details.createdAt === 'string' ? details.createdAt : new Date(0).toISOString(),
  }
}

function isActive(announcement: Announcement, now: number): boolean {
  const publishTime = Date.parse(announcement.publishAt)
  if (Number.isNaN(publishTime)) return false
  if (publishTime > now) return false
  if (announcement.expiresAt === null) return true
  const expiryTime = Date.parse(announcement.expiresAt)
  return !Number.isNaN(expiryTime) && expiryTime > now
}

function sortNewestFirst(a: Announcement, b: Announcement): number {
  return b.publishAt.localeCompare(a.publishAt)
}

export class AnnouncementService {
  private db = useDrizzle()

  async listAll(): Promise<ServiceResponse<Announcement[]>> {
    try {
      const rows = await this.db
        .select()
        .from(entityDetails)
        .where(eq(entityDetails.entityType, ANNOUNCEMENT_TYPE))

      const announcements = rows
        .map(parseAnnouncement)
        .filter((a): a is Announcement => a !== null)
        .sort(sortNewestFirst)

      return { success: true, data: announcements }
    } catch (error) {
      log.error({ message: 'announcementService.listAll failed', error: String(error) })
      return { success: false, error: 'Failed to list announcements' }
    }
  }

  async getActive(): Promise<ServiceResponse<Announcement | null>> {
    try {
      const rows = await this.db
        .select()
        .from(entityDetails)
        .where(eq(entityDetails.entityType, ANNOUNCEMENT_TYPE))

      const now = Date.now()
      const active = rows
        .map(parseAnnouncement)
        .filter((a): a is Announcement => a !== null && isActive(a, now))
        .sort(sortNewestFirst)

      return { success: true, data: active[0] ?? null }
    } catch (error) {
      log.error({ message: 'announcementService.getActive failed', error: String(error) })
      return { success: false, error: 'Failed to load announcement' }
    }
  }

  async upsert(adminId: string, id: string | null, input: AnnouncementInput): Promise<ServiceResponse<Announcement>> {
    try {
      const announcementId = id ?? crypto.randomUUID()
      const entityId = entityIdFor(announcementId)
      const [existing] = await this.db
        .select()
        .from(entityDetails)
        .where(and(eq(entityDetails.entityType, ANNOUNCEMENT_TYPE), eq(entityDetails.entityId, entityId)))
        .limit(1)

      const prior = existing ? parseAnnouncement(existing) : null
      const details = JSON.parse(JSON.stringify({
        title: input.title,
        html: input.html,
        publishAt: input.publishAt,
        expiresAt: input.expiresAt,
        createdBy: prior?.createdBy ?? adminId,
        createdAt: prior?.createdAt ?? new Date().toISOString(),
      }))

      if (existing) {
        await this.db
          .update(entityDetails)
          .set({ details, updatedAt: new Date() })
          .where(eq(entityDetails.id, existing.id))
      } else {
        await this.db.insert(entityDetails).values({
          id: crypto.randomUUID(),
          entityId,
          entityType: ANNOUNCEMENT_TYPE,
          details,
        })
      }

      const saved = await this.getById(announcementId)
      if (saved.error || !saved.data) {
        return { success: false, error: saved.error ?? 'Failed to save announcement' }
      }
      return { success: true, data: saved.data }
    } catch (error) {
      log.error({ message: 'announcementService.upsert failed', error: String(error) })
      return { success: false, error: 'Failed to save announcement' }
    }
  }

  async remove(id: string): Promise<ServiceResponse<true>> {
    try {
      await this.db
        .delete(entityDetails)
        .where(and(eq(entityDetails.entityType, ANNOUNCEMENT_TYPE), eq(entityDetails.entityId, entityIdFor(id))))
      return { success: true, data: true }
    } catch (error) {
      log.error({ message: 'announcementService.remove failed', error: String(error) })
      return { success: false, error: 'Failed to delete announcement' }
    }
  }

  private async getById(id: string): Promise<ServiceResponse<Announcement>> {
    try {
      const [row] = await this.db
        .select()
        .from(entityDetails)
        .where(and(eq(entityDetails.entityType, ANNOUNCEMENT_TYPE), eq(entityDetails.entityId, entityIdFor(id))))
        .limit(1)

      if (!row) return { success: false, error: 'Announcement not found' }
      const announcement = parseAnnouncement(row)
      if (!announcement) return { success: false, error: 'Announcement data is corrupted' }
      return { success: true, data: announcement }
    } catch (error) {
      log.error({ message: 'announcementService.getById failed', error: String(error) })
      return { success: false, error: 'Failed to load announcement' }
    }
  }
}

export const announcementService = new AnnouncementService()

import { and, eq, like } from 'drizzle-orm'
import { entityDetails } from '#layers/BaseDB/db/entityDetails/entityDetails'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import type { ServiceResponse } from './types'

export const FEEDBACK_CATEGORIES = ['bug', 'feature', 'praise', 'other'] as const
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]

export const FEEDBACK_STATUSES = ['new', 'reviewed', 'resolved'] as const
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]

export interface FeedbackInput {
  category: FeedbackCategory
  message: string
}

export interface Feedback extends FeedbackInput {
  id: string
  userId: string
  userName: string | null
  status: FeedbackStatus
  adminNote: string | null
  createdAt: string
}

interface FeedbackRow {
  entityId: string
  details: unknown
}

const FEEDBACK_TYPE = 'user_feedback'
// Owned rows: ownership = entityId prefix check. Admin reads scan the whole
// type (fine at v1 volumes — revisit past ~10k rows).
const entityIdFor = (userId: string, feedbackId: string) => `${userId}::${feedbackId}`

function splitEntityId(entityId: string): { userId: string; id: string } {
  const separator = entityId.indexOf('::')
  if (separator === -1) return { userId: 'unknown', id: entityId }
  return { userId: entityId.slice(0, separator), id: entityId.slice(separator + 2) }
}

function parseFeedback(row: FeedbackRow): Feedback | null {
  const details = row.details as Partial<Feedback> | null
  if (!details || typeof details !== 'object') return null
  if (typeof details.message !== 'string' || typeof details.category !== 'string') return null
  const { userId, id } = splitEntityId(row.entityId)
  return {
    id,
    userId,
    userName: typeof details.userName === 'string' ? details.userName : null,
    category: (FEEDBACK_CATEGORIES as readonly string[]).includes(details.category)
      ? (details.category as FeedbackCategory)
      : 'other',
    message: details.message,
    status: (FEEDBACK_STATUSES as readonly string[]).includes(details.status ?? '')
      ? (details.status as FeedbackStatus)
      : 'new',
    adminNote: typeof details.adminNote === 'string' ? details.adminNote : null,
    createdAt: typeof details.createdAt === 'string' ? details.createdAt : new Date(0).toISOString(),
  }
}

function sortNewestFirst(a: Feedback, b: Feedback): number {
  return b.createdAt.localeCompare(a.createdAt)
}

export class FeedbackService {
  private db = useDrizzle()

  async create(userId: string, userName: string | null, input: FeedbackInput): Promise<ServiceResponse<Feedback>> {
    try {
      const feedbackId = crypto.randomUUID()
      const details = JSON.parse(JSON.stringify({
        category: input.category,
        message: input.message,
        userName,
        status: 'new',
        adminNote: null,
        createdAt: new Date().toISOString(),
      }))

      await this.db.insert(entityDetails).values({
        id: crypto.randomUUID(),
        entityId: entityIdFor(userId, feedbackId),
        entityType: FEEDBACK_TYPE,
        details,
      })

      const saved = await this.getById(feedbackId)
      if (saved.error || !saved.data) {
        return { success: false, error: saved.error ?? 'Failed to save feedback' }
      }
      return { success: true, data: saved.data }
    } catch (error) {
      log.error({ message: 'feedbackService.create failed', error: String(error) })
      return { success: false, error: 'Failed to save feedback' }
    }
  }

  async listAll(): Promise<ServiceResponse<Feedback[]>> {
    try {
      const rows = await this.db
        .select()
        .from(entityDetails)
        .where(eq(entityDetails.entityType, FEEDBACK_TYPE))

      const feedbacks = rows
        .map(parseFeedback)
        .filter((f): f is Feedback => f !== null)
        .sort(sortNewestFirst)

      return { success: true, data: feedbacks }
    } catch (error) {
      log.error({ message: 'feedbackService.listAll failed', error: String(error) })
      return { success: false, error: 'Failed to list feedback' }
    }
  }

  async setStatus(id: string, status: FeedbackStatus, adminNote: string | null): Promise<ServiceResponse<Feedback>> {
    try {
      const found = await this.findRow(id)
      if (!found) return { success: false, error: 'Feedback not found' }
      const parsed = parseFeedback(found)
      if (!parsed) return { success: false, error: 'Feedback data is corrupted' }

      const details = JSON.parse(JSON.stringify({ ...parsed, status, adminNote }))
      await this.db
        .update(entityDetails)
        .set({ details, updatedAt: new Date() })
        .where(eq(entityDetails.id, found.id))

      const saved = await this.getById(id)
      if (saved.error || !saved.data) {
        return { success: false, error: saved.error ?? 'Failed to update feedback' }
      }
      return { success: true, data: saved.data }
    } catch (error) {
      log.error({ message: 'feedbackService.setStatus failed', error: String(error) })
      return { success: false, error: 'Failed to update feedback' }
    }
  }

  async remove(id: string): Promise<ServiceResponse<true>> {
    try {
      await this.db
        .delete(entityDetails)
        .where(and(eq(entityDetails.entityType, FEEDBACK_TYPE), like(entityDetails.entityId, `%::${id}`)))
      return { success: true, data: true }
    } catch (error) {
      log.error({ message: 'feedbackService.remove failed', error: String(error) })
      return { success: false, error: 'Failed to delete feedback' }
    }
  }

  private async getById(id: string): Promise<ServiceResponse<Feedback>> {
    try {
      const found = await this.findRow(id)
      if (!found) return { success: false, error: 'Feedback not found' }
      const parsed = parseFeedback(found)
      if (!parsed) return { success: false, error: 'Feedback data is corrupted' }
      return { success: true, data: parsed }
    } catch (error) {
      log.error({ message: 'feedbackService.getById failed', error: String(error) })
      return { success: false, error: 'Failed to load feedback' }
    }
  }

  private async findRow(id: string): Promise<{ id: string; entityId: string; details: unknown } | null> {
    const [row] = await this.db
      .select({ id: entityDetails.id, entityId: entityDetails.entityId, details: entityDetails.details })
      .from(entityDetails)
      .where(and(eq(entityDetails.entityType, FEEDBACK_TYPE), like(entityDetails.entityId, `%::${id}`)))
      .limit(1)
    return row ?? null
  }
}

export const feedbackService = new FeedbackService()

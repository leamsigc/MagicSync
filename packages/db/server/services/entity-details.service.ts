
import { eq, and } from 'drizzle-orm'
import { entityDetails, type EntityDetails, type NewEntityDetails } from '#layers/BaseDB/db/entityDetails/entityDetails'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { coerceJsonObject } from '#layers/BaseShared/utils/json'
import type { FacebookPage } from '#layers/BaseShared/server/types/facebook-pages'
import type { EntityDetailsServiceType } from './interfaces'


export interface UpdateEntityDetailsData {
  details?: Record<string, unknown>
}

/**
 * `entity_details.details` accumulated corrupt shapes (double-encoded strings,
 * and objects left by `{ ...someString }`). Every read normalizes back to a
 * plain object so no consumer has to defend against the legacy shapes.
 */
function withNormalizedDetails(row: EntityDetails): EntityDetails {
  return { ...row, details: coerceJsonObject(row.details) as EntityDetails['details'] }
}

export class EntityDetailsService implements EntityDetailsServiceType {
  private db = useDrizzle()

  /** Update the single `business_details`-style row for an entity, merging a patch. */
  async updateByEntity(entityId: string, entityType: string, patch: Record<string, unknown>): Promise<EntityDetails> {
    const existing = await this.getDetailsByEntity(entityId, entityType)
    if (!existing) {
      return this.createDetails({ entityId, entityType, details: patch })
    }
    const merged = { ...coerceJsonObject(existing.details), ...patch }
    return this.updateDetails(existing.id, { details: merged })
  }

  /**
   * Create new entity details
  */
  async createDetails(data: NewEntityDetails): Promise<EntityDetails> {
    const detailsData = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: dayjs().toDate(),
      updatedAt: dayjs().toDate(),
    }

    const result = await this.db
      .insert(entityDetails)
      .values(detailsData)
      .returning()

    const [newDetails] = result

    if (!newDetails) {
      throw new Error('Failed to create entity details')
    }

    return withNormalizedDetails(newDetails)
  }
  async createOrUpdateDetails({ entityId, entityType, pages }: { entityId: string; entityType: string; pages: FacebookPage[] }) {
    // Check if the entity details already exist
    const existingDetails = await this.getDetailsByEntity(entityId, entityType)
    if (existingDetails) {
      this.updateDetails(existingDetails.id, { details: { pages } })
    } else {
      try {
        this.createDetails({
          entityId,
          entityType,
          details: {
            pages: pages,
            username: '',
            picture: ''
          }
        })
      } catch (error) {
        log.error({ message: 'Error creating entity details', error: String(error) })
      }
    }
  }
  /**
   * Get entity details by ID
   */
  async getDetailsById(id: string): Promise<EntityDetails | undefined> {
    const details = await this.db.query.entityDetails.findFirst({
      where: eq(entityDetails.id, id),
    });

    if (!details) return undefined
    return withNormalizedDetails(details)
  }

  /**
   * Get entity details by entityId and entityType
   */
  async getDetailsByEntity(entityId: string, entityType: string): Promise<EntityDetails | undefined> {
    const details = await this.db.query.entityDetails.findFirst({
      where: and(
        eq(entityDetails.entityId, entityId),
        eq(entityDetails.entityType, entityType)
      )
    })

    if (!details) return undefined
    return withNormalizedDetails(details)
  }

  /**
   * Update entity details
   */
  async updateDetails(id: string, data: UpdateEntityDetailsData): Promise<EntityDetails> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    }

    const [updatedDetails] = await this.db
      .update(entityDetails)
      .set(updateData)
      .where(eq(entityDetails.id, id))
      .returning()

    return withNormalizedDetails(updatedDetails)
  }

  /**
   * Delete entity details
   */
  async deleteDetails(id: string): Promise<boolean> {
    try {
      await this.db
        .delete(entityDetails)
        .where(eq(entityDetails.id, id))

      return true
    } catch (error) {
      log.error({ message: 'Error deleting entity details', error: String(error) })
      return false
    }
  }
}

export const entityDetailsService = new EntityDetailsService()

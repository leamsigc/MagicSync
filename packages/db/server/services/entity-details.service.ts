/**
 * Entity Details Service
 *
 * Handles CRUD operations for generic entity details stored as JSON.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

import { eq, and } from 'drizzle-orm'
import { entityDetails, type EntityDetails, type NewEntityDetails } from '#layers/BaseDB/db/entityDetails/entityDetails'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { FacebookPage } from '#layers/BaseConnect/utils/FacebookPages'


export interface UpdateEntityDetailsData {
  details?: Record<string, unknown>
}

/**
 * Entity Details Service Class
 */
export class EntityDetailsService {
  private db = useDrizzle()

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

    return newDetails as EntityDetails
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
        console.error('Error creating entity details:', error)
      }
    }
  }
  /**
   * Get entity details by ID
   */
  async getDetailsById(id: string): Promise<EntityDetails> {
    const details = await this.db.query.entityDetails.findFirst({
      where: eq(entityDetails.id, id),
    });

    return details as EntityDetails
  }

  /**
   * Get entity details by entityId and entityType
   */
  async getDetailsByEntity(entityId: string, entityType: string): Promise<EntityDetails> {
    const details = await this.db.query.entityDetails.findFirst({
      where: and(
        eq(entityDetails.entityId, entityId),
        eq(entityDetails.entityType, entityType)
      )
    })

    return details as EntityDetails
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

    return updatedDetails as EntityDetails
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
      console.error('Error deleting entity details:', error)
      return false
    }
  }
}

export const entityDetailsService = new EntityDetailsService()

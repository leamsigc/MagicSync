import { and, eq } from 'drizzle-orm'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { piiMappings } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import type { PiiMapping } from '../agent/plugins/pii/detect'

/** Per-conversation surrogate maps for private mode (PRD §6 pii_mappings). */
export class PiiMappingService {
  private db = useDrizzle()

  async replaceMappings(
    businessId: string,
    threadId: string,
    mappings: PiiMapping[],
  ): Promise<ServiceResponse<{ stored: number }>> {
    try {
      await this.db
        .delete(piiMappings)
        .where(and(eq(piiMappings.businessId, businessId), eq(piiMappings.threadId, threadId)))
      if (mappings.length > 0) {
        await this.db.insert(piiMappings).values(mappings.map(mapping => ({
          id: crypto.randomUUID(),
          businessId,
          threadId,
          surrogate: mapping.surrogate,
          value: mapping.value,
        })))
      }
      return { success: true, data: { stored: mappings.length } }
    } catch {
      return { success: false, error: 'Failed to store PII mappings' }
    }
  }

  async listMappings(businessId: string, threadId: string): Promise<ServiceResponse<PiiMapping[]>> {
    try {
      const rows = await this.db
        .select()
        .from(piiMappings)
        .where(and(eq(piiMappings.businessId, businessId), eq(piiMappings.threadId, threadId)))
      return { success: true, data: rows.map(row => ({ surrogate: row.surrogate, value: row.value })) }
    } catch {
      return { success: false, error: 'Failed to load PII mappings' }
    }
  }
}

export const piiMappingService = new PiiMappingService()

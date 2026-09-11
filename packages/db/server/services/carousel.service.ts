import { and, like, eq } from 'drizzle-orm'
import { entityDetails } from '#layers/BaseDB/db/entityDetails/entityDetails'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import type { ServiceResponse } from './types'

export interface CarouselSlideData {
  kicker?: string
  headline: string
  body?: string
  items?: string[]
  quote?: string
  author?: string
  stat?: string
  statLabel?: string
  cta?: string
  footer?: string
  images?: string[]
  borderRadius?: number
}

export interface CarouselSlide {
  id: string
  templateKey: string
  data: CarouselSlideData
  pattern: string
  patternColor: string
  patternOpacity: number
  bgImage: { url: string; dim: number; shadow: { x: number; y: number; blur: number; opacity: number }; transform?: { x: number; y: number; scale: number } } | null
  customHtml: string
  /** Layer-based slides (new format). Opaque here — the tools layer owns the shape. */
  layers?: Array<Record<string, unknown>>
}

export interface CarouselPalette {
  bg: string
  text: string
  accent: string
  font?: string
}

export interface CarouselData {
  name: string
  slides: CarouselSlide[]
  palette: CarouselPalette
  pattern?: string
  handle?: string
  /** Fabric scene snapshots, one per slide (Task 1.4). Opaque here — the
   * tools layer builds them via shared/carousel-scene; storage never reads
   * inside. Absent on rows saved before snapshots existed. */
  scene?: Array<{ slideId: string, scene: unknown }>
}

interface CarouselDetailsRow {
  entityId: string
  details: unknown
  updatedAt: Date | null
}

type CarouselResult = { id: string; name: string; slides: CarouselSlide[]; palette: CarouselPalette; pattern?: string; handle?: string; scene?: Array<{ slideId: string, scene: unknown }>; isPublic?: boolean; shareSlug?: string; updatedAt?: string }

const CAROUSEL_TYPE = 'carousel'
const PUBLIC_TYPE = 'carousel_public'
const DEFAULT_PALETTE: CarouselPalette = { bg: '#0f0e0d', text: '#fafaf9', accent: '#f97316' }

const ownedEntityId = (userId: string, carouselId: string) => `${userId}::${carouselId}`

function extractCarouselId(entityId: string): string {
  return entityId.split('::')[1] ?? entityId
}

function parseDetails(row: CarouselDetailsRow): Partial<CarouselData> | null {
  const details = row.details as Partial<CarouselData> | null
  return (details && typeof details === 'object') ? details : null
}

function toCarousel(row: CarouselDetailsRow): CarouselResult | null {
  const details = parseDetails(row)
  if (!details) return null
  return {
    id: extractCarouselId(row.entityId),
    name: typeof details.name === 'string' ? details.name : 'Untitled Carousel',
    slides: Array.isArray(details.slides) ? details.slides : [],
    palette: details.palette ?? DEFAULT_PALETTE,
    pattern: details.pattern,
    handle: details.handle,
    scene: Array.isArray(details.scene) ? details.scene : undefined,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
  }
}

function serializeDetails(data: CarouselData) {
  return JSON.parse(JSON.stringify({
    name: data.name,
    slides: data.slides,
    palette: data.palette,
    pattern: data.pattern,
    handle: data.handle,
    scene: data.scene,
  }))
}

function notFoundError(error?: string) {
  return { success: false as const, error: error ?? 'Carousel not found', code: 'NOT_FOUND' as const }
}

function corruptedError(error?: string) {
  return { success: false as const, error: error ?? 'Carousel data is corrupted', code: 'CORRUPTED' as const }
}

export class CarouselService {
  private db = useDrizzle()

  async listForUser(userId: string): Promise<ServiceResponse<Array<CarouselResult>>> {
    try {
      const rows = await this.db
        .select()
        .from(entityDetails)
        .where(and(
          eq(entityDetails.entityType, CAROUSEL_TYPE),
          like(entityDetails.entityId, `${userId}::%`)
        ))

      const carousels = rows
        .map(toCarousel)
        .filter((c): c is CarouselResult => c !== null)
        .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))

      return { success: true, data: carousels }
    } catch (error) {
      console.error('carouselService.listForUser failed:', error)
      return { success: false, error: 'Failed to list carousels' }
    }
  }

  async getForUser(userId: string, carouselId: string): Promise<ServiceResponse<CarouselResult>> {
    try {
      const [row] = await this.db
        .select()
        .from(entityDetails)
        .where(and(
          eq(entityDetails.entityType, CAROUSEL_TYPE),
          eq(entityDetails.entityId, ownedEntityId(userId, carouselId))
        ))

      if (!row) return notFoundError()

      const carousel = toCarousel(row)
      if (!carousel) return corruptedError()

      const [publicRow] = await this.db
        .select({ id: entityDetails.id })
        .from(entityDetails)
        .where(and(eq(entityDetails.entityType, PUBLIC_TYPE), eq(entityDetails.entityId, carouselId)))

      return { success: true, data: { ...carousel, isPublic: !!publicRow, shareSlug: publicRow ? carousel.id : undefined } }
    } catch (error) {
      console.error('carouselService.getForUser failed:', error)
      return { success: false, error: 'Failed to load carousel' }
    }
  }

  async upsert(userId: string, carouselId: string, data: CarouselData): Promise<ServiceResponse<CarouselResult>> {
    try {
      const entityId = ownedEntityId(userId, carouselId)
      const existing = await this.db
        .select({ id: entityDetails.id })
        .from(entityDetails)
        .where(and(eq(entityDetails.entityType, CAROUSEL_TYPE), eq(entityDetails.entityId, entityId)))
        .limit(1)

      const details = serializeDetails(data)
      await this.saveEntity(existing, entityId, CAROUSEL_TYPE, details)

      const result = await this.getForUser(userId, carouselId)
      if (result.error || !result.data) {
        return { success: false, error: result.error ?? 'Failed to save carousel' }
      }
      return { success: true, data: result.data }
    } catch (error) {
      console.error('carouselService.upsert failed:', error)
      return { success: false, error: 'Failed to save carousel' }
    }
  }

  async remove(userId: string, carouselId: string): Promise<ServiceResponse<true>> {
    try {
      const entityId = ownedEntityId(userId, carouselId)
      await this.deleteByTypeAndId(CAROUSEL_TYPE, entityId)
      await this.deleteByTypeAndId(PUBLIC_TYPE, carouselId)
      return { success: true, data: true }
    } catch (error) {
      console.error('carouselService.remove failed:', error)
      return { success: false, error: 'Failed to delete carousel' }
    }
  }

  async publish(userId: string, carouselId: string): Promise<ServiceResponse<{ slug: string }>> {
    try {
      const owned = await this.getForUser(userId, carouselId)
      if (owned.error || !owned.data) {
        return notFoundError(owned.error)
      }

      const details = serializeDetails(owned.data)
      const existing = await this.db
        .select({ id: entityDetails.id })
        .from(entityDetails)
        .where(and(eq(entityDetails.entityType, PUBLIC_TYPE), eq(entityDetails.entityId, carouselId)))
        .limit(1)

      await this.saveEntity(existing, carouselId, PUBLIC_TYPE, details)
      return { success: true, data: { slug: carouselId } }
    } catch (error) {
      console.error('carouselService.publish failed:', error)
      return { success: false, error: 'Failed to publish carousel' }
    }
  }

  async unpublish(userId: string, carouselId: string): Promise<ServiceResponse<true>> {
    try {
      const owned = await this.getForUser(userId, carouselId)
      if (owned.error || !owned.data) {
        return notFoundError()
      }
      await this.deleteByTypeAndId(PUBLIC_TYPE, carouselId)
      return { success: true, data: true }
    } catch (error) {
      console.error('carouselService.unpublish failed:', error)
      return { success: false, error: 'Failed to unpublish carousel' }
    }
  }

  async getPublic(slug: string): Promise<ServiceResponse<{ name: string; slides: CarouselSlide[]; palette: CarouselPalette; pattern?: string; handle?: string }>> {
    try {
      const [row] = await this.db
        .select()
        .from(entityDetails)
        .where(and(eq(entityDetails.entityType, PUBLIC_TYPE), eq(entityDetails.entityId, slug)))
        .limit(1)

      if (!row) return notFoundError('Shared carousel not found')

      const details = row.details as Partial<CarouselData> | null
      if (!details || !Array.isArray(details.slides)) {
        return corruptedError('Shared carousel data is corrupted')
      }

      return {
        success: true,
        data: {
          name: typeof details.name === 'string' ? details.name : 'Carousel',
          slides: details.slides as CarouselSlide[],
          palette: details.palette ?? DEFAULT_PALETTE,
          pattern: details.pattern,
          handle: details.handle,
        },
      }
    } catch (error) {
      console.error('carouselService.getPublic failed:', error)
      return { success: false, error: 'Failed to load shared carousel' }
    }
  }

  private async saveEntity(existing: Array<{ id: string }>, entityId: string, entityType: string, details: unknown): Promise<void> {
    if (existing.length > 0) {
      await this.db
        .update(entityDetails)
        .set({ details, updatedAt: new Date() })
        .where(eq(entityDetails.id, existing[0].id))
    } else {
      await this.db.insert(entityDetails).values({
        id: crypto.randomUUID(),
        entityId,
        entityType,
        details,
      })
    }
  }

  private async deleteByTypeAndId(entityType: string, entityId: string): Promise<void> {
    await this.db
      .delete(entityDetails)
      .where(and(eq(entityDetails.entityType, entityType), eq(entityDetails.entityId, entityId)))
  }
}

export const carouselService = new CarouselService()

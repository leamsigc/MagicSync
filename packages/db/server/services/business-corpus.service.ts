import { and, eq } from 'drizzle-orm'
import type { ServiceResponse } from './types'
import {
  BRAND_KEYS,
  CORPUS_SECTIONS,
  UpsertBrandKeySchema,
  UpsertCorpusSectionSchema,
  businessBrandKeys,
  businessCorpusSections,
  type BrandKey,
  type BusinessBrandKey,
  type BusinessCorpusSection,
  type CorpusSection,
  type UpsertBrandKeyData,
  type UpsertCorpusSectionData,
} from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'

// New businesses start with empty sections: instructional starter text must
// never leak into live AI context (PRD-BUSINESS-PLAYBOOK-INTAKE §9). The
// markers below quarantine starter text already seeded into existing rows.
const PLACEHOLDER_MARKERS = [
  '[audience]',
  '[problem]',
  '[alternatives]',
  '[differentiator]',
  '[keyword 1]',
  '[Result quote]',
  '[Name, Role]',
  '[industry belief]',
  '[transformation]',
  '[price]',
  '[reason]',
  '[name]',
]

export function isPlaceholderContent(content: string): boolean {
  return PLACEHOLDER_MARKERS.some(marker => content.includes(marker))
}

export function isUsableContent(content: string): boolean {
  return content.trim().length > 0 && !isPlaceholderContent(content)
}

export interface CorpusReadiness {
  ready: boolean
  filledSections: CorpusSection[]
  missingSections: CorpusSection[]
  warnings: string[]
}

export function buildBusinessContextPrompt(
  sections: Pick<BusinessCorpusSection, 'section' | 'content'>[],
  keys: Pick<BusinessBrandKey, 'key' | 'content'>[],
): string {
  const sectionText = sections
    .filter((s) => isUsableContent(s.content))
    .map((s) => `## ${s.section}\n${s.content}`)
    .join('\n\n')
  const keyText = keys
    .filter((k) => isUsableContent(k.content))
    .map((k) => `## ${k.key}\n${k.content}`)
    .join('\n\n')
  return ['# Business context', sectionText, keyText]
    .filter((part) => part.trim().length > 0)
    .join('\n\n')
}

export class BusinessCorpusService {
  private db = useDrizzle()

  async seedDefaults(
    businessId: string,
    userId: string,
  ): Promise<ServiceResponse<{ sections: number, keys: number }>> {
    try {
      const [sections, keys] = await Promise.all([
        this.db
          .select({ section: businessCorpusSections.section })
          .from(businessCorpusSections)
          .where(
            and(
              eq(businessCorpusSections.businessId, businessId),
              eq(businessCorpusSections.userId, userId),
            ),
          ),
        this.db
          .select({ key: businessBrandKeys.key })
          .from(businessBrandKeys)
          .where(
            and(
              eq(businessBrandKeys.businessId, businessId),
              eq(businessBrandKeys.userId, userId),
            ),
          ),
      ])
      const haveSections = new Set(sections.map(row => row.section))
      const haveKeys = new Set(keys.map(row => row.key))
      const now = new Date()
      const missingSections = CORPUS_SECTIONS.filter(section => !haveSections.has(section))
      const missingKeys = BRAND_KEYS.filter(key => !haveKeys.has(key))
      if (missingSections.length > 0) {
        await this.db.insert(businessCorpusSections).values(
          missingSections.map(section => ({
            id: crypto.randomUUID(),
            businessId,
            userId,
            section,
            content: '',
            createdAt: now,
            updatedAt: now,
          })),
        )
      }
      if (missingKeys.length > 0) {
        await this.db.insert(businessBrandKeys).values(
          missingKeys.map(key => ({
            id: crypto.randomUUID(),
            businessId,
            userId,
            key,
            content: '',
            createdAt: now,
            updatedAt: now,
          })),
        )
      }
      return { success: true, data: { sections: missingSections.length, keys: missingKeys.length } }
    } catch {
      return { success: false, error: 'Failed to seed business corpus' }
    }
  }

  async upsertSection(
    userId: string,
    data: UpsertCorpusSectionData,
  ): Promise<ServiceResponse<BusinessCorpusSection>> {
    try {
      const parsed = UpsertCorpusSectionSchema.safeParse(data)
      if (!parsed.success) {
        return { success: false, error: 'Invalid corpus section', code: 'VALIDATION_ERROR' }
      }
      const existing = await this.findSection(data.businessId, userId, data.section)
      if (existing) {
        const [updated] = await this.db
          .update(businessCorpusSections)
          .set({ content: data.content, updatedAt: new Date() })
          .where(eq(businessCorpusSections.id, existing.id))
          .returning()
        return { success: true, data: updated }
      }
      const [created] = await this.db
        .insert(businessCorpusSections)
        .values({
          id: crypto.randomUUID(),
          businessId: data.businessId,
          userId,
          section: data.section,
          content: data.content,
        })
        .returning()
      return { success: true, data: created }
    } catch {
      return { success: false, error: 'Failed to save corpus section' }
    }
  }

  async getCorpus(
    businessId: string,
    userId: string,
  ): Promise<ServiceResponse<BusinessCorpusSection[]>> {
    try {
      await this.seedDefaults(businessId, userId)
      const rows = await this.db
        .select()
        .from(businessCorpusSections)
        .where(
          and(
            eq(businessCorpusSections.businessId, businessId),
            eq(businessCorpusSections.userId, userId),
          ),
        )
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to fetch business corpus' }
    }
  }

  async upsertBrandKey(
    userId: string,
    data: UpsertBrandKeyData,
  ): Promise<ServiceResponse<BusinessBrandKey>> {
    try {
      const parsed = UpsertBrandKeySchema.safeParse(data)
      if (!parsed.success) {
        return { success: false, error: 'Invalid brand key', code: 'VALIDATION_ERROR' }
      }
      const existing = await this.findBrandKey(data.businessId, userId, data.key)
      if (existing) {
        const [updated] = await this.db
          .update(businessBrandKeys)
          .set({ content: data.content, updatedAt: new Date() })
          .where(eq(businessBrandKeys.id, existing.id))
          .returning()
        return { success: true, data: updated }
      }
      const [created] = await this.db
        .insert(businessBrandKeys)
        .values({
          id: crypto.randomUUID(),
          businessId: data.businessId,
          userId,
          key: data.key,
          content: data.content,
        })
        .returning()
      return { success: true, data: created }
    } catch {
      return { success: false, error: 'Failed to save brand key' }
    }
  }

  async getBrandKeys(
    businessId: string,
    userId: string,
  ): Promise<ServiceResponse<BusinessBrandKey[]>> {
    try {
      const rows = await this.db
        .select()
        .from(businessBrandKeys)
        .where(
          and(
            eq(businessBrandKeys.businessId, businessId),
            eq(businessBrandKeys.userId, userId),
          ),
        )
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to fetch brand keys' }
    }
  }

  async getContextPrompt(
    businessId: string,
    userId: string,
  ): Promise<ServiceResponse<string>> {
    const [sectionsRes, keysRes] = await Promise.all([
      this.getCorpus(businessId, userId),
      this.getBrandKeys(businessId, userId),
    ])
    if (!sectionsRes.success || !keysRes.success) {
      return { success: false, error: 'Failed to build business context' }
    }
    return {
      success: true,
      data: buildBusinessContextPrompt(sectionsRes.data ?? [], keysRes.data ?? []),
    }
  }

  async getReadiness(
    businessId: string,
    userId: string,
  ): Promise<ServiceResponse<CorpusReadiness>> {
    try {
      const corpus = await this.getCorpus(businessId, userId)
      if (!corpus.success || !corpus.data) {
        return { success: false, error: corpus.error ?? 'Failed to fetch business corpus' }
      }
      const filled = corpus.data
        .filter(row => isUsableContent(row.content))
        .map(row => row.section as CorpusSection)
      const filledSet = new Set(filled)
      const missing = CORPUS_SECTIONS.filter(section => !filledSet.has(section))
      const warnings = missing.map(section => `Corpus section '${section}' is empty`)
      return { success: true, data: { ready: missing.length === 0, filledSections: filled, missingSections: missing, warnings } }
    } catch {
      return { success: false, error: 'Failed to assess corpus readiness' }
    }
  }

  private async findSection(
    businessId: string,
    userId: string,
    section: CorpusSection,
  ): Promise<BusinessCorpusSection | null> {
    const [row] = await this.db
      .select()
      .from(businessCorpusSections)
      .where(
        and(
          eq(businessCorpusSections.businessId, businessId),
          eq(businessCorpusSections.userId, userId),
          eq(businessCorpusSections.section, section),
        ),
      )
      .limit(1)
    return row ?? null
  }

  private async findBrandKey(
    businessId: string,
    userId: string,
    key: BrandKey,
  ): Promise<BusinessBrandKey | null> {
    const [row] = await this.db
      .select()
      .from(businessBrandKeys)
      .where(
        and(
          eq(businessBrandKeys.businessId, businessId),
          eq(businessBrandKeys.userId, userId),
          eq(businessBrandKeys.key, key),
        ),
      )
      .limit(1)
    return row ?? null
  }
}

export const businessCorpusService = new BusinessCorpusService()

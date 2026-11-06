import { and, desc, eq, isNull, or, sql } from 'drizzle-orm'
import type { BrandKit, DesignVersion } from '#layers/BaseDB/db/schema'
import { brandKits, designVersions, templateAssets, templates } from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import type { ServiceResponse } from '#layers/BaseShared/server/types/service.types'
import { ValidationError } from './types'
import { businessAccessService } from './business-access.service'

/**
 * Design service — the design-studio half of the templates table.
 *
 * A design is a `templates` row with type 'IMAGES' whose `content` holds the
 * versioned envelope { schema, doc, meta, savedAt }. Other services keep
 * owning EMAIL/CHAT/VARIABLE rows; this module only claims IMAGES rows.
 */

const DESIGN_TYPE = 'IMAGES' as const
const ENVELOPE_SCHEMA = 'magicsync/image-editor@1'
const MAX_ENVELOPE_BYTES = 4 * 1024 * 1024
const MAX_RECENT_VERSIONS = 20

export type TemplateRow = typeof templates.$inferSelect

export interface DesignEnvelope {
  schema: typeof ENVELOPE_SCHEMA
  doc: unknown
  meta: Record<string, unknown>
  assets?: Array<{ name: string; url: string }>
}

export interface DesignRecord {
  id: string
  ownerId: string
  title: string
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
  envelope: DesignEnvelope
  thumbnails: Array<{ name: string; url: string }>
}

export interface DesignPage {
  success: boolean
  data: DesignRecord[]
  error?: string
  pagination: { page: number; limit: number; total: number; totalPage: number }
}

export interface SaveDesignInput {
  title: string
  doc: unknown
  meta?: Record<string, unknown>
  isPublic?: boolean
  thumbnails?: Array<{ name: string; url: string }>
}

export class DesignService {
  private db = useDrizzle()

  async list(userId: string, filters: { q?: string; category?: string } = {}, paginationOpt: { page?: number; limit?: number } = {}): Promise<DesignPage> {
    const page = Math.max(1, paginationOpt.page ?? 1)
    const limit = Math.min(100, Math.max(1, paginationOpt.limit ?? 20))
    try {
      const offset = (page - 1) * limit
      // Private designs must only ever be listed for their owner. This where
      // clause used to be type-only, leaking every user's private designs into
      // "My Designs".
      const where = and(eq(templates.type, DESIGN_TYPE), eq(templates.ownerId, userId))
      const rows = await this.db.query.templates.findMany({
        where,
        orderBy: [desc(templates.updatedAt)],
        limit: limit * 10,
        offset,
        with: { assets: true },
      })
      const filtered = filterRows(rows, filters, '')
      const visible = filtered.slice(0, limit)
      const [{ total }] = await this.db.select({ total: sql<number>`count(*)` }).from(templates).where(where)
      return { success: true, data: visible.map(toDesignRecord), pagination: { page, limit, total, totalPage: Math.max(1, Math.ceil(total / limit)) } }
    } catch {
      return { success: false, data: [], error: 'Failed to list designs', pagination: { page, limit, total: 0, totalPage: 1 } }
    }
  }

  async listPublic(filters: { q?: string } = {}, paginationOpt: { page?: number; limit?: number } = {}): Promise<DesignPage> {
    const page = Math.max(1, paginationOpt.page ?? 1)
    const limit = Math.min(100, Math.max(1, paginationOpt.limit ?? 20))
    try {
      const offset = (page - 1) * limit
      const where = and(eq(templates.type, DESIGN_TYPE), eq(templates.isPublic, true))
      const rows = await this.db.query.templates.findMany({
        where,
        orderBy: [desc(templates.updatedAt)],
        limit: limit * 10,
        offset,
        with: { assets: true },
      })
      const filtered = filterRows(rows, filters, '').slice(0, limit)
      const [{ total }] = await this.db.select({ total: sql<number>`count(*)` }).from(templates).where(where)
      return { success: true, data: filtered.map(toDesignRecord), pagination: { page, limit, total, totalPage: Math.max(1, Math.ceil(total / limit)) } }
    } catch {
      return { success: false, data: [], error: 'Failed to list public designs', pagination: { page, limit, total: 0, totalPage: 1 } }
    }
  }

  /** A design is visible to its owner or when published. */
  async findById(id: string, userId: string): Promise<ServiceResponse<DesignRecord>> {
    try {
      const row = await this.db.query.templates.findFirst({
        where: and(eq(templates.id, id), or(eq(templates.ownerId, userId), eq(templates.isPublic, true))),
        with: { assets: true },
      })
      if (!row) return { success: false, error: 'Design not found', code: 'NOT_FOUND' }
      return { success: true, data: toDesignRecord(row as unknown as TemplateRow & { assets: Array<{ name: string; url: string }> }) }
    } catch {
      return { success: false, error: 'Failed to fetch design' }
    }
  }

  async create(userId: string, input: SaveDesignInput): Promise<ServiceResponse<DesignRecord>> {
    try {
      validateSave(input)
      const id = crypto.randomUUID()
      const now = new Date()
      const [row] = await this.db.insert(templates).values({
        id,
        ownerId: userId,
        type: DESIGN_TYPE,
        title: input.title,
        content: envelopeString(input),
        isPublic: input.isPublic ?? false,
        createdAt: now,
        updatedAt: now,
      }).returning()
      if (!row) return { success: false, error: 'Failed to create design' }
      const thumbnails = await this.syncThumbnails(id, input.thumbnails ?? [])
      await this.snapshotVersion(id, userId, input.title, row.content)
      return { success: true, data: toDesignRecord({ ...row, assets: thumbnails }) as TemplateRow & { assets: Array<{ name: string; url: string }> } }
    } catch (error) {
      return this.saveError(error, 'create')
    }
  }

  async update(id: string, userId: string, input: Partial<SaveDesignInput>, options: { snapshot?: boolean } = {}): Promise<ServiceResponse<DesignRecord>> {
    try {
      const current = await this.db.query.templates.findFirst({ where: and(eq(templates.id, id), eq(templates.ownerId, userId)) })
      if (!current) return { success: false, error: 'Design not found', code: 'NOT_FOUND' }
      const previous = readEnvelope(current.content)
      const merged: SaveDesignInput = {
        title: input.title ?? current.title,
        doc: input.doc ?? previous?.doc ?? null,
        meta: input.meta ?? previous?.meta ?? {},
        isPublic: input.isPublic ?? current.isPublic,
      }
      validateSave(merged)
      const [row] = await this.db.update(templates).set({
        title: merged.title,
        content: envelopeString(merged),
        isPublic: merged.isPublic ?? false,
        updatedAt: new Date(),
      }).where(and(eq(templates.id, id), eq(templates.ownerId, userId), eq(templates.type, DESIGN_TYPE))).returning()
      if (!row) return { success: false, error: 'Failed to update design' }
      const thumbnails = input.thumbnails ? await this.syncThumbnails(id, input.thumbnails) : []
      if (options.snapshot !== false && input.doc) await this.snapshotVersion(id, userId, merged.title, row.content)
      return { success: true, data: toDesignRecord({ ...row, assets: thumbnails }) as TemplateRow & { assets: Array<{ name: string; url: string }> } }
    } catch (error) {
      return this.saveError(error, 'update')
    }
  }

  async delete(id: string, userId: string): Promise<ServiceResponse<{ id: string }>> {
    try {
      const rows = await this.db.delete(templates).where(and(eq(templates.id, id), eq(templates.ownerId, userId), eq(templates.type, DESIGN_TYPE))).returning()
      if (rows.length === 0) return { success: false, error: 'Design not found', code: 'NOT_FOUND' }
      return { success: true, data: { id } }
    } catch {
      return { success: false, error: 'Failed to delete design' }
    }
  }

  async duplicate(id: string, userId: string, title?: string): Promise<ServiceResponse<DesignRecord>> {
    const found = await this.findById(id, userId)
    if (!found.success || !found.data) return { success: false, error: found.error ?? 'Design not found' }
    return this.create(userId, {
      title: title ?? duplicateTitle(found.data.title),
      doc: found.data.envelope.doc,
      meta: { ...found.data.envelope.meta },
    })
  }

  async setPublic(id: string, userId: string, isPublic: boolean): Promise<ServiceResponse<DesignRecord>> {
    return this.update(id, userId, { isPublic }, { snapshot: false })
  }

  /* -------------------------------------------------- version history */

  async listVersions(templateId: string, userId: string): Promise<ServiceResponse<Array<Pick<DesignVersion, 'id' | 'version' | 'title' | 'createdAt'>>>> {
    try {
      const rows = await this.db.select({
        id: designVersions.id,
        version: designVersions.version,
        title: designVersions.title,
        createdAt: designVersions.createdAt,
      }).from(designVersions)
        .where(and(eq(designVersions.templateId, templateId), eq(designVersions.authorId, userId)))
        .orderBy(desc(designVersions.version)).limit(MAX_RECENT_VERSIONS)
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to list versions' }
    }
  }

  async getVersion(templateId: string, userId: string, versionId: string): Promise<ServiceResponse<DesignVersion>> {
    try {
      const row = await this.db.query.designVersions.findFirst({
        where: and(eq(designVersions.id, versionId), eq(designVersions.templateId, templateId), eq(designVersions.authorId, userId)),
      })
      if (!row) return { success: false, error: 'Version not found', code: 'NOT_FOUND' }
      return { success: true, data: row }
    } catch {
      return { success: false, error: 'Failed to fetch version' }
    }
  }

  private async snapshotVersion(templateId: string, userId: string, title: string, content: string): Promise<void> {
    try {
      const countRows = await this.db.select({ version: sql<number>`count(*) + 1` }).from(designVersions).where(eq(designVersions.templateId, templateId))
      const next = Number(countRows[0]?.version ?? 1)
      await this.db.insert(designVersions).values({ id: crypto.randomUUID(), templateId, authorId: userId, version: next, title, content })
      const stale = await this.db.select({ id: designVersions.id }).from(designVersions)
        .where(eq(designVersions.templateId, templateId)).orderBy(desc(designVersions.version)).offset(MAX_RECENT_VERSIONS)
      for (const item of stale) await this.db.delete(designVersions).where(eq(designVersions.id, item.id))
    } catch {
      // history is best-effort; the live design remains the source of truth
    }
  }

  private async syncThumbnails(templateId: string, thumbnails: Array<{ name: string; url: string }>): Promise<Array<{ name: string; url: string }>> {
    try {
      await this.db.delete(templateAssets).where(eq(templateAssets.templateId, templateId))
      if (thumbnails.length === 0) return []
      const safe = thumbnails.slice(0, 5).map(entry => ({
        id: crypto.randomUUID(),
        templateId,
        name: entry.name.slice(0, 120),
        url: entry.url.slice(0, 250_000),
      }))
      await this.db.insert(templateAssets).values(safe)
      return safe.map(entry => ({ name: entry.name, url: entry.url }))
    } catch {
      return []
    }
  }

  private saveError(error: unknown, action: string): ServiceResponse<DesignRecord> {
    if (error instanceof ValidationError) return { success: false, error: error.message, code: 'VALIDATION' }
    return { success: false, error: `Failed to ${action} design` }
  }
}

/* ------------------------------------------------------------------ */
/* brand kits                                                          */
/* ------------------------------------------------------------------ */

export interface BrandKitInput {
  name?: string
  colors?: unknown
  fonts?: unknown
  logoUrl?: string | null
  defaults?: unknown
}

const BRAND_COLORS_MAX = 12

export class BrandKitService {
  private db = useDrizzle()

  async list(userId: string, businessId?: string): Promise<ServiceResponse<BrandKit[]>> {
    try {
      const where = businessId
        ? or(
            eq(brandKits.businessId, businessId),
            and(isNull(brandKits.businessId), eq(brandKits.ownerId, userId)),
          )
        : eq(brandKits.ownerId, userId)
      const rows = await this.db.select().from(brandKits).where(where).orderBy(desc(brandKits.createdAt))
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to list brand kits' }
    }
  }

  async create(userId: string, input: BrandKitInput, businessId?: string, ownerUserId?: string): Promise<ServiceResponse<BrandKit>> {
    try {
      if (!input.name || input.name.trim().length === 0 || input.name.length > 80) throw new ValidationError('Brand kit name is required (≤80 chars)')
      const [row] = await this.db.insert(brandKits).values({
        id: crypto.randomUUID(),
        ownerId: ownerUserId ?? userId,
        businessId: businessId ?? null,
        name: input.name,
        colors: normalizeColors(input.colors),
        fonts: sanitizeFonts(input.fonts),
        logoUrl: sanitizeUrlish(input.logoUrl) ?? '',
        defaults: input.defaults && typeof input.defaults === 'object' ? input.defaults : {},
      }).returning()
      if (!row) return { success: false, error: 'Failed to create brand kit' }
      return { success: true, data: row }
    } catch (error) {
      return brandError(error, 'create')
    }
  }

  async update(id: string, userId: string, input: BrandKitInput): Promise<ServiceResponse<BrandKit>> {
    try {
      const existing = await this.db.query.brandKits.findFirst({ where: eq(brandKits.id, id) })
      if (!existing) return { success: false, error: 'Brand kit not found', code: 'NOT_FOUND' }
      const allowed = existing.ownerId === userId
        || (!!existing.businessId && await businessAccessService.isMember(userId, existing.businessId))
      if (!allowed) return { success: false, error: 'Brand kit not found', code: 'NOT_FOUND' }

      const [row] = await this.db.update(brandKits).set({
        name: input.name && input.name.length <= 80 ? input.name : undefined,
        colors: input.colors !== undefined ? sanitizeColors(input.colors) : undefined,
        fonts: input.fonts !== undefined ? sanitizeFonts(input.fonts) : undefined,
        logoUrl: input.logoUrl !== undefined ? sanitizeUrlish(input.logoUrl) ?? '' : undefined,
        updatedAt: new Date(),
      }).where(eq(brandKits.id, id)).returning()
      if (!row) return { success: false, error: 'Brand kit not found', code: 'NOT_FOUND' }
      return { success: true, data: row }
    } catch (error) {
      return brandError(error, 'update')
    }
  }

  async remove(id: string, userId: string): Promise<ServiceResponse<{ id: string }>> {
    try {
      const existing = await this.db.query.brandKits.findFirst({ where: eq(brandKits.id, id) })
      if (!existing) return { success: false, error: 'Brand kit not found', code: 'NOT_FOUND' }
      const allowed = existing.ownerId === userId
        || (!!existing.businessId && await businessAccessService.isMember(userId, existing.businessId))
      if (!allowed) return { success: false, error: 'Brand kit not found', code: 'NOT_FOUND' }

      const rows = await this.db.delete(brandKits).where(eq(brandKits.id, id)).returning()
      if (rows.length === 0) return { success: false, error: 'Brand kit not found', code: 'NOT_FOUND' }
      return { success: true, data: { id } }
    } catch {
      return { success: false, error: 'Failed to delete brand kit' }
    }
  }
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function filterRows(rows: TemplateRow[], filters: { q?: string; category?: string }, _userId: string): TemplateRow[] {
  let out = rows
  const q = filters.q?.trim().toLowerCase()
  if (q) out = out.filter(row => row.title.toLowerCase().includes(q))
  const category = filters.category?.trim().toLowerCase()
  if (category) {
    out = out.filter((row) => {
      const meta = readEnvelope(row.content)?.meta ?? {}
      return String(meta.category ?? '').toLowerCase() === category
    })
  }
  return out
}

/** "Poster (copy) (copy)" collapses to "Poster (copy)". */
function duplicateTitle(title: string): string {
  return `${title.replace(/(?: \(copy\))+$/, '')} (copy)`
}

function toDesignRecord(row: TemplateRow & { assets?: Array<{ name: string; url: string }> }): DesignRecord {
  const envelope = readEnvelope(row.content) ?? { schema: ENVELOPE_SCHEMA, doc: null, meta: {} }
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    isPublic: row.isPublic,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    envelope,
    thumbnails: (row.assets ?? []).map(asset => ({ name: asset.name, url: asset.url })),
  }
}

function readEnvelope(raw: string): DesignEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const candidate = parsed as DesignEnvelope
    return candidate.schema === ENVELOPE_SCHEMA ? candidate : null
  } catch {
    return null
  }
}

function validateSave(input: SaveDesignInput) {
  if (!input.title || input.title.trim().length === 0) throw new ValidationError('Design title is required')
  if (input.title.length > 200) throw new ValidationError('Design title too long (≤200)')
  const envelope = envelopeString(input)
  if (envelope.length > MAX_ENVELOPE_BYTES) {
    throw new ValidationError(`Design document too large (${(envelope.length / 1048576).toFixed(1)} MB > 4 MB)`)
  }
}

export function envelopeString(input: SaveDesignInput): string {
  return JSON.stringify({
    schema: ENVELOPE_SCHEMA,
    doc: input.doc,
    meta: input.meta ?? {},
    savedAt: new Date().toISOString(),
  })
}

function normalizeColors(raw: unknown): Array<{ name: string; hex: string }> {
  const sanitized = sanitizeColors(raw)
  return sanitized.slice(0, BRAND_COLORS_MAX)
}

function sanitizeColors(raw: unknown): Array<{ name: string; hex: string }> {
  if (!raw || !Array.isArray(raw)) return []
  return (raw as unknown[]).slice(0, 12).map((entry) => {
    if (typeof entry === 'string') return { name: 'Color', hex: entry.slice(0, 32) }
    if (!entry || typeof entry !== 'object') return { name: 'Color', hex: '#ffffff' }
    const record = entry as Record<string, unknown>
    return { name: String(record.name ?? 'Color').slice(0, 24), hex: String(record.hex ?? '#ffffff').slice(0, 32) }
  })
}

function sanitizeFonts(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const key of ['heading', 'body']) {
    if (typeof (raw as Record<string, unknown>)[key] === 'string') out[key] = String((raw as Record<string, unknown>)[key]).slice(0, 64)
  }
  return out
}

function sanitizeUrlish(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (!/^(https?:\/\/|\/)/.test(raw)) return null
  return raw.slice(0, 600)
}

function brandError(error: unknown, action: string): ServiceResponse<BrandKit> {
  if (error instanceof ValidationError) return { success: false, error: error.message, code: 'VALIDATION' }
  return { success: false, error: `Failed to ${action} brand kit` }
}

export const designService = new DesignService()
export const brandKitService = new BrandKitService()

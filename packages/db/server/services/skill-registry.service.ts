import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import { and, desc, eq, isNull, or } from 'drizzle-orm'
import type { ServiceResponse } from './types'
import {
  CreateSkillSchema,
  UpdateSkillSchema,
  skillDefinitions,
  skillVersions,
  type CreateSkillData,
  type SkillDefinition,
  type UpdateSkillData,
} from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { requireBusinessAccess } from '../utils/business-access'

// Canonical DSH-exposed tool catalog (subset of the Python ToolManager).
// Privileged tools (execute_code, save_skill, skill imports, skill file
// reads) stay Nuxt-mediated and can never appear in a skill/agent scope.
// Parity with the manager + plugin is asserted in tests/api/test_dsh.py.
export const APPROVED_DSH_TOOLS: string[] = [
  'web_search',
  'scrape_url',
  'retrieve',
  'hybrid_search',
  'kb_ls',
  'kb_tree',
  'kb_grep',
  'kb_glob',
  'kb_read',
  'virality_check',
  'engagement_calc',
  'best_posts',
  'destructure_post',
  'apply_template',
  'list_skills',
  'load_skill',
  'generate_social_post',
  'generate_thread',
  'generate_hashtags',
]

export function validateToolScope(tools: unknown): { ok: boolean, denied: string[] } {
  if (!Array.isArray(tools)) return { ok: false, denied: ['allowedTools must be an array'] }
  const denied = tools.filter(tool => typeof tool !== 'string' || !APPROVED_DSH_TOOLS.includes(tool))
  return { ok: denied.length === 0, denied }
}

export function hashSkillContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

export interface RegistryScope {
  ownerUserId: string
  businessId: string | null
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function snapshotSkill(row: SkillDefinition): string {
  return JSON.stringify({
    name: row.name,
    slug: row.slug,
    description: row.description,
    instructions: row.instructions,
    inputSchema: row.inputSchema,
    outputSchema: row.outputSchema,
    allowedTools: row.allowedTools,
    sourceType: row.sourceType,
    version: row.version,
  })
}

export class SkillRegistryService {
  private db = useDrizzle()

  private async resolveScope(userId: string, businessId: string | null, event?: H3Event) {
    try {
      if (!businessId) return { success: true as const, data: { ownerUserId: userId, businessId: null } }
      const access = await requireBusinessAccess(event as H3Event, userId, businessId)
      if (!access.success || !access.data) {
        return { success: false as const, error: 'Business not found', code: 'NOT_FOUND' }
      }
      return { success: true as const, data: { ownerUserId: access.data.ownerUserId, businessId } }
    } catch {
      return { success: false as const, error: 'Failed to resolve registry scope' }
    }
  }

  private scopeFilter(scope: RegistryScope) {
    return scope.businessId
      ? and(eq(skillDefinitions.ownerUserId, scope.ownerUserId), eq(skillDefinitions.businessId, scope.businessId))
      : and(eq(skillDefinitions.ownerUserId, scope.ownerUserId), isNull(skillDefinitions.businessId))
  }

  private async findOwned(skillId: string, scope: RegistryScope): Promise<SkillDefinition | null> {
    const [row] = await this.db
      .select()
      .from(skillDefinitions)
      .where(and(eq(skillDefinitions.id, skillId), this.scopeFilter(scope)))
      .limit(1)
    return row ?? null
  }

  private async slugTaken(scope: RegistryScope, slug: string, exceptId?: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: skillDefinitions.id })
      .from(skillDefinitions)
      .where(and(eq(skillDefinitions.slug, slug), this.scopeFilter(scope)))
      .limit(2)
    return rows.some(row => row.id !== exceptId)
  }

  private async snapshotVersion(skill: SkillDefinition, actor: string): Promise<void> {
    await this.db.insert(skillVersions).values({
      id: crypto.randomUUID(),
      skillId: skill.id,
      version: skill.version,
      snapshot: snapshotSkill(skill),
      createdBy: actor,
    })
  }

  async createSkill(userId: string, data: CreateSkillData, event?: H3Event): Promise<ServiceResponse<SkillDefinition>> {
    try {
      const parsed = CreateSkillSchema.safeParse(data)
      if (!parsed.success) {
        return { success: false, error: 'Invalid skill definition', code: 'VALIDATION_ERROR' }
      }
      const scope = await this.resolveScope(userId, parsed.data.businessId ?? null, event)
      if (!scope.success) return scope
      const tools = validateToolScope(parsed.data.allowedTools)
      if (!tools.ok) {
        return { success: false, error: `Tools outside approved scope: ${tools.denied.join(', ')}`, code: 'VALIDATION_ERROR' }
      }
      const slug = parsed.data.slug || slugify(parsed.data.name)
      if (await this.slugTaken(scope.data, slug)) {
        return { success: false, error: 'Skill slug already exists in this scope', code: 'VALIDATION_ERROR' }
      }
      const now = new Date()
      const [created] = await this.db.insert(skillDefinitions).values({
        id: crypto.randomUUID(),
        ownerUserId: scope.data.ownerUserId,
        businessId: scope.data.businessId,
        ownerScope: parsed.data.ownerScope,
        name: parsed.data.name,
        slug,
        description: parsed.data.description,
        instructions: parsed.data.instructions,
        inputSchema: parsed.data.inputSchema,
        outputSchema: parsed.data.outputSchema,
        allowedTools: JSON.stringify(parsed.data.allowedTools),
        sourceType: parsed.data.sourceType,
        sourceUri: parsed.data.sourceUri ?? null,
        contentHash: hashSkillContent(parsed.data.instructions),
        version: 1,
        status: 'draft',
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      }).returning()
      await this.snapshotVersion(created, userId)
      return { success: true, data: created }
    } catch {
      return { success: false, error: 'Failed to create skill' }
    }
  }

  async updateSkill(userId: string, skillId: string, data: UpdateSkillData, businessId?: string | null, event?: H3Event): Promise<ServiceResponse<SkillDefinition>> {
    try {
      const parsed = UpdateSkillSchema.safeParse(data)
      if (!parsed.success) {
        return { success: false, error: 'Invalid skill update', code: 'VALIDATION_ERROR' }
      }
      const scope = await this.resolveScope(userId, businessId ?? null, event)
      if (!scope.success) return scope
      const owned = await this.findOwned(skillId, scope.data)
      if (!owned) {
        return { success: false, error: 'Skill not found', code: 'NOT_FOUND' }
      }
      if (owned.status !== 'draft') {
        return { success: false, error: 'Only draft skills can be edited', code: 'VALIDATION_ERROR' }
      }
      if (parsed.data.allowedTools) {
        const tools = validateToolScope(parsed.data.allowedTools)
        if (!tools.ok) {
          return { success: false, error: `Tools outside approved scope: ${tools.denied.join(', ')}`, code: 'VALIDATION_ERROR' }
        }
      }
      const patch = this.buildPatch(owned, parsed.data)
      const [updated] = await this.db
        .update(skillDefinitions)
        .set(patch)
        .where(eq(skillDefinitions.id, owned.id))
        .returning()
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to update skill' }
    }
  }

  private buildPatch(owned: SkillDefinition, data: UpdateSkillData): Partial<SkillDefinition> {
    const patch: Partial<SkillDefinition> = { updatedAt: new Date() }
    if (data.name !== undefined) patch.name = data.name
    if (data.slug !== undefined) patch.slug = data.slug || slugify(data.name ?? owned.name)
    if (data.description !== undefined) patch.description = data.description
    if (data.instructions !== undefined) {
      patch.instructions = data.instructions
      patch.contentHash = hashSkillContent(data.instructions)
    }
    if (data.inputSchema !== undefined) patch.inputSchema = data.inputSchema
    if (data.outputSchema !== undefined) patch.outputSchema = data.outputSchema
    if (data.allowedTools !== undefined) patch.allowedTools = JSON.stringify(data.allowedTools)
    return patch
  }

  async publishSkill(userId: string, skillId: string, businessId?: string | null, event?: H3Event): Promise<ServiceResponse<SkillDefinition>> {
    try {
      const scope = await this.resolveScope(userId, businessId ?? null, event)
      if (!scope.success) return scope
      const owned = await this.findOwned(skillId, scope.data)
      if (!owned) {
        return { success: false, error: 'Skill not found', code: 'NOT_FOUND' }
      }
      if (owned.status !== 'draft' && owned.status !== 'disabled') {
        return { success: false, error: 'Only draft or disabled skills can be published', code: 'VALIDATION_ERROR' }
      }
      const [published] = await this.db
        .update(skillDefinitions)
        .set({ status: 'active', version: owned.version + 1, updatedAt: new Date() })
        .where(eq(skillDefinitions.id, owned.id))
        .returning()
      await this.snapshotVersion(published, userId)
      return { success: true, data: published }
    } catch {
      return { success: false, error: 'Failed to publish skill' }
    }
  }

  async disableSkill(userId: string, skillId: string, businessId?: string | null, event?: H3Event): Promise<ServiceResponse<SkillDefinition>> {
    try {
      const scope = await this.resolveScope(userId, businessId ?? null, event)
      if (!scope.success) return scope
      const owned = await this.findOwned(skillId, scope.data)
      if (!owned) {
        return { success: false, error: 'Skill not found', code: 'NOT_FOUND' }
      }
      if (owned.status !== 'active') {
        return { success: false, error: 'Only active skills can be disabled', code: 'VALIDATION_ERROR' }
      }
      const [disabled] = await this.db
        .update(skillDefinitions)
        .set({ status: 'disabled', updatedAt: new Date() })
        .where(eq(skillDefinitions.id, owned.id))
        .returning()
      return { success: true, data: disabled }
    } catch {
      return { success: false, error: 'Failed to disable skill' }
    }
  }

  async deleteSkill(userId: string, skillId: string, businessId?: string | null, event?: H3Event): Promise<ServiceResponse<SkillDefinition>> {
    try {
      const scope = await this.resolveScope(userId, businessId ?? null, event)
      if (!scope.success) return scope
      const owned = await this.findOwned(skillId, scope.data)
      if (!owned) {
        return { success: false, error: 'Skill not found', code: 'NOT_FOUND' }
      }
      if (owned.status !== 'draft' && owned.status !== 'disabled') {
        return { success: false, error: 'Disable the skill before deleting it', code: 'VALIDATION_ERROR' }
      }
      const [deleted] = await this.db
        .delete(skillDefinitions)
        .where(eq(skillDefinitions.id, owned.id))
        .returning()
      return { success: true, data: deleted }
    } catch {
      return { success: false, error: 'Failed to delete skill' }
    }
  }

  async listSkills(userId: string, businessId?: string | null, event?: H3Event): Promise<ServiceResponse<SkillDefinition[]>> {
    try {
      const scope = await this.resolveScope(userId, businessId ?? null, event)
      if (!scope.success) return scope
      const rows = businessId
        ? await this.db
          .select()
          .from(skillDefinitions)
          .where(and(
            eq(skillDefinitions.ownerUserId, scope.data.ownerUserId),
            or(eq(skillDefinitions.businessId, businessId), isNull(skillDefinitions.businessId)),
          ))
          .orderBy(desc(skillDefinitions.updatedAt))
        : await this.db
          .select()
          .from(skillDefinitions)
          .where(this.scopeFilter(scope.data))
          .orderBy(desc(skillDefinitions.updatedAt))
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to list skills' }
    }
  }

  async resolveSkillVersion(skillId: string, version?: number | null) {
    try {
      const rows = await this.db
        .select()
        .from(skillVersions)
        .where(eq(skillVersions.skillId, skillId))
        .orderBy(desc(skillVersions.version))
        .limit(25)
      const match = version == null ? rows[0] : rows.find(row => row.version === version)
      if (!match) {
        return { success: false as const, error: 'Skill version not found', code: 'NOT_FOUND' }
      }
      return { success: true as const, data: { skillId, version: match.version, snapshot: JSON.parse(match.snapshot) } }
    } catch {
      return { success: false as const, error: 'Failed to resolve skill version' }
    }
  }
}

export const skillRegistryService = new SkillRegistryService()

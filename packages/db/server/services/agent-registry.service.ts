import type { H3Event } from 'h3'
import { and, desc, eq, isNull, or } from 'drizzle-orm'
import type { ServiceResponse } from './types'
import {
  CreateAgentSchema,
  UpdateAgentSchema,
  agentDefinitions,
  agentVersions,
  skillDefinitions,
  skillVersions,
  type AgentDefinition,
  type CreateAgentData,
  type UpdateAgentData,
} from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { requireBusinessAccess } from '../utils/business-access'
import {
  skillRegistryService,
  validateToolScope,
  type RegistryScope,
} from './skill-registry.service'

// Output kinds mirror the Python DSH runner contract
// (app/services/dsh/runner.py SUPPORTED_OUTPUT_KINDS).
export const AGENT_OUTPUT_KINDS: string[] = [
  'research_result',
  'social_post_draft',
  'humanized_social_post',
  'fabric_scene',
  'reel_storyboard',
  'approval_request',
  'publishing_intent',
]

export interface AgentRunSnapshot {
  agent: { agentId: string, version: number, snapshot: Record<string, unknown> }
  skills: Array<{ skillId: string, version: number, snapshot: Record<string, unknown> }>
}

interface BuiltinAgent {
  name: string
  description: string
  systemPrompt: string
  skills: string[]
  tools: string[]
  outputKind: string
  requiresHumanReview: boolean
}

const BUILTIN_AGENTS: BuiltinAgent[] = [
  {
    name: 'social-researcher',
    description: 'Researches topics, hooks, and proof from approved sources.',
    systemPrompt: 'You research content topics using only approved tools. Cite every source. Never invent proof, prices, URLs, or claims.',
    skills: ['social-research'],
    tools: ['web_search', 'scrape_url', 'retrieve', 'hybrid_search'],
    outputKind: 'research_result',
    requiresHumanReview: false,
  },
  {
    name: 'social-writer',
    description: 'Writes grounded social drafts from research results.',
    systemPrompt: 'You write social posts from the provided research and brand context. Stay in brand voice. Keep platform limits.',
    skills: ['social-writing'],
    tools: ['generate_social_post', 'generate_thread', 'generate_hashtags'],
    outputKind: 'social_post_draft',
    requiresHumanReview: false,
  },
  {
    name: 'human-sentiment-editor',
    description: 'Humanizes drafts: sentiment, rhythm, and readability edits.',
    systemPrompt: 'You edit drafts for human tone and sentiment without changing facts, claims, or structure. Never add new claims.',
    skills: ['humanizer'],
    tools: ['retrieve'],
    outputKind: 'humanized_social_post',
    requiresHumanReview: false,
  },
  {
    name: 'fabric-designer',
    description: 'Produces Fabric scene JSON for carousels and visuals.',
    systemPrompt: 'You output Fabric scene JSON only, honoring brand colors, fonts, and restrictions. Never output raw HTML.',
    skills: ['designer'],
    tools: ['retrieve'],
    outputKind: 'fabric_scene',
    requiresHumanReview: false,
  },
  {
    name: 'human-reviewer',
    description: 'Control-plane approval gate. Not a model agent: pauses the run for human approve / request-changes.',
    systemPrompt: 'GATE PROTOCOL: never generate content. Emit approval_request and wait for a human decision.',
    skills: [],
    tools: [],
    outputKind: 'approval_request',
    requiresHumanReview: true,
  },
]

const BUILTIN_SKILLS: Array<{ slug: string, name: string, description: string, instructions: string, tools: string[] }> = [
  {
    slug: 'social-research',
    name: 'Social research',
    description: 'Source-cited topic research with proof capture.',
    instructions: 'Search approved sources, capture quotes with URLs, flag unverified claims explicitly.',
    tools: ['web_search', 'scrape_url', 'retrieve'],
  },
  {
    slug: 'social-writing',
    name: 'Social writing',
    description: 'Brand-voiced social drafting from research.',
    instructions: 'Draft from research only. One idea per post. End with the configured CTA style.',
    tools: ['generate_social_post', 'generate_thread'],
  },
  {
    slug: 'humanizer',
    name: 'Humanizer',
    description: 'Sentiment and readability edits without new claims.',
    instructions: 'Vary rhythm, cut filler, keep every fact. If a claim lacks evidence, mark it for review.',
    tools: [],
  },
  {
    slug: 'designer',
    name: 'Designer',
    description: 'Fabric scene composition within brand constraints.',
    instructions: 'Compose scenes with brand colors and fonts. Respect image restrictions. 2-10 slides for carousels.',
    tools: ['retrieve'],
  },
]

function snapshotAgent(row: AgentDefinition): string {
  return JSON.stringify({
    name: row.name,
    description: row.description,
    systemPrompt: row.systemPrompt,
    skillVersionIds: row.skillVersionIds,
    allowedToolNames: row.allowedToolNames,
    outputKind: row.outputKind,
    outputSchema: row.outputSchema,
    maxSteps: row.maxSteps,
    maxChildAgents: row.maxChildAgents,
    requiresBusinessContext: row.requiresBusinessContext,
    requiresHumanReview: row.requiresHumanReview,
    version: row.version,
  })
}

export class AgentRegistryService {
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
      ? and(eq(agentDefinitions.ownerUserId, scope.ownerUserId), eq(agentDefinitions.businessId, scope.businessId))
      : and(eq(agentDefinitions.ownerUserId, scope.ownerUserId), isNull(agentDefinitions.businessId))
  }

  private async findOwned(agentId: string, scope: RegistryScope): Promise<AgentDefinition | null> {
    const [row] = await this.db
      .select()
      .from(agentDefinitions)
      .where(and(eq(agentDefinitions.id, agentId), this.scopeFilter(scope)))
      .limit(1)
    return row ?? null
  }

  private async snapshotVersion(agent: AgentDefinition, actor: string): Promise<void> {
    await this.db.insert(agentVersions).values({
      id: crypto.randomUUID(),
      agentId: agent.id,
      version: agent.version,
      snapshot: snapshotAgent(agent),
      createdBy: actor,
    })
  }

  private async validateRefs(data: { skillVersionIds?: string[], allowedToolNames?: string[], outputKind?: string }): Promise<{ ok: boolean, error?: string }> {
    const tools = validateToolScope(data.allowedToolNames ?? [])
    if (!tools.ok) {
      return { ok: false, error: `Tools outside approved scope: ${tools.denied.join(', ')}` }
    }
    if (data.outputKind && !AGENT_OUTPUT_KINDS.includes(data.outputKind)) {
      return { ok: false, error: `Unsupported output kind: ${data.outputKind}` }
    }
    for (const skillVersionId of data.skillVersionIds ?? []) {
      const parsed = this.parseSkillVersionId(skillVersionId)
      if (!parsed) {
        return { ok: false, error: `Invalid skill version reference: ${skillVersionId}` }
      }
      const resolved = await skillRegistryService.resolveSkillVersion(parsed.skillId, parsed.version)
      if (!resolved.success) {
        return { ok: false, error: `Unknown skill version: ${skillVersionId}` }
      }
    }
    return { ok: true }
  }

  private parseSkillVersionId(ref: string): { skillId: string, version: number | null } | null {
    const at = ref.lastIndexOf('@')
    if (at <= 0) return { skillId: ref, version: null }
    const version = Number(ref.slice(at + 1))
    if (!Number.isInteger(version) || version <= 0) return null
    return { skillId: ref.slice(0, at), version }
  }

  async createAgent(userId: string, data: CreateAgentData, event?: H3Event): Promise<ServiceResponse<AgentDefinition>> {
    try {
      const parsed = CreateAgentSchema.safeParse(data)
      if (!parsed.success) {
        return { success: false, error: 'Invalid agent definition', code: 'VALIDATION_ERROR' }
      }
      const refs = await this.validateRefs(parsed.data)
      if (!refs.ok) {
        return { success: false, error: refs.error ?? 'Invalid agent references', code: 'VALIDATION_ERROR' }
      }
      const scope = await this.resolveScope(userId, parsed.data.businessId ?? null, event)
      if (!scope.success) return scope
      const now = new Date()
      const [created] = await this.db.insert(agentDefinitions).values({
        id: crypto.randomUUID(),
        ownerUserId: scope.data.ownerUserId,
        businessId: scope.data.businessId,
        name: parsed.data.name,
        description: parsed.data.description,
        systemPrompt: parsed.data.systemPrompt,
        skillVersionIds: JSON.stringify(parsed.data.skillVersionIds),
        allowedToolNames: JSON.stringify(parsed.data.allowedToolNames),
        outputKind: parsed.data.outputKind,
        outputSchema: parsed.data.outputSchema,
        maxSteps: parsed.data.maxSteps,
        maxChildAgents: parsed.data.maxChildAgents,
        requiresBusinessContext: parsed.data.requiresBusinessContext,
        requiresHumanReview: parsed.data.requiresHumanReview,
        version: 1,
        status: 'draft',
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      }).returning()
      await this.snapshotVersion(created, userId)
      return { success: true, data: created }
    } catch {
      return { success: false, error: 'Failed to create agent' }
    }
  }

  async updateAgent(userId: string, agentId: string, data: UpdateAgentData, businessId?: string | null, event?: H3Event): Promise<ServiceResponse<AgentDefinition>> {
    try {
      const parsed = UpdateAgentSchema.safeParse(data)
      if (!parsed.success) {
        return { success: false, error: 'Invalid agent update', code: 'VALIDATION_ERROR' }
      }
      const refs = await this.validateRefs(parsed.data)
      if (!refs.ok) {
        return { success: false, error: refs.error ?? 'Invalid agent references', code: 'VALIDATION_ERROR' }
      }
      const scope = await this.resolveScope(userId, businessId ?? null, event)
      if (!scope.success) return scope
      const owned = await this.findOwned(agentId, scope.data)
      if (!owned) {
        return { success: false, error: 'Agent not found', code: 'NOT_FOUND' }
      }
      if (owned.status !== 'draft') {
        return { success: false, error: 'Only draft agents can be edited', code: 'VALIDATION_ERROR' }
      }
      const [updated] = await this.db
        .update(agentDefinitions)
        .set({ ...this.buildPatch(parsed.data), updatedAt: new Date() })
        .where(eq(agentDefinitions.id, owned.id))
        .returning()
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to update agent' }
    }
  }

  private buildPatch(data: UpdateAgentData): Partial<AgentDefinition> {
    const patch: Partial<AgentDefinition> = {}
    if (data.name !== undefined) patch.name = data.name
    if (data.description !== undefined) patch.description = data.description
    if (data.systemPrompt !== undefined) patch.systemPrompt = data.systemPrompt
    if (data.skillVersionIds !== undefined) patch.skillVersionIds = JSON.stringify(data.skillVersionIds)
    if (data.allowedToolNames !== undefined) patch.allowedToolNames = JSON.stringify(data.allowedToolNames)
    if (data.outputKind !== undefined) patch.outputKind = data.outputKind
    if (data.outputSchema !== undefined) patch.outputSchema = data.outputSchema
    if (data.maxSteps !== undefined) patch.maxSteps = data.maxSteps
    if (data.maxChildAgents !== undefined) patch.maxChildAgents = data.maxChildAgents
    if (data.requiresBusinessContext !== undefined) patch.requiresBusinessContext = data.requiresBusinessContext
    if (data.requiresHumanReview !== undefined) patch.requiresHumanReview = data.requiresHumanReview
    return patch
  }

  async publishAgent(userId: string, agentId: string, businessId?: string | null, event?: H3Event): Promise<ServiceResponse<AgentDefinition>> {
    try {
      const scope = await this.resolveScope(userId, businessId ?? null, event)
      if (!scope.success) return scope
      const owned = await this.findOwned(agentId, scope.data)
      if (!owned) {
        return { success: false, error: 'Agent not found', code: 'NOT_FOUND' }
      }
      if (owned.status !== 'draft' && owned.status !== 'disabled') {
        return { success: false, error: 'Only draft or disabled agents can be published', code: 'VALIDATION_ERROR' }
      }
      const [published] = await this.db
        .update(agentDefinitions)
        .set({ status: 'active', version: owned.version + 1, updatedAt: new Date() })
        .where(eq(agentDefinitions.id, owned.id))
        .returning()
      await this.snapshotVersion(published, userId)
      return { success: true, data: published }
    } catch {
      return { success: false, error: 'Failed to publish agent' }
    }
  }

  async disableAgent(userId: string, agentId: string, businessId?: string | null, event?: H3Event): Promise<ServiceResponse<AgentDefinition>> {
    try {
      const scope = await this.resolveScope(userId, businessId ?? null, event)
      if (!scope.success) return scope
      const owned = await this.findOwned(agentId, scope.data)
      if (!owned) {
        return { success: false, error: 'Agent not found', code: 'NOT_FOUND' }
      }
      if (owned.status !== 'active') {
        return { success: false, error: 'Only active agents can be disabled', code: 'VALIDATION_ERROR' }
      }
      const [disabled] = await this.db
        .update(agentDefinitions)
        .set({ status: 'disabled', updatedAt: new Date() })
        .where(eq(agentDefinitions.id, owned.id))
        .returning()
      return { success: true, data: disabled }
    } catch {
      return { success: false, error: 'Failed to disable agent' }
    }
  }

  async deleteAgent(userId: string, agentId: string, businessId?: string | null, event?: H3Event): Promise<ServiceResponse<AgentDefinition>> {
    try {
      const scope = await this.resolveScope(userId, businessId ?? null, event)
      if (!scope.success) return scope
      const owned = await this.findOwned(agentId, scope.data)
      if (!owned) {
        return { success: false, error: 'Agent not found', code: 'NOT_FOUND' }
      }
      if (owned.status !== 'draft' && owned.status !== 'disabled') {
        return { success: false, error: 'Disable the agent before deleting it', code: 'VALIDATION_ERROR' }
      }
      const [deleted] = await this.db
        .delete(agentDefinitions)
        .where(eq(agentDefinitions.id, owned.id))
        .returning()
      return { success: true, data: deleted }
    } catch {
      return { success: false, error: 'Failed to delete agent' }
    }
  }

  async listAgents(userId: string, businessId?: string | null, event?: H3Event): Promise<ServiceResponse<AgentDefinition[]>> {
    try {
      const scope = await this.resolveScope(userId, businessId ?? null, event)
      if (!scope.success) return scope
      const rows = businessId
        ? await this.db
          .select()
          .from(agentDefinitions)
          .where(and(
            eq(agentDefinitions.ownerUserId, scope.data.ownerUserId),
            or(eq(agentDefinitions.businessId, businessId), isNull(agentDefinitions.businessId)),
          ))
          .orderBy(desc(agentDefinitions.updatedAt))
        : await this.db
          .select()
          .from(agentDefinitions)
          .where(this.scopeFilter(scope.data))
          .orderBy(desc(agentDefinitions.updatedAt))
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to list agents' }
    }
  }

  async resolveAgentVersion(agentId: string, version?: number | null) {
    try {
      const rows = await this.db
        .select()
        .from(agentVersions)
        .where(eq(agentVersions.agentId, agentId))
        .orderBy(desc(agentVersions.version))
        .limit(25)
      const match = version == null ? rows[0] : rows.find(row => row.version === version)
      if (!match) {
        return { success: false as const, error: 'Agent version not found', code: 'NOT_FOUND' }
      }
      return { success: true as const, data: { agentId, version: match.version, snapshot: JSON.parse(match.snapshot) } }
    } catch {
      return { success: false as const, error: 'Failed to resolve agent version' }
    }
  }

  async resolveRunSnapshot(agentId: string, version?: number | null): Promise<ServiceResponse<AgentRunSnapshot>> {
    try {
      const agent = await this.resolveAgentVersion(agentId, version)
      if (!agent.success) return agent
      const skillRefs = this.skillRefsOf(agent.data.snapshot)
      const skills: AgentRunSnapshot['skills'] = []
      for (const ref of skillRefs) {
        const parsed = this.parseSkillVersionId(ref)
        if (!parsed) {
          return { success: false, error: `Invalid skill version reference: ${ref}`, code: 'VALIDATION_ERROR' }
        }
        const resolved = await skillRegistryService.resolveSkillVersion(parsed.skillId, parsed.version)
        if (!resolved.success || !resolved.data) {
          return { success: false, error: `Unknown skill version: ${ref}`, code: 'NOT_FOUND' }
        }
        skills.push(resolved.data)
      }
      return { success: true, data: { agent: agent.data, skills } }
    } catch {
      return { success: false, error: 'Failed to resolve run snapshot' }
    }
  }

  private skillRefsOf(snapshot: Record<string, unknown>): string[] {
    const raw = snapshot.skillVersionIds
    if (typeof raw === 'string') {
      try {
        const parsed: unknown = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
      } catch {
        return []
      }
    }
    return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : []
  }

  async ensureBuiltins(ownerUserId: string, businessId: string, actor: string, event?: H3Event): Promise<ServiceResponse<{ skills: number, agents: number }>> {
    try {
      const scope = await this.resolveScope(ownerUserId, businessId, event)
      if (!scope.success) return scope
      const seededSkills = await this.seedBuiltinSkills(scope.data, actor)
      const seededAgents = await this.seedBuiltinAgents(scope.data, actor)
      return { success: true, data: { skills: seededSkills, agents: seededAgents } }
    } catch {
      return { success: false, error: 'Failed to seed built-in agents' }
    }
  }

  private async seedBuiltinSkills(scope: RegistryScope, actor: string): Promise<number> {
    let created = 0
    for (const builtin of BUILTIN_SKILLS) {
      const [existing] = await this.db
        .select({ id: skillDefinitions.id })
        .from(skillDefinitions)
        .where(and(
          eq(skillDefinitions.slug, builtin.slug),
          eq(skillDefinitions.ownerUserId, scope.ownerUserId),
          scope.businessId ? eq(skillDefinitions.businessId, scope.businessId) : isNull(skillDefinitions.businessId),
        ))
        .limit(1)
      if (existing) continue
      const [row] = await this.db.insert(skillDefinitions).values({
        id: crypto.randomUUID(),
        ownerUserId: scope.ownerUserId,
        businessId: scope.businessId,
        ownerScope: scope.businessId ? 'business' : 'user',
        name: builtin.name,
        slug: builtin.slug,
        description: builtin.description,
        instructions: builtin.instructions,
        inputSchema: '{}',
        outputSchema: '{}',
        allowedTools: JSON.stringify(builtin.tools),
        sourceType: 'built_in',
        sourceUri: null,
        contentHash: builtin.slug,
        version: 1,
        status: 'active',
        createdBy: actor,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning()
      await this.db.insert(skillVersions).values({
        id: crypto.randomUUID(),
        skillId: row.id,
        version: 1,
        snapshot: JSON.stringify({ name: row.name, slug: row.slug, instructions: row.instructions, allowedTools: row.allowedTools, version: 1 }),
        createdBy: actor,
      })
      created += 1
    }
    return created
  }

  private async seedBuiltinAgents(scope: RegistryScope, actor: string): Promise<number> {
    let created = 0
    for (const builtin of BUILTIN_AGENTS) {
      const [existing] = await this.db
        .select({ id: agentDefinitions.id })
        .from(agentDefinitions)
        .where(and(
          eq(agentDefinitions.name, builtin.name),
          eq(agentDefinitions.ownerUserId, scope.ownerUserId),
          scope.businessId ? eq(agentDefinitions.businessId, scope.businessId) : isNull(agentDefinitions.businessId),
        ))
        .limit(1)
      if (existing) continue
      const skillVersionIds = await this.skillRefsFor(scope, builtin.skills)
      const [row] = await this.db.insert(agentDefinitions).values({
        id: crypto.randomUUID(),
        ownerUserId: scope.ownerUserId,
        businessId: scope.businessId,
        name: builtin.name,
        description: builtin.description,
        systemPrompt: builtin.systemPrompt,
        skillVersionIds: JSON.stringify(skillVersionIds),
        allowedToolNames: JSON.stringify(builtin.tools),
        outputKind: builtin.outputKind,
        outputSchema: '{}',
        maxSteps: 10,
        maxChildAgents: 2,
        requiresBusinessContext: true,
        requiresHumanReview: builtin.requiresHumanReview,
        version: 1,
        status: 'active',
        createdBy: actor,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning()
      await this.snapshotVersion(row, actor)
      created += 1
    }
    return created
  }

  private async skillRefsFor(scope: RegistryScope, slugs: string[]): Promise<string[]> {
    const refs: string[] = []
    for (const slug of slugs) {
      const [row] = await this.db
        .select({ id: skillDefinitions.id })
        .from(skillDefinitions)
        .where(and(
          eq(skillDefinitions.slug, slug),
          eq(skillDefinitions.ownerUserId, scope.ownerUserId),
          scope.businessId ? eq(skillDefinitions.businessId, scope.businessId) : isNull(skillDefinitions.businessId),
        ))
        .limit(1)
      if (row) refs.push(`${row.id}@1`)
    }
    return refs
  }
}

export const agentRegistryService = new AgentRegistryService()

import type { H3Event } from 'h3'
import { and, asc, desc, eq } from 'drizzle-orm'
import type { ServiceResponse } from './types'
import {
  contentArtifacts,
  contentChecks,
  contentItems,
  contentItemEvents,
  contentRuns,
  type ContentActorKind,
  type ContentCheck,
  type ContentCheckKind,
  type ContentCheckStatus,
  type ContentItem,
  type ContentItemEvent,
  type ContentItemState,
  type ContentRun,
} from '#layers/BaseDB/db/schema'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { requireBusinessAccess } from '../utils/business-access'

// PRD §6.1 state machine. Agents may advance a card up to review_required;
// only a human approval record may move review_required -> approved.
export const CONTENT_ITEM_TRANSITIONS: Record<ContentItemState, ContentItemState[]> = {
  idea: ['researching', 'drafting', 'failed', 'archived'],
  researching: ['research_ready', 'researching', 'failed', 'archived'],
  research_ready: ['drafting', 'researching', 'failed', 'archived'],
  drafting: ['review_required', 'failed', 'archived'],
  review_required: ['changes_requested', 'approved', 'failed', 'archived'],
  changes_requested: ['drafting', 'failed', 'archived'],
  approved: ['materializing', 'failed', 'archived'],
  materializing: ['ready', 'failed'],
  ready: ['scheduled', 'failed', 'archived'],
  scheduled: ['published', 'failed', 'archived'],
  published: ['archived'],
  failed: ['drafting', 'researching', 'archived'],
  archived: [],
}

export const AGENT_FORBIDDEN_TARGETS: ContentItemState[] = ['approved', 'scheduled', 'published', 'archived']

export function isValidTransition(from: ContentItemState, to: ContentItemState): boolean {
  return (CONTENT_ITEM_TRANSITIONS[from] ?? []).includes(to)
}

export function validateTransition(from: ContentItemState, to: ContentItemState, actorKind: ContentActorKind): { error: string, code: string } | null {
  if (!isValidTransition(from, to)) {
    return { error: `Invalid transition ${from} -> ${to}`, code: 'INVALID_TRANSITION' }
  }
  if (actorKind === 'agent' && AGENT_FORBIDDEN_TARGETS.includes(to)) {
    return { error: `Agent cannot move a card to ${to}; human approval is required`, code: 'HUMAN_ACTION_REQUIRED' }
  }
  return null
}

export interface ContentItemCreateData {
  title: string
  brief?: string
  platforms?: string[]
  sourceType?: 'trend' | 'manual' | 'template' | 'repurpose'
  sourceRef?: string | null
  templateId?: string | null
  priority?: number
  createdBy?: ContentActorKind
  createdByUserId?: string | null
}

export interface ContentItemUpdateData {
  title?: string
  brief?: string
  platforms?: string[]
  priority?: number
}

export interface ContentCardInput {
  title: string
  brief?: string
  platforms?: string[]
  sourceRef?: string | null
}

export interface ContentMoveOptions {
  actorKind: ContentActorKind
  actorUserId?: string | null
  payload?: Record<string, unknown> | null
}

export interface ContentEventOptions {
  event: string
  actorKind: ContentActorKind
  actorUserId?: string | null
  fromState?: ContentItemState | null
  toState?: ContentItemState | null
  payload?: Record<string, unknown> | null
}

export interface ContentCheckInput {
  kind: ContentCheckKind
  status: ContentCheckStatus
  score?: number | null
  findings?: Record<string, unknown> | null
}

export interface ContentRunInput {
  step: string
  status?: 'pending' | 'running' | 'completed' | 'failed'
  agentRunId?: string | null
  attempt?: number
  error?: string | null
}

export class ContentBoardService {
  private db = useDrizzle()

  private async resolveOwner(userId: string, businessId: string, event?: H3Event) {
    const access = await requireBusinessAccess(event as H3Event, userId, businessId)
    if (!access.success || !access.data) {
      return { success: false as const, error: 'Business not found', code: 'NOT_FOUND' }
    }
    return { success: true as const, data: access.data.ownerUserId }
  }

  private async findItem(businessId: string, itemId: string): Promise<ContentItem | null> {
    const [item] = await this.db
      .select()
      .from(contentItems)
      .where(and(eq(contentItems.id, itemId), eq(contentItems.businessId, businessId)))
      .limit(1)
    return item ?? null
  }

  private async appendEvent(item: ContentItem, data: ContentEventOptions): Promise<void> {
    await this.db.insert(contentItemEvents).values({
      id: crypto.randomUUID(),
      itemId: item.id,
      actorUserId: data.actorUserId ?? null,
      actorKind: data.actorKind,
      event: data.event,
      fromState: data.fromState ?? null,
      toState: data.toState ?? null,
      payload: data.payload ?? null,
    })
  }

  async list(
    userId: string,
    businessId: string,
    filters: { state?: ContentItemState, limit?: number } = {},
    event?: H3Event,
  ): Promise<ServiceResponse<ContentItem[]>> {
    try {
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner
      const scope = filters.state
        ? and(eq(contentItems.businessId, businessId), eq(contentItems.state, filters.state))
        : eq(contentItems.businessId, businessId)
      const rows = await this.db
        .select()
        .from(contentItems)
        .where(scope)
        .orderBy(desc(contentItems.updatedAt))
        .limit(filters.limit ?? 100)
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to list content items' }
    }
  }

  async get(userId: string, businessId: string, itemId: string, event?: H3Event): Promise<ServiceResponse<ContentItem>> {
    try {
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner
      const item = await this.findItem(businessId, itemId)
      if (!item) return { success: false, error: 'Content item not found', code: 'NOT_FOUND' }
      return { success: true, data: item }
    } catch {
      return { success: false, error: 'Failed to load content item' }
    }
  }

  async create(
    userId: string,
    businessId: string,
    data: ContentItemCreateData,
    event?: H3Event,
  ): Promise<ServiceResponse<ContentItem>> {
    try {
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner
      const [row] = await this.db.insert(contentItems).values({
        id: crypto.randomUUID(),
        businessId,
        ownerUserId: owner.data,
        title: data.title,
        brief: data.brief ?? '',
        platforms: data.platforms ?? [],
        sourceType: data.sourceType ?? 'manual',
        sourceRef: data.sourceRef ?? null,
        templateId: data.templateId ?? null,
        priority: data.priority ?? 0,
        createdBy: data.createdBy ?? 'user',
        createdByUserId: data.createdByUserId ?? userId,
      }).returning()
      await this.appendEvent(row, { event: 'created', actorKind: row.createdBy, actorUserId: row.createdByUserId, toState: row.state })
      return { success: true, data: row }
    } catch {
      return { success: false, error: 'Failed to create content item' }
    }
  }

  async addCards(
    userId: string,
    businessId: string,
    cards: ContentCardInput[],
    options: { sourceType?: ContentItemCreateData['sourceType'], actorKind?: ContentActorKind, actorUserId?: string | null } = {},
    event?: H3Event,
  ): Promise<ServiceResponse<ContentItem[]>> {
    try {
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner
      if (cards.length === 0) return { success: true, data: [] }
      const actorKind = options.actorKind ?? 'agent'
      const now = new Date()
      const rows = await this.db.insert(contentItems).values(cards.map(card => ({
        id: crypto.randomUUID(),
        businessId,
        ownerUserId: owner.data,
        title: card.title,
        brief: card.brief ?? '',
        platforms: card.platforms ?? [],
        sourceType: options.sourceType ?? 'manual',
        sourceRef: card.sourceRef ?? null,
        state: 'idea' as const,
        createdBy: actorKind,
        createdByUserId: options.actorUserId ?? null,
        createdAt: now,
        updatedAt: now,
      }))).returning()
      for (const row of rows) {
        await this.appendEvent(row, { event: 'created', actorKind, actorUserId: options.actorUserId ?? null, toState: row.state })
      }
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to add content cards' }
    }
  }

  async move(
    userId: string,
    businessId: string,
    itemId: string,
    toState: ContentItemState,
    options: ContentMoveOptions,
    event?: H3Event,
  ): Promise<ServiceResponse<{ item: ContentItem, from: ContentItemState, to: ContentItemState }>> {
    try {
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner

      const item = await this.findItem(businessId, itemId)
      if (!item) return { success: false, error: 'Content item not found', code: 'NOT_FOUND' }

      const invalid = validateTransition(item.state as ContentItemState, toState, options.actorKind)
      if (invalid) return { success: false, ...invalid }

      const gate = await this.artifactGate(item, toState)
      if (gate) return { success: false, error: gate.error, code: gate.code }

      const [updated] = await this.db
        .update(contentItems)
        .set({ state: toState, updatedAt: new Date(), lastError: null })
        .where(eq(contentItems.id, itemId))
        .returning()
      await this.appendEvent(updated, {
        event: 'state_changed',
        actorKind: options.actorKind,
        actorUserId: options.actorUserId ?? userId,
        fromState: item.state as ContentItemState,
        toState,
        payload: options.payload ?? null,
      })
      return { success: true, data: { item: updated, from: item.state as ContentItemState, to: toState } }
    } catch {
      return { success: false, error: 'Failed to move content item' }
    }
  }
  async remove(
    userId: string,
    businessId: string,
    itemId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<{ id: string }>> {
    try {
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner
      const item = await this.findItem(businessId, itemId)
      if (!item) return { success: false, error: 'Content item not found', code: 'NOT_FOUND' }
      await this.db.delete(contentItemEvents).where(eq(contentItemEvents.itemId, itemId))
      await this.db.delete(contentChecks).where(eq(contentChecks.itemId, itemId))
      await this.db.delete(contentRuns).where(eq(contentRuns.itemId, itemId))
      await this.db.delete(contentItems).where(eq(contentItems.id, itemId))
      return { success: true, data: { id: itemId } }
    } catch {
      return { success: false, error: 'Failed to delete content item' }
    }
  }

  async update(
    userId: string,
    businessId: string,
    itemId: string,
    patch: ContentItemUpdateData,
    options: { actorKind?: ContentActorKind, actorUserId?: string | null } = {},
    event?: H3Event,
  ): Promise<ServiceResponse<ContentItem>> {
    try {
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner

      const item = await this.findItem(businessId, itemId)
      if (!item) return { success: false, error: 'Content item not found', code: 'NOT_FOUND' }

      const [updated] = await this.db
        .update(contentItems)
        .set({
          title: patch.title ?? item.title,
          brief: patch.brief ?? item.brief,
          platforms: patch.platforms ?? item.platforms,
          priority: patch.priority ?? item.priority,
          updatedAt: new Date(),
        })
        .where(eq(contentItems.id, itemId))
        .returning()
      await this.appendEvent(updated, {
        event: 'updated',
        actorKind: options.actorKind ?? 'user',
        actorUserId: options.actorUserId ?? userId,
        payload: patch as Record<string, unknown>,
      })
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to update content item' }
    }
  }

  async listEvents(
    userId: string,
    businessId: string,
    itemId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<ContentItemEvent[]>> {
    try {
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner
      const item = await this.findItem(businessId, itemId)
      if (!item) return { success: false, error: 'Content item not found', code: 'NOT_FOUND' }
      const rows = await this.db
        .select()
        .from(contentItemEvents)
        .where(eq(contentItemEvents.itemId, itemId))
        .orderBy(asc(contentItemEvents.createdAt))
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to list content item events' }
    }
  }

  async listChecks(
    userId: string,
    businessId: string,
    itemId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<ContentCheck[]>> {
    try {
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner
      const item = await this.findItem(businessId, itemId)
      if (!item) return { success: false, error: 'Content item not found', code: 'NOT_FOUND' }
      const rows = await this.db
        .select()
        .from(contentChecks)
        .where(eq(contentChecks.itemId, itemId))
        .orderBy(desc(contentChecks.createdAt))
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to list content checks' }
    }
  }

  async recordCheck(
    userId: string,
    businessId: string,
    itemId: string,
    data: ContentCheckInput,
    event?: H3Event,
  ): Promise<ServiceResponse<ContentCheck>> {
    try {
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner
      const item = await this.findItem(businessId, itemId)
      if (!item) return { success: false, error: 'Content item not found', code: 'NOT_FOUND' }
      const [row] = await this.db.insert(contentChecks).values({
        id: crypto.randomUUID(),
        itemId,
        kind: data.kind,
        status: data.status,
        score: data.score ?? null,
        findings: data.findings ?? null,
      }).returning()
      return { success: true, data: row }
    } catch {
      return { success: false, error: 'Failed to record content check' }
    }
  }

  async linkArtifact(
    userId: string,
    businessId: string,
    itemId: string,
    artifactId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<ContentItem>> {
    try {
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner
      const item = await this.findItem(businessId, itemId)
      if (!item) return { success: false, error: 'Content item not found', code: 'NOT_FOUND' }
      const [updated] = await this.db
        .update(contentItems)
        .set({ artifactId, updatedAt: new Date() })
        .where(eq(contentItems.id, itemId))
        .returning()
      await this.appendEvent(updated, { event: 'artifact_linked', actorKind: 'agent', payload: { artifactId } })
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to link artifact' }
    }
  }

  async linkPost(
    userId: string,
    businessId: string,
    itemId: string,
    postId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<ContentItem>> {
    try {
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner
      const item = await this.findItem(businessId, itemId)
      if (!item) return { success: false, error: 'Content item not found', code: 'NOT_FOUND' }
      const [updated] = await this.db
        .update(contentItems)
        .set({ postId, updatedAt: new Date() })
        .where(eq(contentItems.id, itemId))
        .returning()
      await this.appendEvent(updated, { event: 'post_linked', actorKind: 'agent', payload: { postId } })
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to link post' }
    }
  }

  async recordRun(
    userId: string,
    businessId: string,
    itemId: string,
    data: ContentRunInput,
    event?: H3Event,
  ): Promise<ServiceResponse<ContentRun>> {
    try {
      const owner = await this.resolveOwner(userId, businessId, event)
      if (!owner.success) return owner
      const item = await this.findItem(businessId, itemId)
      if (!item) return { success: false, error: 'Content item not found', code: 'NOT_FOUND' }
      const status = data.status ?? 'completed'
      const [row] = await this.db.insert(contentRuns).values({
        id: crypto.randomUUID(),
        itemId,
        agentRunId: data.agentRunId ?? null,
        step: data.step,
        status,
        attempt: data.attempt ?? 1,
        error: data.error ?? null,
        completedAt: status === 'completed' || status === 'failed' ? new Date() : null,
      }).returning()
      return { success: true, data: row }
    } catch {
      return { success: false, error: 'Failed to record content run' }
    }
  }

  private async artifactGate(item: ContentItem, toState: ContentItemState): Promise<{ error: string, code: string } | null> {
    if (toState === 'ready' && !item.artifactId) {
      return { error: 'Materialize an artifact before marking ready', code: 'ARTIFACT_REQUIRED' }
    }
    if (!['approved', 'scheduled', 'published'].includes(toState)) return null
    if (!item.artifactId) return { error: 'An approved artifact version is required', code: 'ARTIFACT_REQUIRED' }
    const [artifact] = await this.db
      .select()
      .from(contentArtifacts)
      .where(eq(contentArtifacts.id, item.artifactId))
      .limit(1)
    if (!artifact || artifact.status !== 'approved') {
      return { error: 'Artifact is not approved', code: 'ARTIFACT_NOT_APPROVED' }
    }
    return null
  }
}

export const contentBoardService = new ContentBoardService()

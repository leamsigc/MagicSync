import type { H3Event } from 'h3'
import { and, desc, eq, isNull, notExists } from 'drizzle-orm'
import type { ServiceResponse } from './types'
import {
  EditArtifactSchema,
  ReviewArtifactSchema,
  SubmitArtifactSchema,
  approvalRecords,
  contentArtifacts,
  type ApprovalRecord,
  type ArtifactStatus,
  type ArtifactRevision,
  type ContentArtifact,
  type EditArtifactData,
  type ReviewArtifactData,
  type SubmitArtifactData,
} from '#layers/BaseDB/db/schema'
import { validateArtifactOutput } from '#layers/BaseDB/db/content/contracts'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { requireBusinessAccess } from '../utils/business-access'
import { postService } from './post.service'
import { carouselService } from './carousel.service'
import { socialMediaAccountService } from './social-media-account.service'
import {
  checkInstagramBounds,
  validateFabricScene,
} from '../utils/fabric-scene-validate'

export interface MaterializeResult {
  artifact: ContentArtifact
  postId: string | null
  duplicate: boolean
}

export type ArtifactListItem = Omit<ContentArtifact, 'revisions'>

function artifactScope(businessId: string, ownerUserId: string) {
  return and(
    eq(contentArtifacts.businessId, businessId),
    eq(contentArtifacts.ownerUserId, ownerUserId),
  )
}

function revisionsOf(row: ContentArtifact): ArtifactRevision[] {
  return Array.isArray(row.revisions) ? row.revisions : []
}

function revisionSnapshot(row: ContentArtifact): ArtifactRevision {
  return {
    version: row.version,
    output: row.output,
    status: row.status,
    postId: row.postId,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt.toISOString(),
  }
}

function capRevisions(revisions: ArtifactRevision[]): ArtifactRevision[] {
  if (revisions.length <= 20) return revisions
  return revisions.slice(revisions.length - 20)
}

/** The materialized post body: the long-form article when present, else the caption. */
function captionOf(output: Record<string, unknown>): string {
  const article = typeof output.article === 'string' ? output.article : ''
  if (article) return article
  return typeof output.caption === 'string' ? output.caption : ''
}

interface StoryboardOutput {
  caption?: string
  scenes?: Array<{ assetRef?: string, assetRefs?: string[], narration?: string, voiceover?: string, sceneText?: string }>
  assetRefs?: string[]
}

function isStoryboardOutput(value: unknown): value is StoryboardOutput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (record.caption !== undefined && typeof record.caption !== 'string') return false
  if (record.assetRefs !== undefined && (!Array.isArray(record.assetRefs) || !record.assetRefs.every(ref => typeof ref === 'string'))) return false
  if (record.scenes === undefined) return true
  if (!Array.isArray(record.scenes)) return false
  return record.scenes.every(scene => {
    if (!scene || typeof scene !== 'object' || Array.isArray(scene)) return false
    const item = scene as Record<string, unknown>
    return ['assetRef', 'narration', 'voiceover', 'sceneText'].every(key => item[key] === undefined || typeof item[key] === 'string')
      && (item.assetRefs === undefined || (Array.isArray(item.assetRefs) && item.assetRefs.every(ref => typeof ref === 'string')))
  })
}

function isCarouselOutput(value: unknown): value is { slides?: Array<{ scene?: unknown, altText?: string, templateKey?: string }> } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const slides = (value as Record<string, unknown>).slides
  if (slides === undefined) return true
  if (!Array.isArray(slides)) return false
  return slides.every(slide => {
    if (!slide || typeof slide !== 'object' || Array.isArray(slide)) return false
    const record = slide as Record<string, unknown>
    return (record.altText === undefined || typeof record.altText === 'string')
      && (record.templateKey === undefined || typeof record.templateKey === 'string')
  })
}

function platformsOf(output: Record<string, unknown>): string[] {
  const variants = output.platformVariants
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return []
  return Object.keys(variants as Record<string, unknown>)
}

/**
 * Complete draft-post input for postService.create (PostCreateBase requires
 * every column; create() only reads business/content/schedule/targets).
 */
export function newDraftPostInput(businessId: string, content: string, targetPlatforms: string[]) {
  return {
    businessId,
    content,
    status: 'draft' as const,
    scheduledAt: new Date(),
    targetPlatforms,
    mediaAssets: [] as string[],
    comment: [] as string[],
    postFormat: 'post' as const,
    platformContent: null,
    platformSettings: null,
    retryCount: 0,
    nextRetryAt: null,
    lastError: null,
    autoRepost: null,
    repostCount: 0,
    repostParentId: null,
  }
}

/**
 * Resolve platform names to connected account IDs. Drafts require at least
 * one target, so variant-less artifacts target every connected account.
 */
export async function resolveTargetAccountIds(businessId: string, platforms: string[]): Promise<ServiceResponse<string[]>> {
  try {
    const accounts = await socialMediaAccountService.getAccountsByBusinessId(businessId)
    const matching = platforms.length > 0
      ? accounts.filter(account => platforms.includes(account.platform ?? ''))
      : accounts
    const ids = matching.map(account => account.id)
    if (ids.length === 0) {
      return { success: false, error: 'No connected accounts for the target platforms', code: 'VALIDATION_ERROR' }
    }
    return { success: true, data: ids }
  } catch {
    return { success: false, error: 'Failed to resolve target accounts' }
  }
}

/**
 * Validate that explicit target account IDs all belong to the business.
 * Delivery must never fall back to "all connected accounts": the caller
 * passes the exact account selection from the distribution UI.
 */
export async function resolveExplicitAccountIds(businessId: string, targetAccountIds: string[]): Promise<ServiceResponse<string[]>> {
  if (!Array.isArray(targetAccountIds) || targetAccountIds.length === 0) {
    return { success: false, error: 'At least one target account is required', code: 'VALIDATION_ERROR' }
  }
  try {
    const accounts = await socialMediaAccountService.getAccountsByBusinessId(businessId)
    const owned = new Set(accounts.map(account => account.id))
    const unknown = targetAccountIds.filter(id => !owned.has(id))
    if (unknown.length > 0) {
      return { success: false, error: 'Target accounts must belong to this business', code: 'VALIDATION_ERROR' }
    }
    return { success: true, data: [...new Set(targetAccountIds)] }
  } catch {
    return { success: false, error: 'Failed to resolve target accounts' }
  }
}

export class ContentArtifactService {
  private db = useDrizzle()

  private async scopedOwner(userId: string, businessId: string, event?: H3Event) {
    try {
      const access = await requireBusinessAccess(event as H3Event, userId, businessId)
      if (!access.success || !access.data) {
        return { success: false as const, error: 'Business not found', code: 'NOT_FOUND' }
      }
      return { success: true as const, data: access.data.ownerUserId }
    } catch {
      return { success: false as const, error: 'Failed to verify business access' }
    }
  }

  private async findArtifact(id: string, ownerUserId: string, businessId: string): Promise<ContentArtifact | null> {
    const [row] = await this.db
      .select()
      .from(contentArtifacts)
      .where(and(eq(contentArtifacts.id, id), artifactScope(businessId, ownerUserId)))
      .limit(1)
    return row ?? null
  }

  async submitArtifact(
    userId: string,
    data: SubmitArtifactData,
    event?: H3Event,
  ): Promise<ServiceResponse<ContentArtifact>> {
    try {
      const parsed = SubmitArtifactSchema.safeParse(data)
      if (!parsed.success) {
        return { success: false, error: 'Invalid artifact payload', code: 'VALIDATION_ERROR' }
      }
      const owner = await this.scopedOwner(userId, parsed.data.businessId, event)
      if (!owner.success) return owner
      const contract = validateArtifactOutput(parsed.data.outputKind, parsed.data.output)
      if (!contract.ok) {
        return { success: false, error: contract.error ?? 'Invalid artifact output', code: 'VALIDATION_ERROR' }
      }
      const now = new Date()
      const [created] = await this.db.insert(contentArtifacts).values({
        id: crypto.randomUUID(),
        ownerUserId: owner.data,
        businessId: parsed.data.businessId,
        runId: parsed.data.runId ?? null,
        threadId: parsed.data.threadId ?? null,
        kind: parsed.data.kind,
        outputKind: parsed.data.outputKind,
        version: 1,
        status: 'review_required',
        output: JSON.stringify(parsed.data.output),
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      }).returning()
      return { success: true, data: created }
    } catch (error) {
      log.error({ message: 'contentArtifactService.submitArtifact failed', error: String(error) })
      return { success: false, error: 'Failed to submit artifact' }
    }
  }

  async getArtifact(userId: string, id: string, businessId: string, event?: H3Event) {
    try {
      const owner = await this.scopedOwner(userId, businessId, event)
      if (!owner.success) return owner
      const row = await this.findArtifact(id, owner.data, businessId)
      if (!row) {
        return { success: false as const, error: 'Artifact not found', code: 'NOT_FOUND' }
      }
      return { success: true as const, data: row }
    } catch {
      return { success: false as const, error: 'Failed to fetch artifact' }
    }
  }

  async listArtifacts(
    userId: string,
    filters: { businessId: string, threadId?: string | null, runId?: string | null },
    event?: H3Event,
  ): Promise<ServiceResponse<ArtifactListItem[]>> {
    try {
      const owner = await this.scopedOwner(userId, filters.businessId, event)
      if (!owner.success) return owner
      const conditions = [artifactScope(filters.businessId, owner.data)]
      if (filters.threadId) conditions.push(eq(contentArtifacts.threadId, filters.threadId))
      if (filters.runId) conditions.push(eq(contentArtifacts.runId, filters.runId))
      // `revisions` was added after the original artifact table. The list
      // surface does not need it, so keep this read compatible with databases
      // that have the original table while the migration is being applied.
      const rows = await this.db
        .select({
          id: contentArtifacts.id,
          ownerUserId: contentArtifacts.ownerUserId,
          businessId: contentArtifacts.businessId,
          runId: contentArtifacts.runId,
          threadId: contentArtifacts.threadId,
          kind: contentArtifacts.kind,
          outputKind: contentArtifacts.outputKind,
          version: contentArtifacts.version,
          status: contentArtifacts.status,
          output: contentArtifacts.output,
          postId: contentArtifacts.postId,
          createdBy: contentArtifacts.createdBy,
          createdAt: contentArtifacts.createdAt,
          updatedAt: contentArtifacts.updatedAt,
        })
        .from(contentArtifacts)
        .where(and(...conditions))
        .orderBy(desc(contentArtifacts.updatedAt))
        .limit(50)
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to list artifacts', code: 'SERVICE_UNAVAILABLE' }
    }
  }

  async editArtifact(
    userId: string,
    id: string,
    businessId: string,
    data: EditArtifactData,
    event?: H3Event,
  ): Promise<ServiceResponse<ContentArtifact>> {
    try {
      const parsed = EditArtifactSchema.safeParse(data)
      if (!parsed.success) {
        return { success: false, error: 'Invalid artifact edit', code: 'VALIDATION_ERROR' }
      }
      const current = await this.getArtifact(userId, id, businessId, event)
      if (!current.success) return current
      const invalid = this.validateEdit(current.data, parsed.data)
      if (invalid) return invalid
      return await this.persistEdit(current.data, parsed.data)
    } catch {
      return { success: false, error: 'Failed to edit artifact' }
    }
  }

  private validateEdit(current: ContentArtifact, data: EditArtifactData): ServiceResponse<ContentArtifact> | null {
    if (current.version !== data.version) {
      return { success: false, error: 'Artifact changed since edit started', code: 'VERSION_CONFLICT' }
    }
    if (current.postId !== null || ['generating', 'draft', 'scheduled', 'published', 'archived'].includes(current.status)) {
      return { success: false, error: 'Materialized or delivered artifacts cannot be edited', code: 'VALIDATION_ERROR' }
    }
    const contract = validateArtifactOutput(current.outputKind, data.output)
    if (!contract.ok) {
      return { success: false, error: contract.error ?? 'Invalid artifact output', code: 'VALIDATION_ERROR' }
    }
    return null
  }

  private async persistEdit(artifact: ContentArtifact, data: EditArtifactData): Promise<ServiceResponse<ContentArtifact>> {
    const history = capRevisions([...revisionsOf(artifact), revisionSnapshot(artifact)])
    const [updated] = await this.db
      .update(contentArtifacts)
      .set({
        output: JSON.stringify(data.output),
        version: artifact.version + 1,
        status: 'review_required',
        revisions: history,
        updatedAt: new Date(),
      })
      .where(and(
        eq(contentArtifacts.id, artifact.id),
        eq(contentArtifacts.version, data.version),
        eq(contentArtifacts.status, artifact.status),
        isNull(contentArtifacts.postId),
      ))
      .returning()
    if (!updated) {
      return { success: false, error: 'Artifact changed since edit started', code: 'VERSION_CONFLICT' }
    }
    return { success: true, data: updated }
  }

  async reviewArtifact(
    userId: string,
    id: string,
    businessId: string,
    data: ReviewArtifactData,
    event?: H3Event,
  ): Promise<ServiceResponse<{ artifact: ContentArtifact, record: ApprovalRecord }>> {
    try {
      const parsed = ReviewArtifactSchema.safeParse(data)
      if (!parsed.success) {
        return { success: false, error: 'Invalid review payload', code: 'VALIDATION_ERROR' }
      }
      const current = await this.getArtifact(userId, id, businessId, event)
      if (!current.success) return current
      if (current.data.version !== parsed.data.version) {
        return { success: false, error: 'Artifact changed since review started', code: 'VERSION_CONFLICT' }
      }
      if (!['review_required', 'changes_requested'].includes(current.data.status)) {
        return { success: false, error: 'Artifact is not awaiting review', code: 'VALIDATION_ERROR' }
      }
      return await this.persistReview(userId, current.data, parsed.data)
    } catch {
      return { success: false, error: 'Failed to record review' }
    }
  }

  private async persistReview(
    userId: string,
    artifact: ContentArtifact,
    data: ReviewArtifactData,
  ): Promise<ServiceResponse<{ artifact: ContentArtifact, record: ApprovalRecord }>> {
    return this.db.transaction(async (tx) => {
      const priorReview = tx.select({ id: approvalRecords.id }).from(approvalRecords).where(and(
        eq(approvalRecords.artifactId, artifact.id),
        eq(approvalRecords.version, data.version),
      ))
      const [updated] = await tx.update(contentArtifacts)
        .set({ status: data.decision, updatedAt: new Date() })
        .where(and(
          eq(contentArtifacts.id, artifact.id),
          eq(contentArtifacts.version, data.version),
          eq(contentArtifacts.status, artifact.status),
          isNull(contentArtifacts.postId),
          notExists(priorReview),
        ))
        .returning()
      if (!updated) {
        return { success: false, error: 'Artifact changed since review started', code: 'VERSION_CONFLICT' }
      }
      const [record] = await tx.insert(approvalRecords).values({
        id: crypto.randomUUID(),
        artifactId: artifact.id,
        runId: artifact.runId,
        threadId: artifact.threadId,
        decision: data.decision,
        feedback: data.feedback,
        actor: userId,
        version: data.version,
      }).returning()
      return { success: true, data: { artifact: updated, record } }
    })
  }

  async deleteArtifact(
    userId: string,
    id: string,
    businessId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<{ id: string }>> {
    try {
      const current = await this.getArtifact(userId, id, businessId, event)
      if (!current.success) return current
      if (current.data.postId || ['scheduled', 'published', 'archived'].includes(current.data.status)) {
        return { success: false, error: 'Delivered artifacts cannot be deleted from chat', code: 'ACTION_NOT_SUPPORTED' }
      }
      await this.db.delete(approvalRecords).where(eq(approvalRecords.artifactId, id))
      const [deleted] = await this.db.delete(contentArtifacts)
        .where(and(eq(contentArtifacts.id, id), artifactScope(businessId, current.data.ownerUserId), isNull(contentArtifacts.postId)))
        .returning({ id: contentArtifacts.id })
      if (!deleted) return { success: false, error: 'Artifact changed before deletion', code: 'VERSION_CONFLICT' }
      return { success: true, data: deleted }
    } catch {
      return { success: false, error: 'Failed to delete artifact' }
    }
  }

  async materializeArtifact(
    userId: string,
    id: string,
    businessId: string,
    event?: H3Event,
    targetAccountIds?: string[],
  ): Promise<ServiceResponse<MaterializeResult>> {
    try {
      const current = await this.getArtifact(userId, id, businessId, event)
      if (!current.success) return current
      const targets = await this.resolveArtifactTargets(current.data, targetAccountIds)
      if (!targets.success) return targets
      return await this.materializeWithTargets(userId, current.data, targets.data)
    } catch {
      return { success: false, error: 'Failed to materialize artifact' }
    }
  }

  private async resolveArtifactTargets(artifact: ContentArtifact, targetAccountIds?: string[]): Promise<ServiceResponse<string[]>> {
    if (targetAccountIds !== undefined) {
      return resolveExplicitAccountIds(artifact.businessId, targetAccountIds)
    }
    const parsed: unknown = JSON.parse(artifact.output)
    const output = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
    return resolveTargetAccountIds(artifact.businessId, platformsOf(output))
  }

  private async materializeWithTargets(userId: string, artifact: ContentArtifact, targetAccountIds: string[]): Promise<ServiceResponse<MaterializeResult>> {
    if (artifact.postId) {
      return { success: true, data: { artifact, postId: artifact.postId, duplicate: true } }
    }
    if (artifact.status !== 'approved') {
      return { success: false, error: 'Artifact must be approved before materialization', code: 'VALIDATION_ERROR' }
    }
    const materializers = {
      social_post: this.materializePost.bind(this),
      carousel: this.materializeCarousel.bind(this),
      reel_storyboard: this.materializeReel.bind(this),
    }
    const materialize = materializers[artifact.kind as keyof typeof materializers]
    if (!materialize) {
      return { success: false, error: `Materialization for '${artifact.kind}' lands in its delivery phase`, code: 'ACTION_NOT_SUPPORTED' }
    }
    const [claimed] = await this.db.update(contentArtifacts)
      .set({ status: 'generating', updatedAt: new Date() })
      .where(and(eq(contentArtifacts.id, artifact.id), eq(contentArtifacts.version, artifact.version), eq(contentArtifacts.status, 'approved'), isNull(contentArtifacts.postId)))
      .returning()
    if (!claimed) {
      return { success: false, error: 'Artifact changed before materialization', code: 'VERSION_CONFLICT' }
    }
    try {
      return await materialize(userId, artifact.businessId, artifact, targetAccountIds)
    } finally {
      await this.db.update(contentArtifacts).set({ status: 'approved' })
        .where(and(eq(contentArtifacts.id, artifact.id), eq(contentArtifacts.version, artifact.version), eq(contentArtifacts.status, 'generating'), isNull(contentArtifacts.postId)))
    }
  }

  private async materializePost(
    userId: string,
    businessId: string,
    artifact: ContentArtifact,
    targetAccountIds: string[],
  ): Promise<ServiceResponse<MaterializeResult>> {
    try {
      const parsed: unknown = JSON.parse(artifact.output)
      const output = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {}
      const caption = captionOf(output)
      if (!caption.trim()) {
        return { success: false, error: 'Artifact has no caption to materialize', code: 'VALIDATION_ERROR' }
      }
      const created = await postService.create(userId, {
        ...newDraftPostInput(businessId, caption, targetAccountIds),
      })
      if (!created.success || !created.data) {
        return { success: false, error: created.error ?? 'Failed to create draft post' }
      }
      const updated = await this.linkPost(artifact.id, created.data.id, 'draft')
      if (!updated) {
        return { success: false, error: 'Failed to link materialized post' }
      }
      return { success: true, data: { artifact: updated, postId: created.data.id, duplicate: false } }
    } catch {
      return { success: false, error: 'Failed to materialize post' }
    }
  }

  private async linkPost(artifactId: string, postId: string, status: ArtifactStatus): Promise<ContentArtifact | null> {
    const [updated] = await this.db
      .update(contentArtifacts)
      .set({ postId, status, updatedAt: new Date() })
      .where(eq(contentArtifacts.id, artifactId))
      .returning()
    return updated ?? null
  }

  private validateCarouselOutput(output: {
    slides?: Array<{ scene?: unknown, altText?: string, templateKey?: string }>,
  }): string | null {
    const scenes = Array.isArray(output.slides) ? output.slides : []
    const boundsError = checkInstagramBounds(scenes.length)
    if (boundsError) return boundsError
    const sceneCheck = validateFabricScene({ width: 1080, height: 1350, slides: output.slides ?? [] })
    if (!sceneCheck.ok) return sceneCheck.issues[0]?.message ?? 'Invalid scene'
    return null
  }

  private async createCarouselPost(
    userId: string,
    businessId: string,
    artifactId: string,
    scenes: Array<{ scene?: unknown, altText?: string, templateKey?: string }>,
    targetAccountIds: string[],
  ): Promise<ServiceResponse<{ postId: string }>> {
    try {
      const deckId = crypto.randomUUID()
      const deck = await carouselService.upsert(userId, deckId, {
        name: `Artifact ${artifactId.slice(0, 8)}`,
        slides: scenes.map((slide, index) => ({
          id: `slide-${index + 1}`,
          templateKey: slide.templateKey || 'title-kicker',
          data: { headline: slide.altText || `Slide ${index + 1}` },
          pattern: 'none',
          patternColor: '#000000',
          patternOpacity: 0,
          bgImage: null,
          customHtml: '',
        })),
        palette: { bg: '#0f0e0d', text: '#fafaf9', accent: '#f97316' },
        scene: scenes.map((slide, index) => ({ slideId: `slide-${index + 1}`, scene: slide.scene ?? {} })),
      })
      if (!deck.success || !deck.data) {
        return { success: false, error: deck.error ?? 'Failed to create carousel deck' }
      }
      const created = await postService.create(userId, {
        ...newDraftPostInput(businessId, `Carousel: ${deck.data.name} (${scenes.length} slides)`, targetAccountIds),
      })
      if (!created.success || !created.data) {
        return { success: false, error: created.error ?? 'Failed to create draft post' }
      }
      return { success: true, data: { postId: created.data.id } }
    } catch {
      return { success: false, error: 'Failed to materialize carousel' }
    }
  }

  private async materializeCarousel(
    userId: string,
    businessId: string,
    artifact: ContentArtifact,
    targetAccountIds: string[],
  ): Promise<ServiceResponse<MaterializeResult>> {
    try {
      const parsed: unknown = JSON.parse(artifact.output)
      if (!isCarouselOutput(parsed)) {
        return { success: false, error: 'Artifact carousel output is invalid', code: 'VALIDATION_ERROR' }
      }
      // Bounds and scene safety are enforced before any side effect.
      const invalid = this.validateCarouselOutput(parsed)
      if (invalid) {
        return { success: false, error: invalid, code: 'VALIDATION_ERROR' }
      }
      const scenes = Array.isArray(parsed.slides) ? parsed.slides : []
      const created = await this.createCarouselPost(userId, businessId, artifact.id, scenes, targetAccountIds)
      if (!created.success || !created.data) {
        return { success: false, error: created.error ?? 'Failed to materialize carousel' }
      }
      const updated = await this.linkPost(artifact.id, created.data.postId, 'draft')
      if (!updated) {
        return { success: false, error: 'Failed to link materialized post' }
      }
      return { success: true, data: { artifact: updated, postId: created.data.postId, duplicate: false } }
    } catch {
      return { success: false, error: 'Failed to materialize carousel' }
    }
  }

  private orderedReelAssets(output: {
    scenes?: Array<{ assetRef?: string, assetRefs?: string[] }>,
    assetRefs?: string[],
  }): string[] {
    const ordered: string[] = []
    for (const scene of output.scenes ?? []) {
      for (const ref of [...(scene.assetRefs ?? []), ...(scene.assetRef ? [scene.assetRef] : [])]) {
        if (ref && !ordered.includes(ref)) ordered.push(ref)
      }
    }
    for (const ref of output.assetRefs ?? []) {
      if (ref && !ordered.includes(ref)) ordered.push(ref)
    }
    return ordered
  }

  private reelCaption(
    output: { caption?: string },
    scenes: Array<{ sceneText?: string, voiceover?: string, narration?: string }>,
  ): string {
    if (typeof output.caption === 'string' && output.caption.trim()) return output.caption.trim()
    const fallback = scenes
      .map(scene => scene.sceneText || scene.voiceover || scene.narration || '')
      .filter(Boolean)
      .join('\n')
    return fallback || 'Reel storyboard'
  }

  private async materializeReel(
    userId: string,
    businessId: string,
    artifact: ContentArtifact,
    targetAccountIds: string[],
  ): Promise<ServiceResponse<MaterializeResult>> {
    try {
      const parsed: unknown = JSON.parse(artifact.output)
      if (!isStoryboardOutput(parsed)) {
        return { success: false, error: 'Artifact storyboard output is invalid', code: 'VALIDATION_ERROR' }
      }
      const scenes = Array.isArray(parsed.scenes) ? parsed.scenes : []
      if (scenes.length === 0) {
        return { success: false, error: 'Storyboard has no scenes', code: 'VALIDATION_ERROR' }
      }
      const created = await postService.create(userId, {
        ...newDraftPostInput(businessId, this.reelCaption(parsed, scenes), targetAccountIds),
        mediaAssets: this.orderedReelAssets(parsed),
      })
      if (!created.success || !created.data) {
        return { success: false, error: created.error ?? 'Failed to create draft post' }
      }
      const updated = await this.linkPost(artifact.id, created.data.id, 'draft')
      if (!updated) {
        return { success: false, error: 'Failed to link materialized post' }
      }
      return { success: true, data: { artifact: updated, postId: created.data.id, duplicate: false } }
    } catch {
      return { success: false, error: 'Failed to materialize reel storyboard' }
    }
  }

  async scheduleArtifact(
    userId: string,
    id: string,
    businessId: string,
    scheduledAt: Date,
    event?: H3Event,
    targetAccountIds?: string[],
  ): Promise<ServiceResponse<MaterializeResult>> {
    try {
      const current = await this.getArtifact(userId, id, businessId, event)
      if (!current.success) return current
      const targets = await this.resolveArtifactTargets(current.data, targetAccountIds)
      if (!targets.success) return targets
      const materialized = await this.materializeWithTargets(userId, current.data, targets.data)
      if (!materialized.success) return materialized
      return await this.scheduleMaterializedArtifact(userId, materialized.data, scheduledAt, targets.data)
    } catch {
      return { success: false, error: 'Failed to schedule artifact' }
    }
  }

  private async scheduleMaterializedArtifact(
    userId: string,
    materialized: MaterializeResult,
    scheduledAt: Date,
    targetAccountIds: string[],
  ): Promise<ServiceResponse<MaterializeResult>> {
    if (!materialized.postId) {
      return { success: false, error: 'Artifact has no post to schedule', code: 'VALIDATION_ERROR' }
    }
    const parsed: unknown = JSON.parse(materialized.artifact.output)
    const output = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
    const rescheduled = await postService.update(materialized.postId, userId, {
      content: captionOf(output),
      status: 'pending',
      scheduledAt,
      targetPlatforms: targetAccountIds,
      mediaAssets: [],
      comment: [],
    })
    if (!rescheduled.success || !rescheduled.data) {
      return { success: false, error: rescheduled.error ?? 'Failed to schedule post' }
    }
    const [updated] = await this.db
      .update(contentArtifacts)
      .set({ status: 'scheduled', updatedAt: new Date() })
      .where(eq(contentArtifacts.id, materialized.artifact.id))
      .returning()
    return { success: true, data: { artifact: updated, postId: rescheduled.data.id, duplicate: materialized.duplicate } }
  }

  async listApprovals(
    userId: string,
    filters: { businessId: string, runId?: string | null, artifactId?: string | null },
    event?: H3Event,
  ): Promise<ServiceResponse<ApprovalRecord[]>> {
    try {
      const owner = await this.scopedOwner(userId, filters.businessId, event)
      if (!owner.success) return owner
      const conditions = [eq(contentArtifacts.businessId, filters.businessId), eq(contentArtifacts.ownerUserId, owner.data)]
      if (filters.artifactId) conditions.push(eq(approvalRecords.artifactId, filters.artifactId))
      if (filters.runId) conditions.push(eq(approvalRecords.runId, filters.runId))
      const rows = await this.db
        .select({
          id: approvalRecords.id,
          artifactId: approvalRecords.artifactId,
          runId: approvalRecords.runId,
          threadId: approvalRecords.threadId,
          decision: approvalRecords.decision,
          feedback: approvalRecords.feedback,
          actor: approvalRecords.actor,
          version: approvalRecords.version,
          createdAt: approvalRecords.createdAt,
        })
        .from(approvalRecords)
        .innerJoin(contentArtifacts, eq(approvalRecords.artifactId, contentArtifacts.id))
        .where(and(...conditions))
        .orderBy(desc(approvalRecords.createdAt))
        .limit(100)
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to list approvals' }
    }
  }
}

export const contentArtifactService = new ContentArtifactService()

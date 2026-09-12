import type { H3Event } from 'h3'
import { and, desc, eq } from 'drizzle-orm'
import type { ServiceResponse } from './types'
import {
  EditArtifactSchema,
  ReviewArtifactSchema,
  SubmitArtifactSchema,
  approvalRecords,
  contentArtifacts,
  type ApprovalRecord,
  type ArtifactStatus,
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

function artifactScope(businessId: string, ownerUserId: string) {
  return and(
    eq(contentArtifacts.businessId, businessId),
    eq(contentArtifacts.ownerUserId, ownerUserId),
  )
}

function captionOf(output: Record<string, unknown>): string {
  return typeof output.caption === 'string' ? output.caption : ''
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
    } catch {
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
  ): Promise<ServiceResponse<ContentArtifact[]>> {
    try {
      const owner = await this.scopedOwner(userId, filters.businessId, event)
      if (!owner.success) return owner
      const conditions = [artifactScope(filters.businessId, owner.data)]
      if (filters.threadId) conditions.push(eq(contentArtifacts.threadId, filters.threadId))
      if (filters.runId) conditions.push(eq(contentArtifacts.runId, filters.runId))
      const rows = await this.db
        .select()
        .from(contentArtifacts)
        .where(and(...conditions))
        .orderBy(desc(contentArtifacts.updatedAt))
        .limit(50)
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to list artifacts' }
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
      const contract = validateArtifactOutput(current.data.outputKind, parsed.data.output)
      if (!contract.ok) {
        return { success: false, error: contract.error ?? 'Invalid artifact output', code: 'VALIDATION_ERROR' }
      }
      const [updated] = await this.db
        .update(contentArtifacts)
        .set({
          output: JSON.stringify(parsed.data.output),
          version: current.data.version + 1,
          status: 'review_required',
          updatedAt: new Date(),
        })
        .where(eq(contentArtifacts.id, current.data.id))
        .returning()
      return { success: true, data: updated }
    } catch {
      return { success: false, error: 'Failed to edit artifact' }
    }
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
        return { success: false, error: 'Artifact changed since review started', code: 'VALIDATION_ERROR' }
      }
      if (current.data.status !== 'review_required' && current.data.status !== 'changes_requested') {
        return { success: false, error: 'Artifact is not awaiting review', code: 'VALIDATION_ERROR' }
      }
      const status: ArtifactStatus = parsed.data.decision === 'approved'
        ? 'approved'
        : parsed.data.decision === 'rejected' ? 'rejected' : 'changes_requested'
      const [updated] = await this.db
        .update(contentArtifacts)
        .set({ status, updatedAt: new Date() })
        .where(eq(contentArtifacts.id, current.data.id))
        .returning()
      const [record] = await this.db.insert(approvalRecords).values({
        id: crypto.randomUUID(),
        artifactId: current.data.id,
        runId: current.data.runId,
        threadId: current.data.threadId,
        decision: parsed.data.decision,
        feedback: parsed.data.feedback,
        actor: userId,
        version: current.data.version,
      }).returning()
      return { success: true, data: { artifact: updated, record } }
    } catch {
      return { success: false, error: 'Failed to record review' }
    }
  }

  async materializeArtifact(
    userId: string,
    id: string,
    businessId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<MaterializeResult>> {
    try {
      const current = await this.getArtifact(userId, id, businessId, event)
      if (!current.success) return current
      const artifact = current.data
      // Idempotent by the (run_id, version, kind) natural key: an already
      // materialized artifact returns its stable post without side effects.
      if (artifact.postId) {
        return { success: true, data: { artifact, postId: artifact.postId, duplicate: true } }
      }
      if (artifact.status !== 'approved') {
        return { success: false, error: 'Artifact must be approved before materialization', code: 'VALIDATION_ERROR' }
      }
      if (artifact.kind !== 'social_post' && artifact.kind !== 'carousel' && artifact.kind !== 'reel_storyboard') {
        return { success: false, error: `Materialization for '${artifact.kind}' lands in its delivery phase`, code: 'ACTION_NOT_SUPPORTED' }
      }
      if (artifact.kind === 'carousel') {
        return await this.materializeCarousel(userId, businessId, artifact)
      }
      if (artifact.kind === 'reel_storyboard') {
        return await this.materializeReel(userId, businessId, artifact)
      }
      return await this.materializePost(userId, businessId, artifact)
    } catch {
      return { success: false, error: 'Failed to materialize artifact' }
    }
  }

  private async materializePost(
    userId: string,
    businessId: string,
    artifact: ContentArtifact,
  ): Promise<ServiceResponse<MaterializeResult>> {
    try {
      const output = JSON.parse(artifact.output) as Record<string, unknown>
      const caption = captionOf(output)
      if (!caption.trim()) {
        return { success: false, error: 'Artifact has no caption to materialize', code: 'VALIDATION_ERROR' }
      }
      const targets = await resolveTargetAccountIds(businessId, platformsOf(output))
      if (!targets.success || !targets.data) {
        return { success: false, error: targets.error ?? 'No connected accounts', code: 'VALIDATION_ERROR' }
      }
      const created = await postService.create(userId, {
        ...newDraftPostInput(businessId, caption, targets.data),
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
      const targets = await resolveTargetAccountIds(businessId, [])
      if (!targets.success || !targets.data) {
        return { success: false, error: targets.error ?? 'No connected accounts', code: 'VALIDATION_ERROR' }
      }
      const created = await postService.create(userId, {
        ...newDraftPostInput(businessId, `Carousel: ${deck.data.name} (${scenes.length} slides)`, targets.data),
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
  ): Promise<ServiceResponse<MaterializeResult>> {
    try {
      const output = JSON.parse(artifact.output) as {
        slides?: Array<{ scene?: unknown, altText?: string, templateKey?: string }>,
      }
      // Bounds and scene safety are enforced before any side effect.
      const invalid = this.validateCarouselOutput(output)
      if (invalid) {
        return { success: false, error: invalid, code: 'VALIDATION_ERROR' }
      }
      const scenes = Array.isArray(output.slides) ? output.slides : []
      const created = await this.createCarouselPost(userId, businessId, artifact.id, scenes)
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
  ): Promise<ServiceResponse<MaterializeResult>> {
    try {
      const output = JSON.parse(artifact.output) as {
        caption?: string,
        scenes?: Array<{ assetRef?: string, assetRefs?: string[], narration?: string, voiceover?: string, sceneText?: string }>,
        assetRefs?: string[],
      }
      const scenes = Array.isArray(output.scenes) ? output.scenes : []
      if (scenes.length === 0) {
        return { success: false, error: 'Storyboard has no scenes', code: 'VALIDATION_ERROR' }
      }
      const targets = await resolveTargetAccountIds(businessId, [])
      if (!targets.success || !targets.data) {
        return { success: false, error: targets.error ?? 'No connected accounts', code: 'VALIDATION_ERROR' }
      }
      const created = await postService.create(userId, {
        ...newDraftPostInput(businessId, this.reelCaption(output, scenes), targets.data),
        mediaAssets: this.orderedReelAssets(output),
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
  ): Promise<ServiceResponse<MaterializeResult>> {
    try {
      const materialized = await this.materializeArtifact(userId, id, businessId, event)
      if (!materialized.success || !materialized.data?.postId) return materialized
      const output = JSON.parse(materialized.data.artifact.output) as Record<string, unknown>
      const targets = await resolveTargetAccountIds(businessId, platformsOf(output))
      if (!targets.success || !targets.data) {
        return { success: false, error: targets.error ?? 'No connected accounts', code: 'VALIDATION_ERROR' }
      }
      const rescheduled = await postService.update(materialized.data.postId, userId, {
        content: captionOf(output),
        status: 'pending',
        scheduledAt,
        targetPlatforms: targets.data,
        mediaAssets: [],
        comment: [],
      })
      if (!rescheduled.success || !rescheduled.data) {
        return { success: false, error: rescheduled.error ?? 'Failed to schedule post' }
      }
      const [updated] = await this.db
        .update(contentArtifacts)
        .set({ status: 'scheduled', updatedAt: new Date() })
        .where(eq(contentArtifacts.id, id))
        .returning()
      return { success: true, data: { artifact: updated, postId: rescheduled.data.id, duplicate: materialized.data.duplicate } }
    } catch {
      return { success: false, error: 'Failed to schedule artifact' }
    }
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

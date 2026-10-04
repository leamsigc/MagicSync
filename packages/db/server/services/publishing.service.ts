import { createHash } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { useDrizzle } from '#layers/BaseDB/server/utils/drizzle'
import { encryptSecret, revealSecret } from '#layers/BaseDB/server/utils/publish-crypto'
import { validatePublicSiteUrl } from '#layers/BaseDB/server/utils/url-allowlist'
import { businessProfileService } from './business-profile.service'
import { contentArtifactService } from './content-artifact.service'
import {
  CreatePublishingJobSchema,
  publishConnections,
  publishingJobs,
  type CreatePublishingJobData,
  type CreatePublishConnectionData,
  type PublishConnection,
  type PublishProvider,
  type PublishingJob,
  type PushContentData,
  type UpdatePublishConnectionData
} from '#layers/BaseDB/db/schema'
import type { ServiceResponse } from './types'

export interface PushContentResult {
  provider: PublishProvider
  url?: string
  remoteId?: string
  status: string
}

interface GithubTarget {
  repo: string
  dir: string
  branch: string
}

export type MaskedPublishConnection = Omit<PublishConnection, 'secret'> & {
  secret: null
  hasSecret: boolean
}

export class PublishingService {
  private db = useDrizzle()

  private maskSecret(row: PublishConnection): MaskedPublishConnection {
    const { secret: _dropped, ...rest } = row
    return { ...rest, secret: null, hasSecret: _dropped != null }
  }

  private encryptIfPresent(value: string | null | undefined): string | null | undefined {
    if (value === undefined || value === null) {
      return value
    }
    return encryptSecret(value)
  }

  private parseConfig(raw: string | null): Record<string, unknown> {
    if (!raw) {
      return {}
    }
    try {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>
      }
      return {}
    } catch {
      return {}
    }
  }

  private stringField(value: unknown): string {
    if (typeof value === 'string') {
      return value
    }
    return ''
  }

  private stringOrNull(value: unknown): string | null {
    if (typeof value === 'string') {
      return value
    }
    return null
  }

  private nonEmpty(value: unknown, fallback: string): string {
    const text = this.stringField(value)
    if (text) {
      return text
    }
    return fallback
  }

  private slugify(title: string): string {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
    return this.nonEmpty(slug, 'untitled')
  }

  private githubConfigError(config: Record<string, unknown>): string | null {
    if (!config.repo || typeof config.repo !== 'string') {
      return 'GitHub connections require config.repo (owner/name)'
    }
    return null
  }

  private wordpressConfigError(config: Record<string, unknown>): string | null {
    if (!config.siteUrl || typeof config.siteUrl !== 'string') {
      return 'WordPress connections require config.siteUrl'
    }
    if (!config.username || typeof config.username !== 'string') {
      return 'WordPress connections require config.username'
    }
    return null
  }

  private connectionConfigError(provider: string, config: Record<string, unknown>): string | null {
    if (provider === 'github') {
      return this.githubConfigError(config)
    }
    if (provider === 'wordpress') {
      return this.wordpressConfigError(config)
    }
    return 'Provider must be github or wordpress'
  }

  private defaultMode(provider: string): string {
    return provider === 'wordpress' ? 'draft' : 'commit'
  }

  private modeError(provider: string, mode: string | undefined): string | null {
    if (mode === undefined) return null
    const allowed = provider === 'github' ? ['commit', 'pr'] : ['draft', 'live']
    if (!allowed.includes(mode)) {
      return `Delivery mode must be one of ${allowed.join(', ')} for ${provider}`
    }
    return null
  }

  private validateCreate(data: CreatePublishConnectionData): string | null {
    if (!data.businessId) {
      return 'businessId is required'
    }
    if (!data.name) {
      return 'name is required'
    }
    if (data.provider !== 'github' && data.provider !== 'wordpress') {
      return 'Provider must be github or wordpress'
    }
    const modeInvalid = this.modeError(data.provider, data.deliveryMode)
    if (modeInvalid) return modeInvalid
    return this.connectionConfigError(data.provider, (data.config ?? {}) as Record<string, unknown>)
  }

  private validateUpdate(provider: PublishProvider, data: UpdatePublishConnectionData): string | null {
    if (data.provider !== undefined && data.provider !== 'github' && data.provider !== 'wordpress') {
      return 'Provider must be github or wordpress'
    }
    const modeInvalid = this.modeError(data.provider ?? provider, data.deliveryMode)
    if (modeInvalid) return modeInvalid
    if (data.config === undefined) {
      return null
    }
    return this.connectionConfigError(data.provider ?? provider, data.config as Record<string, unknown>)
  }

  private assignIfDefined(target: Record<string, unknown>, key: string, value: unknown): void {
    if (value !== undefined) {
      target[key] = key === 'config' ? JSON.stringify(value) : value
    }
  }

  private buildUpdatePatch(data: UpdatePublishConnectionData): Record<string, unknown> {
    const values: Record<string, unknown> = { updatedAt: new Date() }
    this.assignIfDefined(values, 'name', data.name)
    this.assignIfDefined(values, 'provider', data.provider)
    this.assignIfDefined(values, 'deliveryMode', data.deliveryMode)
    this.assignIfDefined(values, 'config', data.config)
    this.assignIfDefined(values, 'secret', this.encryptIfPresent(data.secret))
    this.assignIfDefined(values, 'secretRef', data.secretRef)
    this.assignIfDefined(values, 'isActive', data.isActive)
    return values
  }

  private async resolveOwnerId(
    userId: string,
    businessId: string,
    event?: H3Event,
  ): Promise<ServiceResponse<string>> {
    try {
      const profile = await businessProfileService.findById(businessId, userId, event)
      if (!profile.success || !profile.data) {
        return { success: false, error: 'Business profile not found', code: 'NOT_FOUND' }
      }
      return { success: true, data: profile.data.userId }
    } catch {
      return { success: false, error: 'Failed to verify business access' }
    }
  }

  async getConnection(userId: string, id: string, event?: H3Event): Promise<ServiceResponse<PublishConnection>> {
    return this.findOwned(id, userId, event)
  }

  private async findOwned(id: string, userId: string, event?: H3Event): Promise<ServiceResponse<PublishConnection>> {
    try {
      const row = await this.db.query.publishConnections.findFirst({
        where: eq(publishConnections.id, id)
      })
      if (!row) {
        return { success: false, error: 'Publishing connection not found', code: 'NOT_FOUND' }
      }
      const owner = await this.resolveOwnerId(userId, row.businessId, event)
      if (!owner.success || !owner.data) {
        return { success: false, error: 'Publishing connection not found', code: 'NOT_FOUND' }
      }
      if (row.userId !== owner.data) {
        return { success: false, error: 'Publishing connection not found', code: 'NOT_FOUND' }
      }
      return { success: true, data: row }
    } catch {
      return { success: false, error: 'Failed to fetch publishing connection' }
    }
  }

  async listConnections(userId: string, businessId: string, event?: H3Event): Promise<ServiceResponse<MaskedPublishConnection[]>> {
    try {
      const owner = await this.resolveOwnerId(userId, businessId, event)
      if (!owner.success || !owner.data) {
        return { success: false, error: owner.error ?? 'Business profile not found', code: 'NOT_FOUND' }
      }
      const rows = await this.db.query.publishConnections.findMany({
        where: and(eq(publishConnections.userId, owner.data), eq(publishConnections.businessId, businessId)),
        orderBy: desc(publishConnections.updatedAt)
      })
      return { success: true, data: rows.map(row => this.maskSecret(row)) }
    } catch {
      return { success: false, error: 'Failed to fetch publishing connections' }
    }
  }

  async createConnection(userId: string, data: CreatePublishConnectionData, event?: H3Event): Promise<ServiceResponse<MaskedPublishConnection>> {
    try {
      const invalid = this.validateCreate(data)
      if (invalid) {
        return { success: false, error: invalid, code: 'VALIDATION_ERROR' }
      }
      const owner = await this.resolveOwnerId(userId, data.businessId, event)
      if (!owner.success || !owner.data) {
        return { success: false, error: owner.error ?? 'Business profile not found', code: 'NOT_FOUND' }
      }
      const now = new Date()
      const [row] = await this.db.insert(publishConnections).values({
        id: crypto.randomUUID(),
        userId: owner.data,
        businessId: data.businessId,
        provider: data.provider,
        name: data.name,
        config: JSON.stringify(data.config ?? {}),
        secret: this.encryptIfPresent(data.secret ?? null) ?? null,
        secretRef: data.secretRef ?? null,
        deliveryMode: data.deliveryMode ?? this.defaultMode(data.provider),
        isActive: true,
        createdAt: now,
        updatedAt: now
      }).returning()
      return { success: true, data: this.maskSecret(row) }
    } catch {
      return { success: false, error: 'Failed to create publishing connection' }
    }
  }

  async updateConnection(
    id: string,
    userId: string,
    data: UpdatePublishConnectionData,
    event?: H3Event
  ): Promise<ServiceResponse<MaskedPublishConnection>> {
    try {
      const current = await this.findOwned(id, userId, event)
      if (!current.success || !current.data) {
        return { success: false, error: current.error ?? 'Publishing connection not found', code: 'NOT_FOUND' }
      }
      const invalid = this.validateUpdate(current.data.provider, data)
      if (invalid) {
        return { success: false, error: invalid, code: 'VALIDATION_ERROR' }
      }
      const [updated] = await this.db
        .update(publishConnections)
        .set(this.buildUpdatePatch(data))
        .where(and(eq(publishConnections.id, id), eq(publishConnections.userId, current.data.userId)))
        .returning()
      return { success: true, data: this.maskSecret(updated) }
    } catch {
      return { success: false, error: 'Failed to update publishing connection' }
    }
  }

  async deleteConnection(id: string, userId: string, event?: H3Event): Promise<ServiceResponse<MaskedPublishConnection>> {
    try {
      const current = await this.findOwned(id, userId, event)
      if (!current.success || !current.data) {
        return { success: false, error: current.error ?? 'Publishing connection not found', code: 'NOT_FOUND' }
      }
      const [deleted] = await this.db
        .delete(publishConnections)
        .where(and(eq(publishConnections.id, id), eq(publishConnections.userId, current.data.userId)))
        .returning()
      return { success: true, data: this.maskSecret(deleted) }
    } catch {
      return { success: false, error: 'Failed to delete publishing connection' }
    }
  }

  async getActiveConnection(
    userId: string,
    businessId: string,
    provider: PublishProvider,
    event?: H3Event
  ): Promise<ServiceResponse<PublishConnection>> {
    try {
      const owner = await this.resolveOwnerId(userId, businessId, event)
      if (!owner.success || !owner.data) {
        return { success: false, error: owner.error ?? 'Business profile not found', code: 'NOT_FOUND' }
      }
      const row = await this.db.query.publishConnections.findFirst({
        where: and(
          eq(publishConnections.userId, owner.data),
          eq(publishConnections.businessId, businessId),
          eq(publishConnections.provider, provider),
          eq(publishConnections.isActive, true)
        )
      })
      if (!row) {
        return { success: false, error: 'No active publishing connection for provider', code: 'NOT_FOUND' }
      }
      return { success: true, data: row }
    } catch {
      return { success: false, error: 'Failed to fetch publishing connection' }
    }
  }

  async pushContent(userId: string, data: PushContentData, event?: H3Event): Promise<ServiceResponse<PushContentResult>> {
    try {
      const connection = await this.getActiveConnection(userId, data.businessId, data.provider, event)
      if (!connection.success || !connection.data) {
        return { success: false, error: connection.error ?? 'No active publishing connection', code: 'NOT_FOUND' }
      }
      if (data.provider === 'github') {
        return this.githubPush(connection.data, data)
      }
      return this.wordpressPush(connection.data, data)
    } catch {
      return { success: false, error: 'Failed to push content' }
    }
  }

  private resolveGithubTarget(config: Record<string, unknown>, pathOverride?: string): GithubTarget {
    return {
      repo: this.stringField(config.repo),
      dir: this.nonEmpty(pathOverride ?? config.dir ?? config.path, 'posts'),
      branch: this.nonEmpty(config.branch, 'main')
    }
  }

  private resolveGithubPath(dir: string, title: string, explicitPath?: string): string {
    const clean = this.nonEmpty(explicitPath, '')
    if (clean) {
      return clean.replace(/^\//, '')
    }
    return `${this.nonEmpty(dir, 'posts')}/${this.slugify(title)}.md`
  }

  private async fetchGithubSha(target: GithubTarget, token: string, filePath: string): Promise<string | null> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${target.repo}/contents/${filePath}?ref=${encodeURIComponent(target.branch)}`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`
          }
        }
      )
      if (!response.ok) {
        return null
      }
      const existing = (await response.json()) as { sha?: unknown }
      return this.stringOrNull(existing.sha)
    } catch {
      return null
    }
  }

  private async putGithubFile(
    target: GithubTarget,
    token: string,
    filePath: string,
    data: PushContentData,
    sha: string | null
  ): Promise<ServiceResponse<PushContentResult>> {
    try {
      const response = await fetch(`https://api.github.com/repos/${target.repo}/contents/${filePath}`, {
        method: 'PUT',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Publish: ${data.title}`,
          content: Buffer.from(`# ${data.title}\n\n${data.markdown}`, 'utf8').toString('base64'),
          branch: target.branch,
          ...(sha ? { sha } : {})
        })
      })
      if (response.status === 422) {
        return { success: false, error: 'GitHub conflict: remote file changed', code: 'CONFLICT' }
      }
      if (!response.ok) {
        return { success: false, error: 'GitHub API rejected the push' }
      }
      const created = (await response.json()) as { html_url?: string, content?: { sha?: string } }
      return {
        success: true,
        data: { provider: 'github', url: created.html_url, remoteId: created.content?.sha, status: 'pushed' }
      }
    } catch {
      return { success: false, error: 'GitHub push failed' }
    }
  }

  private async githubPush(
    connection: PublishConnection,
    data: PushContentData
  ): Promise<ServiceResponse<PushContentResult>> {
    try {
      const token = revealSecret(connection.secret)
      if (!token) {
        return { success: false, error: 'GitHub connection is missing a token', code: 'VALIDATION_ERROR' }
      }
      const target = this.resolveGithubTarget(this.parseConfig(connection.config), data.path)
      if (!target.repo) {
        return { success: false, error: 'GitHub connection is missing repo (owner/name)', code: 'VALIDATION_ERROR' }
      }
      const filePath = this.resolveGithubPath(target.dir, data.title, data.path)
      const sha = await this.fetchGithubSha(target, token, filePath)
      return await this.putGithubFile(target, token, filePath, data, sha)
    } catch {
      return { success: false, error: 'GitHub push failed' }
    }
  }

  private normalizeSiteUrl(value: unknown): string {
    const raw = this.stringField(value)
    if (!raw) {
      return ''
    }
    return raw.replace(/\/+$/, '')
  }

  private async wordpressPush(
    connection: PublishConnection,
    data: PushContentData,
    mode: 'draft' | 'live' = 'draft'
  ): Promise<ServiceResponse<PushContentResult>> {
    return this.wordpressPushExtended(connection, data, mode)
  }

  private async wordpressPushExtended(
    connection: PublishConnection,
    data: PushContentData & { slug?: string, excerpt?: string, category?: string, tags?: string[], featuredImage?: string },
    mode: 'draft' | 'live' = 'draft'
  ): Promise<ServiceResponse<PushContentResult>> {
    try {
      const config = this.parseConfig(connection.config)
      const siteUrl = this.normalizeSiteUrl(config.siteUrl)
      if (!siteUrl) {
        return { success: false, error: 'WordPress connection is missing siteUrl', code: 'VALIDATION_ERROR' }
      }
      if (mode === 'live' && config.allowLive !== true) {
        return { success: false, error: 'Live publishing is not enabled on this connection', code: 'VALIDATION_ERROR' }
      }
      const blocked = await validatePublicSiteUrl(siteUrl)
      if (blocked) {
        return { success: false, error: `WordPress site URL rejected: ${blocked}`, code: 'VALIDATION_ERROR' }
      }
      const secret = revealSecret(connection.secret)
      if (!secret) {
        return { success: false, error: 'WordPress connection is missing an application password', code: 'VALIDATION_ERROR' }
      }
      const username = this.stringField(config.username)
      const credentials = Buffer.from(`${username}:${secret}`, 'utf8').toString('base64')
      const payload: Record<string, unknown> = { title: data.title, content: data.markdown, status: mode === 'live' ? 'publish' : 'draft' }
      if (data.slug) payload.slug = data.slug
      if (data.excerpt) payload.excerpt = data.excerpt
      if (data.category) payload.categories = [data.category]
      if (data.tags && data.tags.length > 0) payload.tags = data.tags
      if (data.featuredImage) payload.featured_media = data.featuredImage
      if (data.path && !payload.slug) payload.slug = data.path
      const response = await fetch(`${siteUrl}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      if (!response.ok) {
        return { success: false, error: 'WordPress API rejected the push' }
      }
      const created = (await response.json()) as { id?: unknown, link?: string }
      const remoteId = typeof created.id === 'number' ? String(created.id) : this.stringOrNull(created.id)
      return {
        success: true,
        data: { provider: 'wordpress', url: created.link, remoteId: remoteId ?? undefined, status: mode === 'live' ? 'live' : 'draft' }
      }
    } catch {
      return { success: false, error: 'WordPress push failed' }
    }
  }

  // ---------------- T120 delivery modes, jobs, and testing ----------------

  private jobKey(artifactId: string, artifactVersion: number, connectionId: string, mode: string): string {
    return createHash('sha256').update(`${artifactId}:${artifactVersion}:${connectionId}:${mode}`).digest('hex')
  }

  private artifactMarkdown(artifact: { output: string, kind: string }): { title: string, markdown: string } {
    let output: Record<string, unknown> = {}
    try {
      const parsed: unknown = JSON.parse(artifact.output)
      if (parsed && typeof parsed === 'object') output = parsed as Record<string, unknown>
    } catch {
      output = {}
    }
    // The long-form article body wins over the social caption (PRD
    // CONTENT-PIPELINE §2.2): publishing an article should push the article.
    const article = typeof output.article === 'string' ? output.article : ''
    const caption = typeof output.caption === 'string' ? output.caption : ''
    const topic = typeof output.topic === 'string' ? output.topic : ''
    const body = article || caption || topic || 'Untitled'
    const firstLine = body.split('\n')[0] ?? 'Untitled'
    return { title: firstLine.slice(0, 80) || 'Untitled', markdown: body }
  }

  async testConnection(userId: string, id: string, event?: H3Event): Promise<ServiceResponse<{ ok: boolean, detail: string }>> {
    try {
      const current = await this.findOwned(id, userId, event)
      if (!current.success || !current.data) {
        return { success: false, error: 'Publishing connection not found', code: 'NOT_FOUND' }
      }
      const connection = current.data
      const config = this.parseConfig(connection.config)
      if (connection.provider === 'github') {
        return await this.testGithubConnection(connection, config)
      }
      return await this.testWordpressConnection(config)
    } catch {
      return { success: false, error: 'Connection test failed' }
    }
  }

  private async testGithubConnection(connection: PublishConnection, config: Record<string, unknown>): Promise<ServiceResponse<{ ok: boolean, detail: string }>> {
    const token = revealSecret(connection.secret)
    if (!token) {
      return { success: false, error: 'GitHub connection is missing a token', code: 'VALIDATION_ERROR' }
    }
    const repo = this.stringField(config.repo)
    if (!repo) {
      return { success: false, error: 'GitHub connections require config.repo (owner/name)', code: 'VALIDATION_ERROR' }
    }
    const response = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      return { success: true, data: { ok: false, detail: `GitHub rejected the token (HTTP ${response.status})` } }
    }
    return { success: true, data: { ok: true, detail: `Connected to ${repo}` } }
  }

  private async testWordpressConnection(config: Record<string, unknown>): Promise<ServiceResponse<{ ok: boolean, detail: string }>> {
    const siteUrl = this.normalizeSiteUrl(config.siteUrl)
    if (!siteUrl) {
      return { success: false, error: 'WordPress connection is missing siteUrl', code: 'VALIDATION_ERROR' }
    }
    const blocked = await validatePublicSiteUrl(siteUrl)
    if (blocked) {
      return { success: true, data: { ok: false, detail: `Site URL rejected: ${blocked}` } }
    }
    const response = await fetch(`${siteUrl}/wp-json/`)
    if (!response.ok) {
      return { success: true, data: { ok: false, detail: `WordPress API unreachable (HTTP ${response.status})` } }
    }
    return { success: true, data: { ok: true, detail: `WordPress API reachable at ${siteUrl}` } }
  }

  async createJob(userId: string, data: { businessId: string, connectionId: string, artifactId: string, artifactVersion: number }, event?: H3Event): Promise<ServiceResponse<{ job: PublishingJob, duplicate: boolean }>> {
    try {
      const parsed = CreatePublishingJobSchema.safeParse(data)
      if (!parsed.success) {
        return { success: false, error: 'Invalid publishing job', code: 'VALIDATION_ERROR' }
      }
      const connection = await this.findOwned(parsed.data.connectionId, userId, event)
      if (!connection.success || !connection.data) {
        return { success: false, error: 'Publishing connection not found', code: 'NOT_FOUND' }
      }
      if (!connection.data.isActive) {
        return { success: false, error: 'Publishing connection is not active', code: 'VALIDATION_ERROR' }
      }
      // Approval gate: the exact artifact version must be approved right now.
      const artifact = await this.loadApprovedArtifact(userId, parsed.data.businessId, parsed.data.artifactId, parsed.data.artifactVersion, event)
      if (!artifact.success || !artifact.data) {
        return { success: false, error: artifact.error ?? 'Artifact approval is missing for this version', code: artifact.code ?? 'VALIDATION_ERROR' }
      }
      const mode = connection.data.deliveryMode || this.defaultMode(connection.data.provider)
      const key = this.jobKey(parsed.data.artifactId, parsed.data.artifactVersion, connection.data.id, mode)
      const [existing] = await this.db
        .select()
        .from(publishingJobs)
        .where(eq(publishingJobs.idempotencyKey, key))
        .limit(1)
      if (existing) {
        return { success: true, data: { job: existing, duplicate: true } }
      }
      const now = new Date()
      const [job] = await this.db.insert(publishingJobs).values({
        id: crypto.randomUUID(),
        userId: connection.data.userId,
        businessId: parsed.data.businessId,
        connectionId: connection.data.id,
        artifactId: parsed.data.artifactId,
        artifactVersion: parsed.data.artifactVersion,
        idempotencyKey: key,
        status: 'queued',
        attemptCount: 0,
        createdAt: now,
        updatedAt: now,
      }).returning()
      return { success: true, data: { job, duplicate: false } }
    } catch {
      return { success: false, error: 'Failed to create publishing job' }
    }
  }

  async listJobs(userId: string, businessId: string, event?: H3Event): Promise<ServiceResponse<PublishingJob[]>> {
    try {
      const owner = await this.resolveOwnerId(userId, businessId, event)
      if (!owner.success || !owner.data) {
        return { success: false, error: owner.error ?? 'Business profile not found', code: 'NOT_FOUND' }
      }
      const rows = await this.db
        .select()
        .from(publishingJobs)
        .where(and(eq(publishingJobs.userId, owner.data), eq(publishingJobs.businessId, businessId)))
        .orderBy(desc(publishingJobs.updatedAt))
        .limit(100)
      return { success: true, data: rows }
    } catch {
      return { success: false, error: 'Failed to list publishing jobs' }
    }
  }

  /**
   * An artifact is publishable when it was approved, or when it has already
   * been materialized for delivery — `materializePost` links a post and moves
   * the artifact to `draft`, so a job created before materialization would
   * otherwise fail its own revalidation and could never execute.
   */
  private isPublishableArtifact(artifact: { status: string, postId: string | null }): boolean {
    if (artifact.status === 'approved') return true
    return artifact.status === 'draft' && artifact.postId !== null
  }

  private async loadApprovedArtifact(
    userId: string,
    businessId: string,
    artifactId: string,
    artifactVersion: number,
    event?: H3Event,
  ): Promise<ServiceResponse<{ id: string, output: string, kind: string }>> {
    try {
      const artifact = await contentArtifactService.getArtifact(userId, artifactId, businessId, event)
      if (!artifact.success || !artifact.data) {
        return { success: false, error: 'Artifact not found', code: 'NOT_FOUND' }
      }
      const mismatch = artifact.data.version !== artifactVersion || !this.isPublishableArtifact(artifact.data)
      if (mismatch) {
        return { success: false, error: 'Artifact approval is missing for this version', code: 'VALIDATION_ERROR' }
      }
      return { success: true, data: artifact.data }
    } catch {
      return { success: false, error: 'Failed to load artifact' }
    }
  }

  private async revalidateJobArtifact(
    userId: string,
    job: PublishingJob,
    event?: H3Event,
  ): Promise<ServiceResponse<{ id: string, output: string, kind: string }>> {
    try {
      if (!job.artifactId || job.artifactVersion === null) {
        return { success: false, error: 'Publishing job has no artifact', code: 'VALIDATION_ERROR' }
      }
      return await this.loadApprovedArtifact(userId, job.businessId, job.artifactId, job.artifactVersion, event)
    } catch {
      return { success: false, error: 'Failed to revalidate artifact' }
    }
  }

  private async markJob(id: string, patch: Partial<PublishingJob>): Promise<PublishingJob | null> {
    const [updated] = await this.db
      .update(publishingJobs)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(publishingJobs.id, id))
      .returning()
    return updated ?? null
  }

  private async loadJobForExecute(userId: string, jobId: string, event?: H3Event) {
    const [job] = await this.db.select().from(publishingJobs).where(eq(publishingJobs.id, jobId)).limit(1)
    if (!job) {
      return { success: false as const, error: 'Publishing job not found', code: 'NOT_FOUND' }
    }
    const owner = await this.resolveOwnerId(userId, job.businessId, event)
    if (!owner.success || !owner.data || job.userId !== owner.data) {
      return { success: false as const, error: 'Publishing job not found', code: 'NOT_FOUND' }
    }
    if (!job.connectionId) {
      return { success: false as const, error: 'Publishing job has no connection', code: 'VALIDATION_ERROR' }
    }
    const connection = await this.findOwned(job.connectionId, userId, event)
    if (!connection.success || !connection.data) {
      return { success: false as const, error: 'Publishing connection not found', code: 'NOT_FOUND' }
    }
    return { success: true as const, data: { job, connection: connection.data } }
  }

  async executeJob(userId: string, jobId: string, event?: H3Event): Promise<ServiceResponse<PublishingJob>> {
    try {
      const loaded = await this.loadJobForExecute(userId, jobId, event)
      if (!loaded.success) return loaded
      const { job, connection } = loaded.data
      if (job.status !== 'queued' && job.status !== 'failed' && job.status !== 'conflict') {
        return { success: false, error: `Job cannot run from status '${job.status}'`, code: 'VALIDATION_ERROR' }
      }
      // Re-gate approval at execution time: the exact version must still hold.
      if (!job.artifactId || job.artifactVersion === null) {
        return { success: false, error: 'Publishing job has no artifact', code: 'VALIDATION_ERROR' }
      }
      const artifact = await this.revalidateJobArtifact(userId, job, event)
      if (!artifact.success || !artifact.data) {
        await this.markJob(job.id, { status: 'failed', errorCode: artifact.code ?? 'APPROVAL_LOST', errorMessage: artifact.error ?? 'Artifact approval lost' })
        return { success: false, error: artifact.error ?? 'Artifact approval lost', code: artifact.code ?? 'VALIDATION_ERROR' }
      }
      await this.markJob(job.id, { status: 'running', attemptCount: job.attemptCount + 1, startedAt: new Date(), errorCode: null, errorMessage: null })
      const outcome = await this.deliverJob(connection, artifact.data)
      if (!outcome.success) {
        const conflict = outcome.code === 'CONFLICT'
        await this.markJob(job.id, {
          status: conflict ? 'conflict' : 'failed',
          errorCode: outcome.code ?? 'DELIVERY_FAILED',
          errorMessage: outcome.error ?? 'Delivery failed',
          completedAt: new Date(),
        })
        return { success: false, error: outcome.error ?? 'Delivery failed', code: outcome.code ?? 'DELIVERY_FAILED' }
      }
      const updated = await this.markJob(job.id, {
        status: 'succeeded',
        remoteId: outcome.data?.remoteId ?? null,
        remoteUrl: outcome.data?.url ?? null,
        commitSha: outcome.data?.remoteId ?? null,
        pullRequestUrl: outcome.data?.pullRequestUrl ?? null,
        completedAt: new Date(),
      })
      return { success: true, data: updated as PublishingJob }
    } catch {
      return { success: false, error: 'Failed to execute publishing job' }
    }
  }

  async retryJob(userId: string, jobId: string, event?: H3Event): Promise<ServiceResponse<PublishingJob>> {
    try {
      const loaded = await this.loadJobForExecute(userId, jobId, event)
      if (!loaded.success) return loaded
      if (loaded.data.job.status !== 'failed' && loaded.data.job.status !== 'conflict') {
        return { success: false, error: 'Only failed jobs can be retried', code: 'VALIDATION_ERROR' }
      }
      return await this.executeJob(userId, jobId, event)
    } catch {
      return { success: false, error: 'Failed to retry publishing job' }
    }
  }

  private parseArtifactOutput(raw: string): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    } catch { /* ignore */ }
    return {}
  }

  private artifactGithubData(connection: PublishConnection, artifact: { id: string, output: string, kind: string }): PushContentData {
    const output = this.parseArtifactOutput(artifact.output)
    if (output.outputKind === 'github_article') {
      const title = typeof output.title === 'string' ? output.title : 'Untitled'
      const markdown = typeof output.markdown === 'string' ? output.markdown : String(output.markdown ?? '')
      const targetPath = typeof output.targetPath === 'string' ? output.targetPath : undefined
      return { businessId: connection.businessId, provider: 'github', title, markdown, path: targetPath }
    }
    const rendered = this.artifactMarkdown(artifact)
    return { businessId: connection.businessId, provider: 'github', title: rendered.title, markdown: rendered.markdown }
  }

  private async deliverWordpressExtended(connection: PublishConnection, artifact: { id: string, output: string, kind: string }, mode: 'draft' | 'live'): Promise<ServiceResponse<PushContentResult & { pullRequestUrl?: string }>> {
    const output = this.parseArtifactOutput(artifact.output)
    if (output.outputKind === 'wordpress_article') {
      const siteOutput = output as { title?: unknown, content?: unknown, slug?: unknown, excerpt?: unknown, category?: unknown, tags?: unknown, featuredImage?: unknown }
      const data: PushContentData & { slug?: string, excerpt?: string, category?: string, tags?: string[], featuredImage?: string } = {
        businessId: connection.businessId,
        provider: 'wordpress',
        title: typeof siteOutput.title === 'string' ? siteOutput.title : 'Untitled',
        markdown: typeof siteOutput.content === 'string' ? siteOutput.content : String(siteOutput.content ?? ''),
        path: typeof siteOutput.slug === 'string' ? siteOutput.slug : undefined,
      }
      return this.wordpressPushExtended(connection, { ...data, excerpt: typeof siteOutput.excerpt === 'string' ? siteOutput.excerpt : undefined, category: typeof siteOutput.category === 'string' ? siteOutput.category : undefined, tags: Array.isArray(siteOutput.tags) ? siteOutput.tags as string[] : undefined }, mode)
    }
    const rendered = this.artifactMarkdown(artifact)
    return this.wordpressPush(connection, { businessId: connection.businessId, provider: 'wordpress', title: rendered.title, markdown: rendered.markdown }, mode)
  }

  private async deliverJob(
    connection: PublishConnection,
    artifact: { id: string, output: string, kind: string },
  ): Promise<ServiceResponse<PushContentResult & { pullRequestUrl?: string }>> {
    const mode = connection.deliveryMode || this.defaultMode(connection.provider)
    if (connection.provider === 'github') {
      const data = this.artifactGithubData(connection, artifact)
      if (mode === 'pr') return await this.githubPullRequest(connection, data)
      return await this.githubPush(connection, data)
    }
    return await this.deliverWordpressExtended(connection, artifact, mode === 'live' ? 'live' : 'draft')
  }

  private async githubApi(token: string, path: string, init?: RequestInit): Promise<{ status: number, body: Record<string, unknown> }> {
    const response = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
    let body: Record<string, unknown> = {}
    try {
      body = (await response.json()) as Record<string, unknown>
    } catch {
      body = {}
    }
    return { status: response.status, body }
  }

  private async githubPullRequest(
    connection: PublishConnection,
    data: PushContentData,
  ): Promise<ServiceResponse<PushContentResult & { pullRequestUrl?: string }>> {
    try {
      const token = revealSecret(connection.secret)
      if (!token) {
        return { success: false, error: 'GitHub connection is missing a token', code: 'VALIDATION_ERROR' }
      }
      const config = this.parseConfig(connection.config)
      const target = this.resolveGithubTarget(config)
      if (!target.repo) {
        return { success: false, error: 'GitHub connection is missing repo (owner/name)', code: 'VALIDATION_ERROR' }
      }
      const base = target.branch || 'main'
      const baseSha = await this.githubBranchSha(target.repo, base, token)
      if (!baseSha) {
        return { success: false, error: `GitHub branch '${base}' not found`, code: 'VALIDATION_ERROR' }
      }
      const filePath = this.resolveGithubPath(target.dir, data.title, data.path)
      const head = `magicsync/${createHash('sha256').update(`${data.title}:${filePath}`).digest('hex').slice(0, 12)}`
      await this.githubEnsureRef(target.repo, head, baseSha, token)
      const put = await this.putGithubFileOnBranch(target, token, filePath, data, head)
      if (!put.success) return put
      const existing = await this.githubFindOpenPr(target.repo, head, base, token)
      if (existing) {
        return { success: true, data: { provider: 'github', url: existing, remoteId: head, status: 'pull_request', pullRequestUrl: existing } }
      }
      const opened = await this.githubApi(token, `/repos/${target.repo}/pulls`, {
        method: 'POST',
        body: JSON.stringify({ title: `Publish: ${data.title}`, head, base, body: `Automated publishing job for ${data.title}.` }),
      })
      if (opened.status !== 201) {
        return { success: false, error: 'GitHub API rejected the pull request' }
      }
      const url = typeof opened.body.html_url === 'string' ? opened.body.html_url : undefined
      return { success: true, data: { provider: 'github', url, remoteId: head, status: 'pull_request', pullRequestUrl: url } }
    } catch {
      return { success: false, error: 'GitHub pull request failed' }
    }
  }

  private async githubBranchSha(repo: string, branch: string, token: string): Promise<string | null> {
    const ref = await this.githubApi(token, `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`)
    const object = ref.body.object as { sha?: string } | undefined
    return object?.sha ?? null
  }

  private async githubEnsureRef(repo: string, branch: string, sha: string, token: string): Promise<void> {
    const existing = await this.githubApi(token, `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`)
    if (existing.status === 200) return
    await this.githubApi(token, `/repos/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
    })
  }

  private async githubFindOpenPr(repo: string, head: string, base: string, token: string): Promise<string | null> {
    const owner = repo.split('/')[0] ?? ''
    const found = await this.githubApi(token, `/repos/${repo}/pulls?state=open&head=${encodeURIComponent(`${owner}:${head}`)}&base=${encodeURIComponent(base)}`)
    const raw = Array.isArray(found.body) ? found.body : (found.body as { items?: unknown[] }).items
    const list = Array.isArray(raw) ? raw : []
    const first = list[0] as { html_url?: string } | undefined
    return typeof first?.html_url === 'string' ? first.html_url : null
  }

  private async putGithubFileOnBranch(
    target: GithubTarget,
    token: string,
    filePath: string,
    data: PushContentData,
    branch: string,
  ): Promise<ServiceResponse<PushContentResult>> {
    try {
      const sha = await this.fetchGithubSha({ ...target, branch }, token, filePath)
      const response = await fetch(`https://api.github.com/repos/${target.repo}/contents/${filePath}`, {
        method: 'PUT',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Publish: ${data.title}`,
          content: Buffer.from(`# ${data.title}\n\n${data.markdown}`, 'utf8').toString('base64'),
          branch,
          ...(sha ? { sha } : {}),
        }),
      })
      if (response.status === 422) {
        return { success: false, error: 'GitHub conflict: remote file changed', code: 'CONFLICT' }
      }
      if (!response.ok) {
        return { success: false, error: 'GitHub API rejected the push' }
      }
      const created = (await response.json()) as { content?: { sha?: string } }
      return {
        success: true,
        data: { provider: 'github', remoteId: created.content?.sha, status: 'pushed' },
      }
    } catch {
      return { success: false, error: 'GitHub push failed' }
    }
  }
}

export const publishingService = new PublishingService()

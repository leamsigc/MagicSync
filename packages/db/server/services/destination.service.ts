import type { H3Event } from 'h3'
import { githubInspectService, buildTargetPath, type RepoInspection } from './github-inspect.service'
import { publishingService } from './publishing.service'
import { contentArtifactService } from './content-artifact.service'
import { businessProfileService } from './business-profile.service'
import type { ServiceResponse } from './types'
import { revealSecret } from '#layers/BaseDB/server/utils/publish-crypto'
import { parseJsonObject } from '#layers/BaseShared/utils/json'

const PII_PATTERNS: Array<{ type: string, source: string }> = [
  { type: 'EMAIL', source: '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}' },
  { type: 'IBAN', source: '\\b[A-Z]{2}\\d{2}[A-Z0-9]{11,30}\\b' },
  { type: 'CARD', source: '\\b(?:\\d[ -]?){13,19}\\b' },
  { type: 'PHONE', source: '(?:\\+\\d{1,3}[ -]?)?(?:\\(\\d{2,4}\\)[ -]?)?\\d{3}[ -]?\\d{3,4}[ -]?\\d{3,4}\\b' },
]

function detectRegex(text: string): Array<{ type: string, value: string }> {
  const matches: Array<{ type: string, value: string }> = []
  for (const pattern of PII_PATTERNS) {
    const regex = new RegExp(pattern.source, 'g')
    for (const match of text.matchAll(regex)) matches.push({ type: pattern.type, value: match[0] })
  }
  return matches
}

export interface GithubPublishInput {
  businessId: string
  connectionId?: string
  repository?: string
  branch?: string
  language: string
  slug: string
  title: string
  brief: string
  markdown?: string
  frontmatterOverrides?: Record<string, unknown>
  targetPath?: string
}

export interface WordpressPublishInput {
  businessId: string
  connectionId?: string
  title: string
  slug: string
  content: string
  excerpt?: string
  category?: string
  tags?: string[]
  featuredImage?: string
  status: 'draft' | 'publish'
  language?: string
}

export interface PreviewResult {
  repository: string
  framework: string
  contentSystem: string
  language: string
  target: string
  template: string | null
  branch: string
  action: string
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'untitled'
}

function buildFrontmatter(template: RepoInspection['frontmatter'], input: GithubPublishInput, inspection: RepoInspection): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(template?.example ?? {}) }
  base.title = input.title
  base.description = input.brief.slice(0, 160)
  if (!base.date) base.date = new Date().toISOString().slice(0, 10)
  if (!base.publishedAt) base.publishedAt = new Date().toISOString().slice(0, 10)
  if (input.frontmatterOverrides) {
    for (const [key, value] of Object.entries(input.frontmatterOverrides)) base[key] = value
  }
  return base
}

function renderMarkdownWithFrontmatter(frontmatter: Record<string, unknown>, body: string): string {
  const lines: string[] = ['---']
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`)
      for (const item of value) lines.push(`  - ${String(item)}`)
    } else if (value && typeof value === 'object') {
      lines.push(`${key}:`)
      for (const [sub, subVal] of Object.entries(value as Record<string, unknown>)) {
        if (subVal && typeof subVal === 'object' && !Array.isArray(subVal)) {
          lines.push(`  ${sub}:`)
          for (const [k, v] of Object.entries(subVal as Record<string, unknown>)) lines.push(`    ${k}: "${String(v).replace(/"/g, '\\"')}"`)
        } else if (Array.isArray(subVal)) {
          lines.push(`  ${sub}:`)
          for (const v of subVal) lines.push(`    - name: ${String((v as Record<string, unknown>).name ?? v)}`)
        } else {
          lines.push(`  ${sub}: "${String(subVal).replace(/"/g, '\\"')}"`)
        }
      }
    } else if (typeof value === 'string') {
      lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`)
    } else {
      lines.push(`${key}: ${String(value)}`)
    }
  }
  lines.push('---', '', body)
  return lines.join('\n')
}

function piiBlocked(markdown: string): string | null {
  const matches = detectRegex(markdown)
  if (matches.length === 0) return null
  const types = [...new Set(matches.map(m => m.type))].join(', ')
  return `PII detected (${types}). Remove sensitive data before publishing.`
}

export class DestinationService {
  private async resolveOwner(userId: string, businessId: string, event?: H3Event): Promise<ServiceResponse<string>> {
    try {
      const profile = await businessProfileService.findById(businessId, userId, event)
      if (!profile.success || !profile.data) return { success: false, error: 'Business not found', code: 'NOT_FOUND' }
      return { success: true, data: profile.data.userId }
    } catch {
      return { success: false, error: 'Failed to verify business' }
    }
  }

  async inspectGithub(userId: string, input: { businessId: string, repository: string, branch?: string }, event?: H3Event): Promise<ServiceResponse<RepoInspection>> {
    const owner = await this.resolveOwner(userId, input.businessId, event)
    if (!owner.success) return { success: false, error: owner.error, code: owner.code }
    const connection = await publishingService.getActiveConnection(userId, input.businessId, 'github', event)
    const token = connection.success && connection.data ? revealSecret(connection.data.secret) : null
    const configObject = connection.success && connection.data ? parseJsonObject(connection.data.config ?? '{}') : {}
    const branch = input.branch || (typeof configObject.branch === 'string' ? configObject.branch : undefined) || 'main'
    return githubInspectService.inspect(userId, input.businessId, { repo: input.repository, branch, token })
  }

  async previewGithub(userId: string, input: GithubPublishInput, event?: H3Event): Promise<ServiceResponse<PreviewResult>> {
    const owner = await this.resolveOwner(userId, input.businessId, event)
    if (!owner.success) return { success: false, error: owner.error, code: owner.code }
    let inspection: RepoInspection | null = null
    let branch = input.branch || 'main'
    let repository = input.repository || ''
    if (input.connectionId) {
      const conn = await publishingService.getConnection(userId, input.connectionId, event)
      if (conn.success && conn.data) {
        const cfg = parseJsonObject(conn.data.config)
        repository = String(cfg.repo ?? repository)
        branch = String(cfg.branch ?? branch)
      }
    }
    if (!repository) return { success: false, error: 'Repository is required', code: 'VALIDATION_ERROR' }
    const inspected = await this.inspectGithub(userId, { businessId: input.businessId, repository, branch }, event)
    if (!inspected.success) return { success: false, error: inspected.error, code: inspected.code }
    inspection = inspected.data
    const target = input.targetPath || buildTargetPath(inspection, { language: input.language, slug: input.slug || slugify(input.title) })
    const action = inspection.framework === 'nuxt' ? 'Create Pull Request' : 'Create Pull Request'
    return {
      success: true,
      data: {
        repository: inspection.repository,
        framework: inspection.framework,
        contentSystem: inspection.contentSystem,
        language: input.language,
        target,
        template: inspection.template?.path ?? null,
        branch: `magic-sync/${slugify(input.slug || input.title)}`,
        action,
      },
    }
  }

  async prepareGithubArticle(userId: string, input: GithubPublishInput, event?: H3Event): Promise<ServiceResponse<{ artifactId: string, preview: PreviewResult, markdown: string }>> {
    const owner = await this.resolveOwner(userId, input.businessId, event)
    if (!owner.success) return { success: false, error: owner.error, code: owner.code }
    if (!input.title) return { success: false, error: 'Title is required', code: 'VALIDATION_ERROR' }
    if (!input.brief) return { success: false, error: 'Brief is required', code: 'VALIDATION_ERROR' }

    const previewRes = await this.previewGithub(userId, input, event)
    if (!previewRes.success) return { success: false, error: previewRes.error, code: previewRes.code }
    const preview = previewRes.data
    const inspected = await this.inspectGithub(userId, { businessId: input.businessId, repository: preview.repository, branch: preview.branch.replace('magic-sync/', '') }, event)
    const inspection: RepoInspection = inspected.success ? inspected.data : {
      repository: preview.repository,
      branch: preview.branch.replace('magic-sync/', ''),
      framework: 'unknown',
      contentSystem: 'markdown',
      contentDir: 'content',
      blogDir: null,
      language: { type: 'none', pattern: 'content/...', languages: ['en'], defaultLanguage: null },
      template: null,
      frontmatter: null,
      sampleFiles: [],
      workflows: [],
      detectedFiles: [],
    }

    const fm = buildFrontmatter(inspection.frontmatter ?? null, input, inspection)
    const body = input.markdown || `# ${input.title}\n\n${input.brief}\n`
    const full = renderMarkdownWithFrontmatter(fm, body)

    const piiError = piiBlocked(full)
    if (piiError) return { success: false, error: piiError, code: 'PII_DETECTED' }

    // Existing file check
    const connection = input.connectionId ? await publishingService.getConnection(userId, input.connectionId, event) : await publishingService.getActiveConnection(userId, input.businessId, 'github', event)
    const token = connection.success && connection.data ? revealSecret(connection.data.secret) : null
    const branchBase = inspection.branch || 'main'
    const existing = await githubInspectService.checkExistingFile(preview.repository, branchBase, preview.target, token)
    if (existing.success && existing.data.exists) {
      return { success: false, error: 'File already exists', code: 'FILE_EXISTS' }
    }

    const artifact = await contentArtifactService.submitArtifact(userId, {
      businessId: input.businessId,
      kind: 'github_article',
      outputKind: 'github_article',
      output: {
        outputKind: 'github_article',
        title: input.title,
        description: input.brief.slice(0, 160),
        slug: slugify(input.slug || input.title),
        language: input.language,
        targetPath: preview.target,
        repository: preview.repository,
        branch: preview.branch,
        frontmatter: fm,
        markdown: full,
        rawMarkdown: body,
      },
    }, event)
    if (!artifact.success) return { success: false, error: artifact.error, code: artifact.code }

    return { success: true, data: { artifactId: artifact.data.id, preview, markdown: full } }
  }

  async prepareWordpressArticle(userId: string, input: WordpressPublishInput, event?: H3Event): Promise<ServiceResponse<{ artifactId: string, markdown: string }>> {
    const owner = await this.resolveOwner(userId, input.businessId, event)
    if (!owner.success) return { success: false, error: owner.error, code: owner.code }
    if (!input.title) return { success: false, error: 'Title is required', code: 'VALIDATION_ERROR' }
    if (!input.content) return { success: false, error: 'Content is required', code: 'VALIDATION_ERROR' }

    const piiError = piiBlocked(`${input.title}\n${input.content}\n${input.excerpt ?? ''}`)
    if (piiError) return { success: false, error: piiError, code: 'PII_DETECTED' }

    const slug = slugify(input.slug || input.title)
    const artifact = await contentArtifactService.submitArtifact(userId, {
      businessId: input.businessId,
      kind: 'wordpress_article',
      outputKind: 'wordpress_article',
      output: {
        outputKind: 'wordpress_article',
        title: input.title,
        slug,
        language: input.language ?? 'en',
        content: input.content,
        excerpt: input.excerpt ?? '',
        category: input.category ?? '',
        tags: input.tags ?? [],
        featuredImage: input.featuredImage ?? '',
        status: input.status,
        wordpressUrl: '',
      },
    }, event)
    if (!artifact.success) return { success: false, error: artifact.error, code: artifact.code }
    return { success: true, data: { artifactId: artifact.data.id, markdown: input.content } }
  }

  async publishGithub(userId: string, input: { businessId: string, artifactId: string, connectionId?: string }, event?: H3Event): Promise<ServiceResponse<{ jobId: string }>> {
    const owner = await this.resolveOwner(userId, input.businessId, event)
    if (!owner.success) return { success: false, error: owner.error, code: owner.code }

    const artifact = await contentArtifactService.getArtifact(userId, input.artifactId, input.businessId, event)
    if (!artifact.success) return { success: false, error: artifact.error, code: artifact.code }
    if (artifact.data.status !== 'approved') return { success: false, error: 'Artifact must be approved before publishing', code: 'VALIDATION_ERROR' }

    const connection = input.connectionId
      ? await publishingService.getConnection(userId, input.connectionId, event)
      : await publishingService.getActiveConnection(userId, input.businessId, 'github', event)
    if (!connection.success || !connection.data) return { success: false, error: 'No active GitHub connection', code: 'NOT_FOUND' }

    const job = await publishingService.createJob(userId, {
      businessId: input.businessId,
      connectionId: connection.data.id,
      artifactId: artifact.data.id,
      artifactVersion: artifact.data.version,
    }, event)
    if (!job.success) return { success: false, error: job.error, code: job.code }
    const executed = await publishingService.executeJob(userId, job.data.job.id, event)
    if (!executed.success) return { success: false, error: executed.error, code: executed.code }
    return { success: true, data: { jobId: job.data.job.id } }
  }

  async verifyGithub(userId: string, input: { businessId: string, jobId: string }, event?: H3Event): Promise<ServiceResponse<{ verified: boolean, detail: string }>> {
    const owner = await this.resolveOwner(userId, input.businessId, event)
    if (!owner.success) return { success: false, error: owner.error, code: owner.code }
    const jobs = await publishingService.listJobs(userId, input.businessId, event)
    if (!jobs.success) return { success: false, error: jobs.error }
    const job = jobs.data.find(j => j.id === input.jobId)
    if (!job) return { success: false, error: 'Job not found', code: 'NOT_FOUND' }
    if (job.status !== 'succeeded') return { success: true, data: { verified: false, detail: `Job status ${job.status}` } }
    return { success: true, data: { verified: true, detail: job.remoteUrl ? `Verified at ${job.remoteUrl}` : 'Verified' } }
  }

  async saveRepositorySettings(userId: string, input: { businessId: string, connectionId: string, inspection: RepoInspection }, event?: H3Event): Promise<ServiceResponse<void>> {
    const owner = await this.resolveOwner(userId, input.businessId, event)
    if (!owner.success) return { success: false, error: owner.error, code: owner.code }
    const current = await publishingService.getConnection(userId, input.connectionId, event)
    if (!current.success || !current.data) return { success: false, error: 'Connection not found', code: 'NOT_FOUND' }
    try {
      const config = parseJsonObject(current.data.config)
      const next = {
        ...config,
        inspectedAt: new Date().toISOString(),
        contentDir: input.inspection.contentDir,
        blogDir: input.inspection.blogDir,
        languageStrategy: input.inspection.language,
        templatePath: input.inspection.template?.path,
        branch: input.inspection.branch,
        framework: input.inspection.framework,
      }
      const updated = await publishingService.updateConnection(input.connectionId, userId, { config: next }, event)
      if (!updated.success) return { success: false, error: updated.error }
      return { success: true, data: undefined as void }
    } catch {
      return { success: false, error: 'Failed to save settings' }
    }
  }

  async detectStale(userId: string, input: { businessId: string, connectionId: string }, event?: H3Event): Promise<ServiceResponse<{ stale: boolean, old?: string, current?: string }>> {
    const owner = await this.resolveOwner(userId, input.businessId, event)
    if (!owner.success) return { success: false, error: owner.error, code: owner.code }
    const conn = await publishingService.getConnection(userId, input.connectionId, event)
    if (!conn.success || !conn.data) return { success: false, error: 'Connection not found', code: 'NOT_FOUND' }
    try {
      const cfg = parseJsonObject(conn.data.config)
      const saved = String((cfg.contentDir as string) ?? '')
      const repo = String((cfg.repo as string) ?? '')
      const branch = String((cfg.branch as string) ?? 'main')
      if (!repo || !saved) return { success: true, data: { stale: false } }
      const inspected = await githubInspectService.inspect(userId, input.businessId, { repo, branch, token: revealSecret(conn.data.secret) })
      if (!inspected.success) return { success: false, error: inspected.error }
      const current = inspected.data.contentDir
      if (saved !== current) return { success: true, data: { stale: true, old: saved, current } }
      return { success: true, data: { stale: false } }
    } catch {
      return { success: false, error: 'Failed to detect stale' }
    }
  }
}

export const destinationService = new DestinationService()

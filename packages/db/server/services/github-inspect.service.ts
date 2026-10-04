import type { ServiceResponse } from './types'
import { revealSecret } from '#layers/BaseDB/server/utils/publish-crypto'
import { parseJsonObject } from '#layers/BaseShared/utils/json'

export interface InspectInput {
  repo: string
  branch?: string
  token?: string | null
}

export interface LanguageStrategy {
  type: 'prefix' | 'suffix' | 'none'
  pattern: string
  languages: string[]
  defaultLanguage: string | null
}

export interface FrontmatterInfo {
  fields: string[]
  required: string[]
  optional: string[]
  example: Record<string, unknown>
  rawExample: string
}

export interface TemplateInfo {
  path: string
  frontmatter: FrontmatterInfo
  bodySnippet: string
  filenameConvention: 'folder-index' | 'flat-md'
}

export interface RepoInspection {
  repository: string
  branch: string
  framework: 'nuxt' | 'next' | 'unknown'
  contentSystem: 'nuxt-content' | 'markdown' | 'unknown'
  contentDir: string
  blogDir: string | null
  language: LanguageStrategy
  template: TemplateInfo | null
  frontmatter: FrontmatterInfo | null
  sampleFiles: string[]
  workflows: string[]
  detectedFiles: string[]
}

const CANDIDATE_FILES = [
  'package.json',
  'nuxt.config.ts',
  'nuxt.config.js',
  'nuxt.config.mjs',
  'content.config.ts',
  'content.config.js',
  'content/content.config.ts',
  'content.config.mjs',
  'content',
  'content/en',
  'content/de',
  'content/es',
  'content/blog',
  'content/blogs',
  'blog',
  'blogs',
  'docs',
  'README.md',
  'CONTRIBUTING.md',
]

const LANGUAGE_CODES = ['en', 'de', 'es', 'fr', 'it', 'pt', 'nl', 'pl', 'ja', 'ko', 'zh', 'ru']

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
  return slug || 'untitled'
}

function parseRepo(repo: string): { owner: string, name: string } | null {
  const parts = repo.trim().split('/')
  if (parts.length !== 2) return null
  const owner = parts[0]?.trim()
  const name = parts[1]?.trim()
  if (!owner || !name) return null
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(name)) return null
  return { owner, name }
}

function detectFramework(files: Set<string>, pkg?: Record<string, unknown>): 'nuxt' | 'next' | 'unknown' {
  const deps = new Set<string>()
  const rawDeps = (pkg?.dependencies ?? {}) as Record<string, unknown>
  const devDeps = (pkg?.devDependencies ?? {}) as Record<string, unknown>
  for (const key of [...Object.keys(rawDeps), ...Object.keys(devDeps)]) deps.add(key)
  if (deps.has('nuxt') || files.has('nuxt.config.ts') || files.has('nuxt.config.js') || files.has('nuxt.config.mjs')) return 'nuxt'
  if (deps.has('next') || files.has('next.config.js') || files.has('next.config.mjs')) return 'next'
  return 'unknown'
}

function detectContentSystem(files: Set<string>, pkg?: Record<string, unknown>): 'nuxt-content' | 'markdown' | 'unknown' {
  const deps = new Set<string>()
  const raw = (pkg?.dependencies ?? {}) as Record<string, unknown>
  const dev = (pkg?.devDependencies ?? {}) as Record<string, unknown>
  for (const key of [...Object.keys(raw), ...Object.keys(dev)]) deps.add(key)
  if (deps.has('@nuxt/content') || files.has('content.config.ts') || files.has('content.config.js')) return 'nuxt-content'
  const hasMarkdown = Array.from(files).some(path => path.endsWith('.md'))
  if (hasMarkdown) return 'markdown'
  return 'unknown'
}

function detectContentDir(files: string[], pkg?: Record<string, unknown>): string {
  const set = new Set(files)
  const candidates = [
    'content/en/blogs',
    'content/de/blogs',
    'content/en/blog',
    'content/blog',
    'content/blogs',
    'content',
    'blog',
    'blogs',
    'docs',
  ]
  for (const candidate of candidates) {
    if (files.some(path => path === candidate || path.startsWith(`${candidate}/`))) return candidate
  }
  if (set.has('package.json') && pkg) {
    const maybe = (pkg as { content?: { dir?: string } })?.content?.dir
    if (typeof maybe === 'string' && maybe) return maybe
  }
  return 'content'
}

function detectBlogDir(files: string[], contentDir: string): string | null {
  const candidates: string[] = []
  for (const file of files) {
    const blogsIdx = file.indexOf('/blogs/')
    if (blogsIdx !== -1) candidates.push(file.slice(0, blogsIdx + 6))
    const blogIdx = file.indexOf('/blog/')
    if (blogIdx !== -1) candidates.push(file.slice(0, blogIdx + 5))
  }
  if (candidates.length > 0) {
    const freq = new Map<string, number>()
    for (const cand of candidates) freq.set(cand, (freq.get(cand) ?? 0) + 1)
    let best: string | null = null
    let max = -1
    for (const [cand, count] of freq) {
      if (count > max) { max = count; best = cand }
    }
    if (best) return best.replace(/\/$/, '')
  }
  const nested = [`${contentDir}/blogs`, `${contentDir}/blog`]
  for (const candidate of nested) {
    if (files.some(path => path === candidate || path.startsWith(`${candidate}/`))) return candidate
  }
  const top = ['content/blogs', 'content/blog', 'blogs', 'blog']
  for (const candidate of top) {
    if (files.some(path => path.startsWith(`${candidate}/`))) return candidate
  }
  return null
}

function detectLanguageStrategy(files: string[]): LanguageStrategy {
  const langs = LANGUAGE_CODES.filter(code => files.some(path => path === `content/${code}` || path.startsWith(`content/${code}/`) || path.includes(`/content/${code}/`)))
  const prefixLangs = LANGUAGE_CODES.filter(code => files.some(path => path.startsWith(`content/${code}/`) || path === `content/${code}`))
  const suffixLangs = LANGUAGE_CODES.filter(code => files.some(path => path.includes(`/blog/${code}/`) || path.includes(`/blogs/${code}/`)))
  if (prefixLangs.length > 0) {
    return { type: 'prefix', pattern: 'content/{lang}/...', languages: prefixLangs, defaultLanguage: 'en' }
  }
  if (suffixLangs.length > 0) {
    return { type: 'suffix', pattern: 'content/blog/{lang}/...', languages: suffixLangs, defaultLanguage: 'en' }
  }
  if (langs.length >= 2) {
    return { type: 'prefix', pattern: 'content/{lang}/...', languages: langs, defaultLanguage: 'en' }
  }
  return { type: 'none', pattern: 'content/...', languages: langs.length ? langs : ['en'], defaultLanguage: langs[0] ?? null }
}

function extractFrontmatter(raw: string): { data: Record<string, unknown>, body: string, rawFrontmatter: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/)
  if (!match) return { data: {}, body: raw, rawFrontmatter: '' }
  const yaml = match[1] ?? ''
  const body = match[2] ?? ''
  const data: Record<string, unknown> = {}
  let currentKey = ''
  let inArray = false
  let arrayKey = ''
  const lines = yaml.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    if (trimmed.startsWith('- ')) {
      if (arrayKey) {
        const arr = (data[arrayKey] ?? []) as string[]
        arr.push(trimmed.slice(2).trim().replace(/^['"]|['"]$/g, ''))
        data[arrayKey] = arr
      }
      continue
    }
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    const valueRaw = line.slice(colon + 1).trim()
    currentKey = key
    if (valueRaw === '') {
      inArray = true
      arrayKey = key
      if (!Array.isArray(data[key])) data[key] = []
      continue
    }
    inArray = false
    arrayKey = ''
    let value: unknown = valueRaw
    if (valueRaw === 'true') value = true
    else if (valueRaw === 'false') value = false
    else if (!Number.isNaN(Number(valueRaw)) && valueRaw !== '') value = Number(valueRaw)
    else value = valueRaw.replace(/^['"]|['"]$/g, '')
    data[key] = value
  }
  return { data, body, rawFrontmatter: yaml }
}

function frontmatterInfo(sample: { path: string, content: string }): FrontmatterInfo {
  const parsed = extractFrontmatter(sample.content)
  const fields = Object.keys(parsed.data)
  const required = fields.filter(field => ['title', 'description', 'date', 'publishedAt'].includes(field))
  const optional = fields.filter(field => !required.includes(field))
  return { fields, required, optional, example: parsed.data, rawExample: parsed.rawFrontmatter }
}

function detectTemplateInfo(samples: Array<{ path: string, content: string }>): TemplateInfo | null {
  if (samples.length === 0) return null
  const best = samples[0]!
  const fm = frontmatterInfo(best)
  const convention: TemplateInfo['filenameConvention'] = best.path.endsWith('/index.md') ? 'folder-index' : 'flat-md'
  const body = extractFrontmatter(best.content).body.slice(0, 800)
  return { path: best.path, frontmatter: fm, bodySnippet: body, filenameConvention: convention }
}

export function buildTargetPath(
  inspection: RepoInspection,
  input: { language: string, slug: string, title?: string },
): string {
  const slug = slugify(input.slug || input.title || 'untitled')
  const lang = input.language || inspection.language.defaultLanguage || 'en'
  const convention = inspection.template?.filenameConvention ?? 'folder-index'
  const langStrategy = inspection.language

  if (langStrategy.type === 'prefix') {
    const base = inspection.blogDir ?? inspection.contentDir
    if (base.includes('{lang}')) {
      return base.replace('{lang}', lang) + (convention === 'folder-index' ? `/${slug}/index.md` : `/${slug}.md`)
    }
    if (base === 'content' || base.startsWith('content/')) {
      const withoutContent = base.replace(/^content\/?/, '')
      const prefix = withoutContent ? `content/${lang}/${withoutContent}` : `content/${lang}`
      if (inspection.blogDir) {
        const blogTail = inspection.blogDir.replace(/^content\/?/, '').replace(/^\w+\//, '')
        const tail = blogTail ? `/${blogTail}` : '/blogs'
        return `content/${lang}${tail}/${slug}${convention === 'folder-index' ? '/index.md' : '.md'}`
      }
      return `${prefix}/${slug}${convention === 'folder-index' ? '/index.md' : '.md'}`
    }
    return `${base}/${lang}/${slug}${convention === 'folder-index' ? '/index.md' : '.md'}`
  }

  if (langStrategy.type === 'suffix') {
    const base = inspection.blogDir ?? inspection.contentDir
    return `${base}/${lang}/${slug}${convention === 'folder-index' ? '/index.md' : '.md'}`
  }

  const base = inspection.blogDir ?? inspection.contentDir
  return `${base}/${slug}${convention === 'folder-index' ? '/index.md' : '.md'}`
}

function normalizeTreePaths(tree: Array<{ path?: string }>): string[] {
  return tree.map(entry => entry.path ?? '').filter(Boolean)
}

async function githubFetch<T>(url: string, token: string | null, init?: RequestInit): Promise<{ ok: boolean, status: number, data: T | null }> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(url, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) } })
  let data: T | null = null
  try {
    data = (await response.json()) as T
  } catch {
    data = null
  }
  return { ok: response.ok, status: response.status, data }
}

export class GithubInspectService {
  async inspect(userId: string, businessId: string, input: InspectInput, connectionGetter?: (repo: string) => Promise<ServiceResponse<{ secret: string | null, config: string }>>): Promise<ServiceResponse<RepoInspection>> {
    try {
      const parsed = parseRepo(input.repo)
      if (!parsed) return { success: false, error: 'Repository must be owner/name', code: 'VALIDATION_ERROR' }

      let token = input.token ?? null
      if (!token && connectionGetter) {
        const conn = await connectionGetter(input.repo)
        if (conn.success && conn.data?.secret) token = revealSecret(conn.data.secret)
      }

      const branch = input.branch || 'main'
      const tree = await this.fetchTree(parsed.owner, parsed.name, branch, token)
      if (!tree.success) return tree as ServiceResponse<RepoInspection>

      const files = tree.data ?? []
      const fileSet = new Set(files)
      const pkg = await this.fetchPackageJson(parsed.owner, parsed.name, branch, token)

      const framework = detectFramework(fileSet, pkg)
      const contentSystem = detectContentSystem(fileSet, pkg)
      const contentDir = detectContentDir(files, pkg)
      const blogDir = detectBlogDir(files, contentDir)
      const language = detectLanguageStrategy(files)
      const workflows = files.filter(path => path.startsWith('.github/workflows/'))
      const samples = await this.fetchSamples(parsed.owner, parsed.name, branch, token, files)
      const template = detectTemplateInfo(samples)
      const frontmatter = template?.frontmatter ?? null

      const inspection: RepoInspection = {
        repository: input.repo,
        branch,
        framework,
        contentSystem,
        contentDir,
        blogDir,
        language,
        template,
        frontmatter,
        sampleFiles: samples.map(sample => sample.path),
        workflows,
        detectedFiles: files.slice(0, 200),
      }

      return { success: true, data: inspection }
    } catch {
      return { success: false, error: 'Failed to inspect repository' }
    }
  }

  private async fetchTree(owner: string, name: string, branch: string, token: string | null): Promise<ServiceResponse<string[]>> {
    try {
      const ref = await githubFetch<{ object?: { sha?: string } }>(`https://api.github.com/repos/${owner}/${name}/git/ref/heads/${encodeURIComponent(branch)}`, token)
      let sha: string | null = null
      if (ref.ok && ref.data?.object?.sha) sha = ref.data.object.sha
      else {
        const repo = await githubFetch<{ default_branch?: string }>(`https://api.github.com/repos/${owner}/${name}`, token)
        const fallback = repo.data?.default_branch ?? 'main'
        const alt = await githubFetch<{ object?: { sha?: string } }>(`https://api.github.com/repos/${owner}/${name}/git/ref/heads/${encodeURIComponent(fallback)}`, token)
        if (!alt.ok || !alt.data?.object?.sha) return { success: false, error: `Branch '${branch}' not found`, code: 'NOT_FOUND' }
        sha = alt.data.object.sha
      }
      const tree = await githubFetch<{ tree?: Array<{ path?: string }> }>(`https://api.github.com/repos/${owner}/${name}/git/trees/${encodeURIComponent(sha!)}?recursive=1`, token)
      if (!tree.ok || !tree.data?.tree) return { success: false, error: 'Failed to read repository tree', code: 'NOT_FOUND' }
      return { success: true, data: normalizeTreePaths(tree.data.tree) }
    } catch {
      return { success: false, error: 'Failed to read repository tree' }
    }
  }

  private async fetchPackageJson(owner: string, name: string, branch: string, token: string | null): Promise<Record<string, unknown> | undefined> {
    try {
      const res = await githubFetch<{ content?: string, encoding?: string }>(`https://api.github.com/repos/${owner}/${name}/contents/package.json?ref=${encodeURIComponent(branch)}`, token)
      if (!res.ok || !res.data?.content) return undefined
      const decoded = Buffer.from(res.data.content, 'base64').toString('utf8')
      return parseJsonObject(decoded)
    } catch {
      return undefined
    }
  }

  private async fetchSamples(owner: string, name: string, branch: string, token: string | null, files: string[]): Promise<Array<{ path: string, content: string }>> {
    const candidates = files.filter(path => path.endsWith('.md') && (path.includes('content') || path.includes('blog') || path.includes('docs'))).slice(0, 3)
    const results: Array<{ path: string, content: string }> = []
    for (const path of candidates) {
      try {
        const res = await githubFetch<{ content?: string }>(`https://api.github.com/repos/${owner}/${name}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`, token)
        if (!res.ok || !res.data?.content) continue
        const decoded = Buffer.from(res.data.content, 'base64').toString('utf8')
        results.push({ path, content: decoded })
      } catch {
        continue
      }
    }
    return results
  }

  async checkExistingFile(repo: string, branch: string, filePath: string, token: string | null): Promise<ServiceResponse<{ exists: boolean, sha?: string }>> {
    try {
      const parsed = parseRepo(repo)
      if (!parsed) return { success: false, error: 'Invalid repo', code: 'VALIDATION_ERROR' }
      const res = await githubFetch<{ sha?: string }>(`https://api.github.com/repos/${parsed.owner}/${parsed.name}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(branch)}`, token)
      if (res.status === 404) return { success: true, data: { exists: false } }
      if (!res.ok) return { success: false, error: 'Failed to check file', code: 'NOT_FOUND' }
      return { success: true, data: { exists: true, sha: res.data?.sha } }
    } catch {
      return { success: false, error: 'Failed to check file' }
    }
  }

  async verifyAfterPublish(repo: string, branch: string, filePath: string, expectedSha: string | null, token: string | null, pullUrl?: string): Promise<ServiceResponse<{ branchExists: boolean, fileExists: boolean, commitExists: boolean, prExists: boolean }>> {
    try {
      const parsed = parseRepo(repo)
      if (!parsed) return { success: false, error: 'Invalid repo', code: 'VALIDATION_ERROR' }
      const branchCheck = await githubFetch<unknown>(`https://api.github.com/repos/${parsed.owner}/${parsed.name}/git/ref/heads/${encodeURIComponent(branch)}`, token)
      const fileCheck = await githubFetch<unknown>(`https://api.github.com/repos/${parsed.owner}/${parsed.name}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(branch)}`, token)
      let commitExists = false
      if (expectedSha) {
        const commit = await githubFetch<unknown>(`https://api.github.com/repos/${parsed.owner}/${parsed.name}/commits/${encodeURIComponent(expectedSha)}`, token)
        commitExists = commit.ok
      }
      let prExists = false
      if (pullUrl) prExists = true
      return { success: true, data: { branchExists: branchCheck.ok, fileExists: fileCheck.ok, commitExists, prExists } }
    } catch {
      return { success: false, error: 'Failed to verify' }
    }
  }
}

export const githubInspectService = new GithubInspectService()

// Pure helpers for tests
export const _helpers = {
  detectFramework,
  detectContentSystem,
  detectContentDir,
  detectBlogDir,
  detectLanguageStrategy,
  extractFrontmatter,
  frontmatterInfo,
  detectTemplateInfo,
  slugify,
  buildTargetPath,
  parseRepo,
}

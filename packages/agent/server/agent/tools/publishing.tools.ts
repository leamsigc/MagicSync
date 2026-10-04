import { defineTool, type ToolDefinition } from '@flue/runtime'
import * as v from 'valibot'
import { destinationService } from '#layers/BaseDB/server/services/destination.service'
import { githubInspectService } from '#layers/BaseDB/server/services/github-inspect.service'
import type { AgentToolContext } from '../tool-context'
import { toolFailure, toolResult } from './tool-result'

const toolError = (code: string | undefined, message: string): never => toolFailure(code, message, 'PUBLISH_ERROR')

/** Slug derived from the title when the model does not supply one. */
function slugFrom(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

/**
 * The seven publishing tools for one run. `inspect_destination` keeps its two
 * provider branches (GitHub repo inspect vs the WordPress-shaped repo inspect)
 * exactly as before — T28 only changes the tool boundary.
 */
export function createPublishingTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'inspect_destination',
      description: 'Inspect a connected GitHub repository or WordPress site to discover content structure, language handling, and frontmatter template. Never guess — the repo is the source of truth.',
      input: v.object({
        provider: v.pipe(v.string(), v.description('github or wordpress')),
        repository: v.optional(v.pipe(v.string(), v.description('GitHub repo as owner/name'))),
        branch: v.optional(v.pipe(v.string(), v.description('Branch name, default main'))),
      }),
      run: async (toolCtx) => {
        const { provider, repository, branch } = toolCtx.data
        if (provider === 'github') {
          if (!repository) toolError('VALIDATION_ERROR', 'repository is required for github')
          const result = await destinationService.inspectGithub(ctx.userId, { businessId: ctx.businessId, repository, branch }, ctx.event)
          if (!result.success) toolError(result.code, result.error)
          return toolResult(result.success ? result.data : null)
        }
        const result = await githubInspectService.inspect(ctx.userId, ctx.businessId, { repo: repository ?? '', branch: branch ?? 'main', token: null })
        if (!result.success) toolError(result.code, result.error)
        return toolResult(result.success ? result.data : null)
      },
    }),
    defineTool({
      name: 'discover_repository_content',
      description: 'List content directories, sample markdown files, and language folders for a GitHub repo. Follow the real repository structure.',
      input: v.object({
        repository: v.pipe(v.string(), v.description('GitHub repo owner/name')),
        branch: v.optional(v.string()),
      }),
      run: async (toolCtx) => {
        const { repository, branch } = toolCtx.data
        const result = await destinationService.inspectGithub(ctx.userId, { businessId: ctx.businessId, repository, branch }, ctx.event)
        if (!result.success) toolError(result.code, result.error)
        const data = result.success ? result.data : null
        return toolResult({
          contentDir: data?.contentDir,
          blogDir: data?.blogDir,
          language: data?.language,
          sampleFiles: data?.sampleFiles,
          workflows: data?.workflows,
        })
      },
    }),
    defineTool({
      name: 'preview_publication',
      description: 'Show the exact target path, template, branch and PR strategy before generating content. User can change the target.',
      input: v.object({
        provider: v.pipe(v.string(), v.description('github or wordpress')),
        language: v.pipe(v.string(), v.description('Content language, e.g. en, de, es')),
        slug: v.pipe(v.string(), v.description('Article slug, e.g. my-article')),
        repository: v.optional(v.string()),
        branch: v.optional(v.string()),
        targetPath: v.optional(v.string()),
      }),
      run: async (toolCtx) => {
        const { language, slug, repository, branch, targetPath } = toolCtx.data
        const result = await destinationService.previewGithub(ctx.userId, {
          businessId: ctx.businessId,
          repository,
          branch,
          language,
          slug,
          title: slug,
          brief: '',
          targetPath,
        }, ctx.event)
        if (!result.success) toolError(result.code, result.error)
        return toolResult(result.success ? result.data : null)
      },
    }),
    defineTool({
      name: 'prepare_github_article',
      description: 'Validate and stage a GitHub blog/article Markdown artifact for approval. Shows file diff before approval.',
      input: v.object({
        title: v.pipe(v.string(), v.description('Article title')),
        brief: v.pipe(v.string(), v.description('Content brief / summary')),
        language: v.pipe(v.string(), v.description('Language code')),
        slug: v.optional(v.pipe(v.string(), v.description('Slug, defaults from title'))),
        repository: v.optional(v.string()),
        branch: v.optional(v.string()),
        markdown: v.optional(v.pipe(v.string(), v.description('Full markdown body, optional'))),
        targetPath: v.optional(v.string()),
      }),
      run: async (toolCtx) => {
        const { title, brief, language, slug, repository, branch, markdown, targetPath } = toolCtx.data
        const result = await destinationService.prepareGithubArticle(ctx.userId, {
          businessId: ctx.businessId,
          repository,
          branch,
          language,
          slug: slug ?? slugFrom(title),
          title,
          brief,
          markdown,
          targetPath,
        }, ctx.event)
        if (!result.success) toolError(result.code, result.error)
        return toolResult(result.success ? result.data : null)
      },
    }),
    defineTool({
      name: 'prepare_wordpress_article',
      description: 'Validate and stage a WordPress post artifact for approval.',
      input: v.object({
        title: v.pipe(v.string(), v.description('Article title')),
        content: v.pipe(v.string(), v.description('Post content, HTML or Markdown')),
        slug: v.optional(v.string()),
        excerpt: v.optional(v.string()),
        category: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        status: v.optional(v.pipe(v.string(), v.description('draft or publish, default draft'))),
      }),
      run: async (toolCtx) => {
        const { title, content, slug, excerpt, category, tags, status } = toolCtx.data
        const result = await destinationService.prepareWordpressArticle(ctx.userId, {
          businessId: ctx.businessId,
          title,
          slug: slug ?? slugFrom(title),
          content,
          excerpt,
          category,
          tags,
          status: status === 'publish' ? 'publish' : 'draft',
        }, ctx.event)
        if (!result.success) toolError(result.code, result.error)
        return toolResult(result.success ? result.data : null)
      },
    }),
    defineTool({
      name: 'publish_content',
      description: 'Execute publishing of an approved artifact through the adapter (GitHub commit/PR or WordPress). Approval is required.',
      input: v.object({
        artifactId: v.pipe(v.string(), v.description('Approved artifact id')),
        connectionId: v.optional(v.string()),
      }),
      run: async (toolCtx) => {
        const { artifactId, connectionId } = toolCtx.data
        const result = await destinationService.publishGithub(ctx.userId, {
          businessId: ctx.businessId,
          artifactId,
          connectionId,
        }, ctx.event)
        if (!result.success) toolError(result.code, result.error)
        return toolResult(result.success ? result.data : null)
      },
    }),
    defineTool({
      name: 'verify_publication',
      description: 'Verify that branch, file, commit and PR/URL exist after publishing.',
      input: v.object({
        jobId: v.pipe(v.string(), v.description('Publishing job id')),
      }),
      run: async (toolCtx) => {
        const result = await destinationService.verifyGithub(ctx.userId, { businessId: ctx.businessId, jobId: toolCtx.data.jobId }, ctx.event)
        if (!result.success) toolError(result.code, result.error)
        return toolResult(result.success ? result.data : null)
      },
    }),
  ]
}

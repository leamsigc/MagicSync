import { defineTool, type ToolDefinition } from '@flue/runtime'
import * as v from 'valibot'
import { socialMediaAccountService } from '#layers/BaseDB/server/services/social-media-account.service'
import { contentChainService, type ChainContext } from '../../services/content-chain.service'
import type { AgentToolContext } from '../tool-context'
import { appApi } from './app-api'
import { toolFailure, toolResult } from './tool-result'

/**
 * Native "week plan" workflow. No MCP: accounts come from the business account
 * service, drafts from the content chain, and images from the design studio's
 * own render endpoint with the chat session.
 *
 * The tool never creates posts. It returns a preview; the chat card creates the
 * selected posts only after the owner approves.
 */

interface PlanInput {
  brief: string
  days?: number
  accountIds?: string[]
  templateId?: string
  postsPerDay?: number
  startDate?: string
  timeOfDay?: string
  feedback?: string
}

interface AccountSummary {
  id: string
  platform: string
  name: string
}

interface TemplateSummary {
  id: string
  title: string
  fields: string[]
}

interface RenderedImage {
  assetId?: string
  url?: string
  error?: string
}

const DEFAULT_DAYS = 7
const DEFAULT_POSTS_PER_DAY = 1
const DEFAULT_TIME = '10:00'

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.min(Math.max(number, min), max)
}

function accountSummary(account: { id: string, platform: string | null, accountName: string | null }): AccountSummary {
  return { id: account.id, platform: account.platform ?? 'unknown', name: account.accountName ?? account.id }
}

function uniquePlatforms(accounts: AccountSummary[]): string[] {
  return [...new Set(accounts.map(account => account.platform))]
}

function startOfDay(startDate: string | undefined): Date {
  if (!startDate) return new Date()
  const parsed = new Date(`${startDate.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

function timeParts(timeOfDay: string | undefined): [number, number] {
  const [hours, minutes] = (timeOfDay ?? DEFAULT_TIME).split(':').map(Number)
  return [Number.isFinite(hours) ? hours : 10, Number.isFinite(minutes) ? minutes : 0]
}

function scheduledAtFor(base: Date, index: number, postsPerDay: number, timeOfDay: string | undefined): string {
  const [hours, minutes] = timeParts(timeOfDay)
  const dayOffset = Math.floor(index / postsPerDay)
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + dayOffset, hours, minutes)).toISOString()
}

async function loadTemplates(ctx: AgentToolContext): Promise<TemplateSummary[]> {
  const response = await appApi<{ data?: Array<{ id?: string, title?: string, fields?: string[] }> }>(ctx, '/api/v1/image-editor/designs', {
    query: { scope: 'public', limit: 50 },
  })
  return (response.data ?? []).flatMap((template): TemplateSummary[] => {
    if (!template.id) return []
    return [{ id: template.id, title: template.title ?? 'Design template', fields: template.fields ?? [] }]
  })
}

async function loadTemplateFields(ctx: AgentToolContext, templateId: string): Promise<string[]> {
  try {
    const design = await appApi<{ document?: { fields?: Array<{ name?: string }> } }>(ctx, `/api/v1/image-editor/designs/${templateId}`)
    return (design.document?.fields ?? []).flatMap(field => typeof field.name === 'string' ? [field.name] : [])
  }
  catch {
    return []
  }
}

function templateRow(fields: string[], caption: string, index: number): Record<string, string> {
  const names = fields.length > 0 ? fields : ['title', 'content']
  const row: Record<string, string> = {}
  if (names.includes('title')) row.title = `Day ${index + 1}`
  if (names.includes('content')) row.content = caption
  const textField = names.find(name => name !== 'title' && name !== 'content')
  if (textField) row[textField] = caption
  return row
}

function chainContext(ctx: AgentToolContext): ChainContext {
  if (!ctx.complete) toolFailure('MODEL_UNAVAILABLE', 'No provider model is configured for this run', 'WEEK_PLAN_FAILED')
  return { userId: ctx.userId, businessId: ctx.businessId, complete: ctx.complete, event: ctx.event }
}

async function renderImages(ctx: AgentToolContext, templateId: string, fields: string[], captions: string[]): Promise<Map<number, RenderedImage>> {
  const rows = captions.map((caption, index) => templateRow(fields, caption, index))
  const response = await appApi<{ renders?: Array<{ index?: number, assetId?: string, url?: string }> }>(ctx, '/api/v1/image-editor/batch', {
    method: 'POST',
    body: { templateId, rows, output: 'assets', format: 'png', businessId: ctx.businessId },
  })
  const images = new Map<number, RenderedImage>()
  for (const render of response.renders ?? []) {
    if (typeof render.index !== 'number') continue
    images.set(render.index, { assetId: render.assetId, url: render.url })
  }
  return images
}

async function resolveTemplate(ctx: AgentToolContext, templateId: string | undefined, templates: TemplateSummary[]): Promise<TemplateSummary | undefined> {
  if (templateId) {
    const found = templates.find(entry => entry.id === templateId)
    if (found) return found
    return { id: templateId, title: 'Selected template', fields: await loadTemplateFields(ctx, templateId) }
  }
  return templates[0]
}

async function planWeek(ctx: AgentToolContext, input: PlanInput) {
  const days = clamp(input.days, 1, 14, DEFAULT_DAYS)
  const postsPerDay = clamp(input.postsPerDay, 1, 3, DEFAULT_POSTS_PER_DAY)
  const accounts = (await socialMediaAccountService.getAccountsByBusinessId(ctx.businessId)).map(accountSummary)
  const selected = input.accountIds?.length
    ? accounts.filter(account => input.accountIds?.includes(account.id))
    : []

  if (selected.length === 0) {
    return toolResult({
      requiresAccounts: true,
      brief: input.brief,
      accounts,
      message: accounts.length === 0
        ? 'No social accounts are connected. Connect an account first.'
        : 'Ask the owner which social accounts to use, then call plan_week_posts again with accountIds.',
    })
  }

  const templates = await loadTemplates(ctx)
  const template = await resolveTemplate(ctx, input.templateId, templates)

  if (!template || !template.id) {
    return toolResult({
      requiresTemplate: true,
      brief: input.brief,
      accounts: selected,
      templates,
      message: 'No design templates were found. Create or publish a template first.',
    })
  }

  const count = days * postsPerDay
  const brief = input.feedback ? `${input.brief}\n\nRevision feedback: ${input.feedback}` : input.brief
  const drafts = await contentChainService.writePostsBatch(chainContext(ctx), {
    brief,
    count,
    platforms: uniquePlatforms(selected),
  })
  if (!drafts.success) return toolFailure(drafts.code, drafts.error, 'WEEK_PLAN_FAILED')

  const base = startOfDay(input.startDate)
  const captions = drafts.data.map(draft => draft.caption)
  const images = await renderImages(ctx, template.id, template.fields, captions)
  const posts = drafts.data.map((draft, index) => ({
    index,
    scheduledAt: scheduledAtFor(base, index, postsPerDay, input.timeOfDay),
    caption: draft.caption,
    platformVariants: draft.platformVariants,
    claims: draft.claims,
    image: images.get(index) ?? null,
  }))

  return toolResult({
    plan: {
      brief: input.brief,
      feedback: input.feedback ?? '',
      days,
      postsPerDay,
      template: { id: template.id, title: template.title },
      accounts: selected,
      platforms: uniquePlatforms(selected),
      posts,
    },
    message: 'Preview only. Nothing has been created. Ask the owner to approve all, approve selected, or request changes.',
  })
}

export function createWeekPlanTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'plan_week_posts',
      description: 'Plan several days of social posts with an image per post from a design template. Ask which accounts first; call again with accountIds. Returns a preview only; the owner approves before anything is created.',
      input: v.object({
        brief: v.pipe(v.string(), v.description('What the posts are about')),
        days: v.optional(v.pipe(v.number(), v.description('How many days to plan (1-14, default 7)'))),
        accountIds: v.optional(v.pipe(v.array(v.string()), v.description('Connected social account ids from list-social-accounts'))),
        templateId: v.optional(v.pipe(v.string(), v.description('Design template id; defaults to the first public template'))),
        postsPerDay: v.optional(v.pipe(v.number(), v.description('Posts per day (1-3, default 1)'))),
        startDate: v.optional(v.pipe(v.string(), v.description('ISO date to start (default today)'))),
        timeOfDay: v.optional(v.pipe(v.string(), v.description('HH:mm UTC posting time (default 10:00)'))),
        feedback: v.optional(v.pipe(v.string(), v.description('Owner feedback when revising a previous plan'))),
      }),
      run: async toolCtx => planWeek(ctx, toolCtx.data),
    }),
  ]
}

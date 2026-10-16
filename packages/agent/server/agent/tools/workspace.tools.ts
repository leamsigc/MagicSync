import { defineTool, type ToolDefinition } from '@flue/runtime'
import * as v from 'valibot'
import { analyticsService } from '#layers/BaseDB/server/services/analytics.service'
import { businessProfileService } from '#layers/BaseDB/server/services/business-profile.service'
import { postService } from '#layers/BaseDB/server/services/post.service'
import type { AgentToolContext } from '../tool-context'
import { toolFailure, toolResult } from './tool-result'

const toolError = (code: string | undefined, message: string): never => toolFailure(code, message, 'WORKSPACE_ERROR')

/** Only the fields a caller actually sent, so a patch never blanks a column. */
function definedStrings(source: Record<string, unknown>): Record<string, string> {
  const patch: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string' && value.trim().length > 0) patch[key] = value.trim()
  }
  return patch
}

function parseDate(value: string, field: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) toolError('VALIDATION_ERROR', `${field} must be an ISO date`)
  return date
}

/** Business profile reads/writes, performance stats, and the calendar window. */
export function createWorkspaceTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'get_business_profile',
      description: 'Read the active business profile: name, website, category, phone, address.',
      input: v.object({}),
      run: async () => {
        const result = await businessProfileService.findById(ctx.businessId, ctx.userId, ctx.event)
        if (!result.success || !result.data) toolError(result.code, result.error ?? 'Business not found')
        const business = result.data
        return toolResult({
          id: business.id,
          name: business.name,
          description: business.description,
          website: business.website,
          category: business.category,
          phone: business.phone,
          address: business.address,
        })
      },
    }),
    defineTool({
      name: 'update_business_profile',
      description: 'Update the active business profile. Only the fields you pass are changed.',
      input: v.object({
        name: v.optional(v.pipe(v.string(), v.description('Business name'))),
        description: v.optional(v.pipe(v.string(), v.description('Short description'))),
        website: v.optional(v.pipe(v.string(), v.description('Website URL'))),
        category: v.optional(v.pipe(v.string(), v.description('Business category'))),
        phone: v.optional(v.pipe(v.string(), v.description('Contact phone'))),
        address: v.optional(v.pipe(v.string(), v.description('Street address'))),
      }),
      run: async (toolCtx) => {
        const patch = definedStrings(toolCtx.data)
        if (Object.keys(patch).length === 0) toolError('VALIDATION_ERROR', 'Pass at least one field to update')
        const result = await businessProfileService.update(ctx.businessId, ctx.userId, patch)
        if (!result.success) toolError(result.code, result.error)
        return toolResult({ updated: true, fields: Object.keys(patch) })
      },
    }),
    defineTool({
      name: 'get_performance_stats',
      description: 'Read top-performing posts and metrics for the business, optionally one platform.',
      input: v.object({
        platform: v.optional(v.pipe(v.string(), v.description('Limit to one platform, e.g. instagram'))),
        days: v.optional(v.pipe(v.number(), v.description('Lookback window in days (default 30)'))),
        limit: v.optional(v.pipe(v.number(), v.description('How many posts (default 5, max 20)'))),
      }),
      run: async (toolCtx) => {
        const days = Math.min(Math.max(toolCtx.data.days ?? 30, 1), 365)
        const limit = Math.min(Math.max(toolCtx.data.limit ?? 5, 1), 20)
        const result = await analyticsService.getBestPosts(ctx.userId, ctx.businessId, {
          days,
          platform: toolCtx.data.platform,
          limit,
        }, ctx.event)
        if (!result.success) toolError(result.code, result.error)
        return toolResult({ days, platform: toolCtx.data.platform ?? null, ...result.data })
      },
    }),
    defineTool({
      name: 'list_calendar_posts',
      description: 'List posts scheduled between two ISO dates for the active business.',
      input: v.object({
        start: v.pipe(v.string(), v.description('ISO start date (inclusive)')),
        end: v.pipe(v.string(), v.description('ISO end date (exclusive)')),
      }),
      run: async (toolCtx) => {
        const start = parseDate(toolCtx.data.start, 'start')
        const end = parseDate(toolCtx.data.end, 'end')
        if (end <= start) toolError('VALIDATION_ERROR', 'end must be after start')
        const result = await postService.findByBusinessIdsForRange(ctx.userId, {
          start,
          end,
          businessIds: [ctx.businessId],
        })
        if (!result.success) toolError(result.code, result.error)
        const posts = (result.data ?? []).map(post => ({
          id: post.id,
          content: post.content.slice(0, 200),
          status: post.status,
          scheduledAt: post.scheduledAt,
        }))
        return toolResult({ start: start.toISOString(), end: end.toISOString(), posts })
      },
    }),
  ]
}

import { defineTool, type ToolDefinition } from '@flue/runtime'
import * as v from 'valibot'
import { analyticsService } from '#layers/BaseDB/server/services/analytics.service'
import { templateService } from '#layers/BaseDB/server/services/template.service'
import type { AgentToolContext } from '../tool-context'
import { toolFailure, toolResult } from './tool-result'

const toolError = (code: string | undefined, message: string): never => toolFailure(code, message, 'TEMPLATE_ERROR')

const TEMPLATE_TYPES = ['EMAIL', 'IMAGES', 'CHAT', 'VARIABLE'] as const

/** Workspace templates (email/image/chat/variable) and content templates. */
export function createTemplateTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'list_templates',
      description: 'List the business\'s saved templates (email, images, chat, variables).',
      input: v.object({
        type: v.optional(v.pipe(v.picklist(TEMPLATE_TYPES), v.description('Filter to one template type'))),
        limit: v.optional(v.pipe(v.number(), v.description('Max templates (default 20)'))),
      }),
      run: async (toolCtx) => {
        const limit = Math.min(Math.max(toolCtx.data.limit ?? 20, 1), 50)
        const result = await templateService.findByOwner(ctx.userId, { pagination: { page: 1, limit } })
        if (!result.success) toolError(result.error, 'Failed to list templates')
        const templates = (result.data ?? [])
          .filter(template => !toolCtx.data.type || template.type === toolCtx.data.type)
          .map(template => ({ id: template.id, name: template.title, type: template.type }))
        return toolResult({ templates })
      },
    }),
    defineTool({
      name: 'list_content_templates',
      description: 'List the business\'s content templates (reusable content recipes).',
      input: v.object({}),
      run: async () => {
        const result = await analyticsService.listTemplates(ctx.userId, ctx.businessId, ctx.event)
        if (!result.success) toolError(result.code, result.error)
        const templates = (result.data ?? []).map(template => ({
          id: template.id,
          name: template.name,
          status: template.status,
          platform: template.platform,
        }))
        return toolResult({ templates })
      },
    }),
    defineTool({
      name: 'apply_content_template',
      description: 'Generate a draft from a content template for a new theme; returns the new artifact.',
      input: v.object({
        templateId: v.pipe(v.string(), v.description('Content template id')),
        theme: v.pipe(v.string(), v.description('What the new piece should be about')),
      }),
      run: async (toolCtx) => {
        const result = await analyticsService.applyTemplate(
          ctx.userId,
          ctx.businessId,
          toolCtx.data.templateId,
          toolCtx.data.theme,
          { useBusinessContext: true },
          ctx.event,
        )
        if (!result.success) toolError(result.code, result.error)
        return toolResult(result.data)
      },
    }),
  ]
}

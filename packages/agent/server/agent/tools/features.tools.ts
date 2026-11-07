import { defineTool, type ToolDefinition } from '@flue/runtime'
import * as v from 'valibot'
import type { AgentToolContext } from '../tool-context'
import { appApi } from './app-api'
import { toolFailure, toolResult } from './tool-result'

/**
 * Chat is the operator surface: it can reach every feature the `/mcp` server
 * exposes (posts, media, image editor, analytics, platforms, menu boards,
 * carousels, auto-reply) without mounting 63 schemas in one turn. `list_features`
 * discovers and `use_feature` dispatches through the site's feature route, which
 * runs the exact MCP handler under the chat session's identity.
 */

interface FeatureQuery {
  group?: string
  query?: string
  feature?: string
}

interface FeatureCatalogResponse {
  total: number
  groups: Array<{ name: string, features: Array<{ name: string, description: string }> }>
  feature?: { name: string, group: string, description: string, fields: unknown[] }
}

function catalogQuery(ctx: AgentToolContext, input: FeatureQuery): string {
  const params = new URLSearchParams({ businessId: ctx.businessId })
  for (const key of ['group', 'query', 'feature'] as const) {
    const value = input[key]?.trim()
    if (value) params.set(key, value)
  }
  return params.toString()
}

async function listFeatures(ctx: AgentToolContext, input: FeatureQuery) {
  const catalog = await appApi<FeatureCatalogResponse>(ctx, `/api/v1/agent/features?${catalogQuery(ctx, input)}`)
  if (catalog.feature) return toolResult(catalog.feature)
  return toolResult({
    total: catalog.total,
    groups: catalog.groups.map(group => ({
      group: group.name,
      features: group.features.map(feature => ({ name: feature.name, description: feature.description })),
    })),
    hint: 'Call list_features with feature=<name> to see its arguments, then use_feature with those arguments.',
  })
}

interface FeatureInvocation {
  success: boolean
  data?: unknown
  error?: string
}

async function useFeature(ctx: AgentToolContext, input: { feature: string, arguments?: Record<string, unknown> }) {
  const response = await appApi<FeatureInvocation>(ctx, '/api/v1/agent/features/invoke', {
    method: 'POST',
    body: {
      businessId: ctx.businessId,
      feature: input.feature,
      arguments: input.arguments ?? {},
    },
  })
  if (!response.success) toolFailure('FEATURE_ERROR', response.error ?? `Feature "${input.feature}" failed`, 'FEATURE_ERROR')
  return toolResult({ feature: input.feature, result: response.data })
}

export function createFeatureTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'list_features',
      description: 'List every product feature this chat can operate (posts, media, image editor, analytics, platforms, carousels, menu boards). Pass feature=<name> for its arguments.',
      input: v.object({
        group: v.optional(v.pipe(v.string(), v.description('Only this group, e.g. posts, media, image-editor'))),
        query: v.optional(v.pipe(v.string(), v.description('Search names and descriptions'))),
        feature: v.optional(v.pipe(v.string(), v.description('Show one feature\'s exact arguments'))),
      }),
      run: async toolCtx => listFeatures(ctx, toolCtx.data),
    }),
    defineTool({
      name: 'use_feature',
      description: 'Run any product feature by name with validated arguments. Use list_features first to find the name and its fields.',
      input: v.object({
        feature: v.pipe(v.string(), v.description('Feature name from list_features, e.g. create-post, preview-post, render-design')),
        arguments: v.optional(v.pipe(v.record(v.string(), v.unknown()), v.description('Arguments object matching the feature fields'))),
      }),
      run: async toolCtx => useFeature(ctx, {
        feature: toolCtx.data.feature,
        arguments: toolCtx.data.arguments as Record<string, unknown> | undefined,
      }),
    }),
  ]
}

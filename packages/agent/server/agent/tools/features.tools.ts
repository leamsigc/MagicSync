import { defineTool, type ToolDefinition } from '@flue/runtime'
import * as v from 'valibot'
import type { AgentToolContext } from '../tool-context'
import { listNativeFeatures, nativeFeatureDetail, runNativeFeature, type FeatureSummary } from '../features/catalog'
import { toolFailure, toolResult } from './tool-result'

/**
 * Native chat capabilities. There is no MCP call in this path: every feature
 * maps to a product `/api/v1/*` route, executed with the chat session's cookies,
 * and those routes enforce owner/member access for the active business.
 */

interface FeatureQuery {
  group?: string
  query?: string
  feature?: string
}

function matches(feature: FeatureSummary, group?: string, query?: string): boolean {
  if (group && feature.group !== group) return false
  if (!query) return true
  const needle = query.toLowerCase()
  return feature.name.includes(needle) || feature.description.toLowerCase().includes(needle)
}

function groupFeatures(features: FeatureSummary[]) {
  const groups = new Map<string, FeatureSummary[]>()
  for (const feature of features) {
    const list = groups.get(feature.group) ?? []
    list.push(feature)
    groups.set(feature.group, list)
  }
  return [...groups.entries()].map(([group, entries]) => ({ group, features: entries }))
}

async function listFeatures(_ctx: AgentToolContext, input: FeatureQuery) {
  if (input.feature) {
    const detail = nativeFeatureDetail(input.feature)
    if (!detail) toolFailure('NOT_FOUND', `Unknown feature "${input.feature}"`, 'FEATURE_ERROR')
    return toolResult(detail)
  }
  const features = listNativeFeatures().filter(feature => matches(feature, input.group, input.query))
  return toolResult({
    total: features.length,
    groups: groupFeatures(features),
    hint: 'Call list_features with feature=<name> to see its arguments, then use_feature with those arguments.',
  })
}

interface FeatureInvocation {
  success: boolean
  data?: unknown
  error?: string
}

async function useFeature(ctx: AgentToolContext, input: { feature: string, arguments?: Record<string, unknown> }) {
  try {
    const result = await runNativeFeature(ctx, input.feature, input.arguments ?? {})
    return toolResult({ feature: input.feature, result })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : `Feature "${input.feature}" failed`
    toolFailure('FEATURE_ERROR', message, 'FEATURE_ERROR')
  }
}

export function createFeatureTools(ctx: AgentToolContext): ToolDefinition[] {
  return [
    defineTool({
      name: 'list_features',
      description: 'List every native product feature this chat can operate (accounts, posts, media, designs, templates, analytics, business). Pass feature=<name> for its arguments.',
      input: v.object({
        group: v.optional(v.pipe(v.string(), v.description('Only this group, e.g. posts, designs, media'))),
        query: v.optional(v.pipe(v.string(), v.description('Search names and descriptions'))),
        feature: v.optional(v.pipe(v.string(), v.description('Show one feature\'s exact arguments'))),
      }),
      run: async toolCtx => listFeatures(ctx, toolCtx.data),
    }),
    defineTool({
      name: 'use_feature',
      description: 'Run any native product feature by name with validated arguments. Use list_features first to find the name and its fields.',
      input: v.object({
        feature: v.pipe(v.string(), v.description('Feature name from list_features, e.g. list-posts, create-post, render-design-batch')),
        arguments: v.optional(v.pipe(v.record(v.string(), v.unknown()), v.description('Arguments object matching the feature fields'))),
      }),
      run: async toolCtx => useFeature(ctx, {
        feature: toolCtx.data.feature,
        arguments: toolCtx.data.arguments as Record<string, unknown> | undefined,
      }),
    }),
  ]
}

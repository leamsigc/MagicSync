import { z } from 'zod'
import { tools as resolvedTools } from '#nuxt-mcp-toolkit/tools.mjs'
import type { ApiKeyContext } from '#layers/BaseAuth/server/services/api-key.service'
import { runWithMcpContext } from './mcp-request'

/**
 * Chat ↔ MCP feature bridge.
 *
 * The MCP toolkit generates `#nuxt-mcp-toolkit/tools.mjs` at build time from
 * every `server/mcp/tools/**` file. The chat cannot mount all of them (Flue's
 * per-turn tool budget plus small-model schema limits), so it mounts two
 * dispatcher tools instead: `list_features` reads this catalog and
 * `use_feature` executes one entry with validated arguments.
 *
 * The handlers still run through the MCP request store, so the shared
 * `requireMcp()` / `resolveUserId()` helpers keep working unchanged. The chat
 * session supplies the same `ApiKeyContext` shape an API key would.
 */

export interface FeatureField {
  name: string
  type: string
  required: boolean
  description?: string
  options?: string[]
}

export interface FeatureSummary {
  name: string
  group: string
  description: string
}

export interface FeatureDetail extends FeatureSummary {
  fields: FeatureField[]
}

interface ResolvedTool {
  name?: string
  description?: string
  inputSchema?: z.ZodRawShape
  _meta?: { filename?: string, group?: string }
  handler: (args: never, extra: never) => unknown
}

interface JsonSchemaNode {
  type?: string | string[]
  enum?: unknown[]
  description?: string
  items?: JsonSchemaNode
  anyOf?: JsonSchemaNode[]
  oneOf?: JsonSchemaNode[]
}

interface JsonSchemaObject extends JsonSchemaNode {
  properties?: Record<string, JsonSchemaNode>
  required?: string[]
}

const FEATURE_TOOLS = resolvedTools as ResolvedTool[]

function kebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[_\s]+/g, '-').toLowerCase()
}

function featureNameOf(tool: ResolvedTool): string {
  if (tool.name) return kebabCase(tool.name)
  const filename = tool._meta?.filename ?? ''
  return kebabCase(filename.replace(/\.(ts|js|mts|mjs)$/, ''))
}

function featureGroupOf(tool: ResolvedTool): string {
  return tool._meta?.group ?? 'general'
}

function featureSummaryOf(tool: ResolvedTool): FeatureSummary {
  return {
    name: featureNameOf(tool),
    group: featureGroupOf(tool),
    description: tool.description ?? '',
  }
}

function toJsonSchema(shape: z.ZodRawShape | undefined): JsonSchemaObject | null {
  if (!shape) return null
  try {
    return z.toJSONSchema(z.object(shape)) as JsonSchemaObject
  }
  catch {
    return null
  }
}

function typeOf(node: JsonSchemaNode | undefined): string {
  if (!node) return 'unknown'
  const variant = node.anyOf?.[0] ?? node.oneOf?.[0]
  if (variant) return typeOf(variant)
  if (Array.isArray(node.type)) return node.type.join(' | ')
  if (node.type === 'array' && node.items) return `array<${typeOf(node.items)}>`
  return node.type ?? 'unknown'
}

function fieldOf(name: string, node: JsonSchemaNode, required: boolean): FeatureField {
  return {
    name,
    type: typeOf(node),
    required,
    ...(node.description ? { description: node.description } : {}),
    ...(node.enum ? { options: node.enum.map(String) } : {}),
  }
}

function fieldsOf(tool: ResolvedTool): FeatureField[] {
  const schema = toJsonSchema(tool.inputSchema)
  if (!schema?.properties) return []
  const required = new Set(schema.required ?? [])
  return Object.entries(schema.properties).map(([name, node]) => fieldOf(name, node, required.has(name)))
}

function detailOf(tool: ResolvedTool): FeatureDetail {
  return { ...featureSummaryOf(tool), fields: fieldsOf(tool) }
}

export function listFeatures(): FeatureSummary[] {
  return FEATURE_TOOLS.map(featureSummaryOf).sort((a, b) => a.name.localeCompare(b.name))
}

export function findFeature(name: string): ResolvedTool | undefined {
  const wanted = kebabCase(name)
  return FEATURE_TOOLS.find(tool => featureNameOf(tool) === wanted)
}

export function featureDetail(name: string): FeatureDetail | undefined {
  const tool = findFeature(name)
  return tool ? detailOf(tool) : undefined
}

function parseArguments(tool: ResolvedTool, raw: unknown): { success: true, data: unknown } | { success: false, error: string } {
  if (!tool.inputSchema) return { success: true, data: raw ?? {} }
  const parsed = z.object(tool.inputSchema).safeParse(raw ?? {})
  if (parsed.success) return { success: true, data: parsed.data }
  return { success: false, error: parsed.error.issues.map(issue => `${issue.path.join('.') || 'arguments'}: ${issue.message}`).join('; ') }
}

function textOfContent(result: unknown): unknown {
  const content = (result as { content?: Array<{ type?: string, text?: string }> } | null)?.content
  if (!Array.isArray(content)) return result
  const text = content.filter(block => block.type === 'text').map(block => block.text ?? '').join('\n')
  try {
    return JSON.parse(text) as unknown
  }
  catch {
    return text
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export interface FeatureInvocation {
  success: boolean
  data?: unknown
  error?: string
}

/**
 * Execute one MCP feature under a synthetic chat session context. Failures are
 * returned (never thrown) so the agent can explain a bad argument set instead
 * of losing the turn.
 */
export async function invokeFeature(
  name: string,
  rawArguments: unknown,
  mcp: ApiKeyContext,
  headers: Record<string, string | string[] | undefined>,
): Promise<FeatureInvocation> {
  const tool = findFeature(name)
  if (!tool) return { success: false, error: `Unknown feature "${name}". Call list_features first.` }

  const parsed = parseArguments(tool, rawArguments)
  if (!parsed.success) return { success: false, error: parsed.error }

  try {
    const result = await runWithMcpContext(
      { mcp, headers },
      () => tool.handler(parsed.data as never, { signal: AbortSignal.timeout(120_000) } as never),
    )
    return { success: true, data: textOfContent(result) }
  }
  catch (error) {
    return { success: false, error: errorMessage(error) }
  }
}

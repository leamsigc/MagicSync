import type { AgentToolContext } from '../tool-context'
import { appApi } from '../tools/app-api'

/**
 * Native feature catalog for the chat operator.
 *
 * The chat does **not** go through MCP. Each entry maps to a product API route
 * (`/api/v1/...`) and is called with the chat request's cookies. Those routes
 * already enforce owner/member access with `requireBusinessAccess`, and the
 * server-owned `ctx.businessId` is injected into every business-scoped call —
 * never accepted from the model.
 */

export type FeatureGroup = 'accounts' | 'posts' | 'media' | 'designs' | 'templates' | 'analytics' | 'business' | 'content'

export interface FeatureField {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required?: boolean
  description?: string
  values?: string[]
}

interface FeatureArgs {
  [key: string]: unknown
}

export interface FeatureContext {
  businessId: string
}

export interface FeatureDefinition {
  name: string
  group: FeatureGroup
  description: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: (args: FeatureArgs, ctx: FeatureContext) => string
  query?: (args: FeatureArgs, ctx: FeatureContext) => Record<string, unknown>
  body?: (args: FeatureArgs, ctx: FeatureContext) => unknown
  fields: FeatureField[]
}

function str(args: FeatureArgs, key: string): string | undefined {
  const value = args[key]
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function num(args: FeatureArgs, key: string): number | undefined {
  const value = args[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value)
  return undefined
}

function arr(args: FeatureArgs, key: string): string[] {
  const value = args[key]
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '') : []
}

function rec(args: FeatureArgs, key: string): Record<string, unknown> {
  const value = args[key]
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function requireStr(args: FeatureArgs, key: string): string {
  const value = str(args, key)
  if (!value) throw new Error(`Missing required argument: ${key}`)
  return value
}

function compact(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined && value !== ''))
}

const business = (ctx: FeatureContext) => ctx.businessId

export const NATIVE_FEATURES: FeatureDefinition[] = [
  {
    name: 'list-social-accounts',
    group: 'accounts',
    description: 'List the social accounts connected to this business with their account ids and platforms. Call this before asking which accounts to post to.',
    method: 'GET',
    path: () => '/api/v1/social-accounts',
    query: (_args, ctx) => ({ businessId: business(ctx) }),
    fields: [],
  },
  {
    name: 'list-posts',
    group: 'posts',
    description: 'List posts for this business, newest first. Filter by status, date range or platform.',
    method: 'GET',
    path: () => '/api/v1/posts',
    query: (args, ctx) => compact({
      businessId: business(ctx),
      page: num(args, 'page') ?? 1,
      limit: num(args, 'limit') ?? 10,
      status: str(args, 'status'),
      startDate: str(args, 'startDate'),
      endDate: str(args, 'endDate'),
      platforms: arr(args, 'platforms').join(',') || undefined,
    }),
    fields: [
      { name: 'status', type: 'string', description: 'pending, scheduled, published or failed' },
      { name: 'startDate', type: 'string', description: 'ISO date lower bound' },
      { name: 'endDate', type: 'string', description: 'ISO date upper bound' },
      { name: 'platforms', type: 'array', description: 'Platform names, e.g. ["twitter","instagram"]' },
      { name: 'page', type: 'number' },
      { name: 'limit', type: 'number' },
    ],
  },
  {
    name: 'get-post',
    group: 'posts',
    description: 'Read one post with its per-platform status and attached media.',
    method: 'GET',
    path: args => `/api/v1/posts/${requireStr(args, 'postId')}`,
    fields: [{ name: 'postId', type: 'string', required: true }],
  },
  {
    name: 'create-post',
    group: 'posts',
    description: 'Create one social post. Pass connected account ids in accountIds, the exact approved caption in content, and an ISO datetime in scheduledAt. Omit status to schedule it.',
    method: 'POST',
    path: () => '/api/v1/posts',
    body: (args, ctx) => ({
      businessId: business(ctx),
      content: requireStr(args, 'content'),
      targetPlatforms: arr(args, 'accountIds'),
      mediaAssets: arr(args, 'mediaAssetIds'),
      scheduledAt: str(args, 'scheduledAt') ?? new Date().toISOString(),
      status: str(args, 'status') ?? 'scheduled',
      platformContent: rec(args, 'platformContent'),
      postFormat: str(args, 'postFormat') ?? 'post',
      comment: [],
    }),
    fields: [
      { name: 'content', type: 'string', required: true, description: 'Exact post caption' },
      { name: 'accountIds', type: 'array', required: true, description: 'Connected social account ids' },
      { name: 'scheduledAt', type: 'string', description: 'ISO datetime; defaults to now' },
      { name: 'mediaAssetIds', type: 'array', description: 'Asset ids from list-media or render-design-batch' },
      { name: 'platformContent', type: 'object', description: 'Per-platform caption overrides' },
      { name: 'status', type: 'string', values: ['scheduled', 'published', 'draft'] },
    ],
  },
  {
    name: 'update-post',
    group: 'posts',
    description: 'Update a post caption, accounts, media, time or status.',
    method: 'PUT',
    path: args => `/api/v1/posts/${requireStr(args, 'postId')}`,
    body: args => ({
      content: str(args, 'content'),
      targetPlatforms: arr(args, 'accountIds'),
      mediaAssets: arr(args, 'mediaAssetIds'),
      scheduledAt: str(args, 'scheduledAt') ?? new Date().toISOString(),
      status: str(args, 'status') ?? 'pending',
      platformContent: rec(args, 'platformContent'),
      postFormat: str(args, 'postFormat') ?? 'post',
      comment: [],
    }),
    fields: [
      { name: 'postId', type: 'string', required: true },
      { name: 'content', type: 'string' },
      { name: 'accountIds', type: 'array' },
      { name: 'scheduledAt', type: 'string' },
      { name: 'mediaAssetIds', type: 'array' },
      { name: 'status', type: 'string', values: ['pending', 'published', 'failed'] },
    ],
  },
  {
    name: 'list-media',
    group: 'media',
    description: 'List images, videos and documents in the business media library, newest first.',
    method: 'GET',
    path: () => '/api/v1/assets',
    query: (args, ctx) => compact({
      businessId: business(ctx),
      page: num(args, 'page') ?? 1,
      limit: num(args, 'limit') ?? 20,
      mimeType: str(args, 'mimeType'),
    }),
    fields: [
      { name: 'mimeType', type: 'string', values: ['image', 'video'] },
      { name: 'page', type: 'number' },
      { name: 'limit', type: 'number' },
    ],
  },
  {
    name: 'create-asset-from-url',
    group: 'media',
    description: 'Import an image or file from a public URL into the business media library.',
    method: 'POST',
    path: () => '/api/v1/assets',
    body: (args, ctx) => ({
      businessId: business(ctx),
      url: requireStr(args, 'url'),
      originalName: str(args, 'originalName'),
    }),
    fields: [
      { name: 'url', type: 'string', required: true, description: 'Public http(s) URL' },
      { name: 'originalName', type: 'string' },
    ],
  },
  {
    name: 'list-design-templates',
    group: 'designs',
    description: 'List design templates usable for generated images. Use scope public for the template library, mine for the user\'s own designs.',
    method: 'GET',
    path: () => '/api/v1/image-editor/designs',
    query: args => compact({
      scope: str(args, 'scope') ?? 'public',
      q: str(args, 'q'),
      page: num(args, 'page') ?? 1,
      limit: num(args, 'limit') ?? 50,
    }),
    fields: [
      { name: 'scope', type: 'string', values: ['public', 'mine'], description: 'Template library or own designs' },
      { name: 'q', type: 'string' },
      { name: 'page', type: 'number' },
      { name: 'limit', type: 'number' },
    ],
  },
  {
    name: 'duplicate-design-template',
    group: 'designs',
    description: 'Instantiate a template as an editable design owned by the user. Returns the new design id so it can be opened in the editor and rendered with render-design-batch.',
    method: 'POST',
    path: args => `/api/v1/image-editor/designs/${requireStr(args, 'templateId')}/duplicate`,
    body: args => ({ title: str(args, 'title') }),
    fields: [
      { name: 'templateId', type: 'string', required: true, description: 'Template id from list-design-templates' },
      { name: 'title', type: 'string', description: 'Title for the editable copy' },
    ],
  },
  {
    name: 'render-design-batch',
    group: 'designs',
    description: 'Render one image per row from a design template and store each render as an asset. rows must use the template field names; title/content/text_3 are auto-exposed for field-less designs.',
    method: 'POST',
    path: () => '/api/v1/image-editor/batch',
    body: (args, ctx) => ({
      templateId: requireStr(args, 'templateId'),
      rows: Array.isArray(args.rows) ? args.rows : [],
      output: 'assets',
      format: str(args, 'format') ?? 'png',
      scale: num(args, 'scale') ?? 1,
      page: num(args, 'page') ?? 0,
      businessId: business(ctx),
    }),
    fields: [
      { name: 'templateId', type: 'string', required: true, description: 'Design/template id from list-design-templates' },
      { name: 'rows', type: 'array', required: true, description: 'One object of field values per image' },
      { name: 'format', type: 'string', values: ['png', 'jpeg', 'webp'] },
      { name: 'scale', type: 'number' },
      { name: 'page', type: 'number' },
    ],
  },
  {
    name: 'list-workspace-templates',
    group: 'templates',
    description: 'List the business workspace templates (post, image, email, chat).',
    method: 'GET',
    path: () => '/api/v1/templates',
    query: (args, ctx) => compact({
      businessId: business(ctx),
      page: num(args, 'page') ?? 1,
      limit: num(args, 'limit') ?? 20,
      type: str(args, 'type'),
    }),
    fields: [
      { name: 'type', type: 'string' },
      { name: 'page', type: 'number' },
      { name: 'limit', type: 'number' },
    ],
  },
  {
    name: 'list-content-templates',
    group: 'templates',
    description: 'List reusable content templates with their themes and platforms.',
    method: 'GET',
    path: () => '/api/v1/content-templates',
    query: (_args, ctx) => ({ businessId: business(ctx) }),
    fields: [],
  },
  {
    name: 'create-workspace-template',
    group: 'templates',
    description: 'Create a reusable workspace template (EMAIL, IMAGES, CHAT or VARIABLE) for this business.',
    method: 'POST',
    path: () => '/api/v1/templates',
    body: (args, ctx) => ({
      businessId: business(ctx),
      type: requireStr(args, 'type'),
      title: requireStr(args, 'title'),
      content: requireStr(args, 'content'),
      isPublic: args.isPublic === true,
      assets: [],
    }),
    fields: [
      { name: 'type', type: 'string', required: true, values: ['EMAIL', 'IMAGES', 'CHAT', 'VARIABLE'] },
      { name: 'title', type: 'string', required: true },
      { name: 'content', type: 'string', required: true, description: 'Template body/markdown' },
      { name: 'isPublic', type: 'boolean' },
    ],
  },
  {
    name: 'apply-content-template',
    group: 'templates',
    description: 'Generate a draft from a content template for a new theme.',
    method: 'POST',
    path: args => `/api/v1/content-templates/${requireStr(args, 'templateId')}/apply`,
    body: (args, ctx) => ({
      businessId: business(ctx),
      theme: requireStr(args, 'theme'),
      useBusinessContext: args.useBusinessContext === true,
    }),
    fields: [
      { name: 'templateId', type: 'string', required: true },
      { name: 'theme', type: 'string', required: true, description: 'The new topic/theme' },
      { name: 'useBusinessContext', type: 'boolean' },
    ],
  },
  {
    name: 'best-posts',
    group: 'analytics',
    description: 'Read the business\'s top-performing posts for a time window.',
    method: 'GET',
    path: (_args, ctx) => `/api/v1/business/${business(ctx)}/analytics/best-posts`,
    query: args => compact({
      days: num(args, 'days') ?? 30,
      platform: str(args, 'platform'),
      limit: num(args, 'limit') ?? 5,
    }),
    fields: [
      { name: 'days', type: 'number' },
      { name: 'platform', type: 'string' },
      { name: 'limit', type: 'number' },
    ],
  },
  {
    name: 'performance',
    group: 'analytics',
    description: 'Read the business performance summary for a time window.',
    method: 'GET',
    path: (_args, ctx) => `/api/v1/business/${business(ctx)}/analytics/performance`,
    query: args => compact({
      days: num(args, 'days') ?? 30,
      platform: str(args, 'platform'),
    }),
    fields: [
      { name: 'days', type: 'number' },
      { name: 'platform', type: 'string' },
    ],
  },
  {
    name: 'virality-score',
    group: 'analytics',
    description: 'Score a draft caption for virality before posting.',
    method: 'POST',
    path: (_args, ctx) => `/api/v1/business/${business(ctx)}/analytics/virality`,
    body: args => ({ content: requireStr(args, 'content'), platform: str(args, 'platform') }),
    fields: [
      { name: 'content', type: 'string', required: true },
      { name: 'platform', type: 'string' },
    ],
  },
  {
    name: 'business-context',
    group: 'business',
    description: 'Read the published brand playbook context for this business.',
    method: 'GET',
    path: (_args, ctx) => `/api/v1/business/${business(ctx)}/context`,
    fields: [],
  },
  {
    name: 'playbook-current',
    group: 'business',
    description: 'Read the current brand playbook edition.',
    method: 'GET',
    path: (_args, ctx) => `/api/v1/business/${business(ctx)}/playbook/current`,
    fields: [],
  },
  {
    name: 'list-carousels',
    group: 'content',
    description: 'List saved carousel decks for this business.',
    method: 'GET',
    path: () => '/api/v1/carousel',
    query: (_args, ctx) => ({ businessId: business(ctx) }),
    fields: [],
  },
  {
    name: 'list-menu-boards',
    group: 'content',
    description: 'List saved menu boards for this business.',
    method: 'GET',
    path: () => '/api/v1/menu-board',
    query: (_args, ctx) => ({ businessId: business(ctx) }),
    fields: [],
  },
]

export interface FeatureSummary {
  name: string
  group: FeatureGroup
  description: string
}

export interface FeatureDetail extends FeatureSummary {
  fields: FeatureField[]
}

const FEATURE_MAP = new Map(NATIVE_FEATURES.map(feature => [feature.name, feature]))

export function listNativeFeatures(): FeatureSummary[] {
  return NATIVE_FEATURES.map(feature => ({ name: feature.name, group: feature.group, description: feature.description }))
}

export function nativeFeatureDetail(name: string): FeatureDetail | undefined {
  const feature = FEATURE_MAP.get(name)
  return feature ? { name: feature.name, group: feature.group, description: feature.description, fields: feature.fields } : undefined
}

function validate(feature: FeatureDefinition, args: FeatureArgs): void {
  for (const field of feature.fields) {
    if (!field.required) continue
    const value = args[field.name]
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing required argument "${field.name}" for ${feature.name}`)
    }
  }
}

export async function runNativeFeature(ctx: AgentToolContext, name: string, args: FeatureArgs): Promise<unknown> {
  const feature = FEATURE_MAP.get(name)
  if (!feature) throw new Error(`Unknown feature "${name}". Call list_features first.`)
  validate(feature, args)
  const featureCtx: FeatureContext = { businessId: ctx.businessId }
  const path = feature.path(args, featureCtx)
  const query = feature.query?.(args, featureCtx)
  const body = feature.body?.(args, featureCtx)
  return appApi<unknown>(ctx, path, {
    method: feature.method,
    ...(query ? { query } : {}),
    ...(body !== undefined ? { body } : {}),
  })
}

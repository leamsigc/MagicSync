import { getTableColumns, type Column } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import {
  account,
  accountMetrics,
  agentChatEntries,
  agentChatSessions,
  agentDefinitions,
  agentGoalRuns,
  agentRuns,
  agentVersions,
  apikey,
  approvalRecords,
  assetFolders,
  assets,
  auditLog,
  businessBrandKeys,
  businessCorpusSections,
  businessProfiles,
  chatMessages,
  chatThreads,
  contentArtifacts,
  contentChecks,
  contentItemEvents,
  contentItems,
  contentRuns,
  contentTemplates,
  documentChunks,
  documents,
  entityDetails,
  inboxItems,
  invitation,
  jwks,
  knowledgeFolders,
  member,
  notificationPreferences,
  notifications,
  oauthAccessToken,
  oauthClient,
  oauthClientAssertion,
  oauthClientResource,
  oauthConsent,
  oauthRefreshToken,
  oauthResource,
  organization,
  pipelineRuns,
  pipelines,
  platformPosts,
  postMetrics,
  posts,
  publishConnections,
  publishingJobs,
  reviews,
  session,
  skillDefinitions,
  skills,
  skillVersions,
  socialMediaAccountManagers,
  socialMediaAccounts,
  statsSyncState,
  templateAssets,
  templates,
  user,
  userLlmConfigs,
  verification,
} from '#layers/BaseDB/db/schema'

/**
 * Registry behind the admin data browser (`/app/admin/data`).
 *
 * Every Drizzle table is listed here so the generic CRUD page has one
 * authoritative source for labels, grouping, primary keys and the columns the
 * browser must never render or edit (secrets, token columns, vector blobs).
 * Column shapes themselves are derived from Drizzle via `getTableColumns`, so
 * this file only carries policy — not duplicated schemas.
 *
 * The browser is admin-only (routes verify `role === 'admin'`) and therefore
 * intentionally operates across every tenant. That is the one place the
 * "fold ownership into the predicate" rule does not apply; every other path
 * keeps its owner-scoped queries.
 */

export interface AdminTableConfig {
  /** Route slug: `/app/admin/data/<key>` */
  key: string
  label: string
  group: string
  table: SQLiteTable
  /** Property names of the primary key. Defaults to `['id']` (composite allowed). */
  pk?: string[]
  /** Never listed and never editable — secrets, tokens and binary payloads. */
  hidden?: string[]
  /** Listed but never editable. */
  readOnly?: string[]
}

export interface AdminColumnMeta {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'datetime' | 'json' | 'enum'
  editable: boolean
  pk: boolean
  notNull: boolean
  enumValues?: string[]
}

export interface AdminTableSummary {
  key: string
  label: string
  group: string
  rowCount: number | null
}

export const ROW_KEY_SEPARATOR = '\u001f'

const AUTO_READ_ONLY = new Set(['id', 'createdAt', 'updatedAt'])

/**
 * Text columns with these names read as prose, so the edit form renders a
 * textarea instead of a one-line input. Name-based on purpose: Drizzle does not
 * carry column length, and these keys are stable across the schema.
 */
const LONG_TEXT_KEYS = new Set([
  'content',
  'description',
  'details',
  'text',
  'message',
  'body',
  'html',
  'prompt',
  'systemPrompt',
  'instructions',
  'notes',
  'summary',
  'result',
  'output',
  'error',
  'lastError',
  'userAgent',
])

type EnumColumn = Column & { enumValues?: readonly string[] }

function entry(
  key: string,
  label: string,
  group: string,
  table: SQLiteTable,
  extra: Partial<Pick<AdminTableConfig, 'pk' | 'hidden' | 'readOnly'>> = {},
): AdminTableConfig {
  return { key, label, group, table, ...extra }
}

export const adminTableRegistry: AdminTableConfig[] = [
  entry('user', 'Users', 'Authentication', user),
  entry('session', 'Sessions', 'Authentication', session, { hidden: ['token'] }),
  entry('account', 'OAuth Accounts', 'Authentication', account, {
    hidden: ['accessToken', 'refreshToken', 'idToken', 'password'],
  }),
  entry('verification', 'Verification Tokens', 'Authentication', verification, { hidden: ['value'] }),
  entry('organization', 'Organizations', 'Authentication', organization),
  entry('member', 'Organization Members', 'Authentication', member),
  entry('invitation', 'Invitations', 'Authentication', invitation),
  entry('apikey', 'API Keys', 'Authentication', apikey, { hidden: ['key'] }),

  entry('jwks', 'Signing Keys', 'OAuth Server', jwks, { hidden: ['privateKey'] }),
  entry('oauthClient', 'OAuth Clients', 'OAuth Server', oauthClient, { hidden: ['clientSecret'] }),
  entry('oauthResource', 'OAuth Resources', 'OAuth Server', oauthResource),
  entry('oauthClientResource', 'OAuth Client Resources', 'OAuth Server', oauthClientResource),
  entry('oauthRefreshToken', 'Refresh Tokens', 'OAuth Server', oauthRefreshToken, {
    hidden: ['token', 'rotationReplayResponse'],
  }),
  entry('oauthAccessToken', 'Access Tokens', 'OAuth Server', oauthAccessToken, { hidden: ['token'] }),
  entry('oauthConsent', 'OAuth Consents', 'OAuth Server', oauthConsent),
  entry('oauthClientAssertion', 'Client Assertions', 'OAuth Server', oauthClientAssertion),

  entry('businessProfiles', 'Businesses', 'Businesses', businessProfiles),
  entry('businessBrandKeys', 'Brand Keys', 'Businesses', businessBrandKeys),
  entry('businessCorpusSections', 'Corpus Sections', 'Businesses', businessCorpusSections),
  entry('entityDetails', 'Entity Details', 'Businesses', entityDetails),

  entry('posts', 'Posts', 'Posts & Social', posts),
  entry('platformPosts', 'Platform Posts', 'Posts & Social', platformPosts),
  entry('socialMediaAccounts', 'Social Accounts', 'Posts & Social', socialMediaAccounts, {
    hidden: ['accessToken', 'refreshToken', 'accessTokenEncrypted', 'refreshTokenEncrypted'],
  }),
  entry('socialMediaAccountManagers', 'Social Account Managers', 'Posts & Social', socialMediaAccountManagers, {
    pk: ['socialMediaAccountId', 'userId'],
  }),
  entry('reviews', 'Reviews', 'Posts & Social', reviews),

  entry('assets', 'Assets', 'Media & Templates', assets),
  entry('assetFolders', 'Asset Folders', 'Media & Templates', assetFolders),
  entry('templates', 'Templates', 'Media & Templates', templates),
  entry('templateAssets', 'Template Assets', 'Media & Templates', templateAssets),

  entry('knowledgeFolders', 'Knowledge Folders', 'Knowledge & Chat', knowledgeFolders),
  entry('documents', 'Documents', 'Knowledge & Chat', documents),
  entry('documentChunks', 'Document Chunks', 'Knowledge & Chat', documentChunks, { hidden: ['embedding'] }),
  entry('chatThreads', 'Chat Threads', 'Knowledge & Chat', chatThreads),
  entry('chatMessages', 'Chat Messages', 'Knowledge & Chat', chatMessages),

  entry('contentItems', 'Board Items', 'Content Board', contentItems),
  entry('contentItemEvents', 'Board Events', 'Content Board', contentItemEvents),
  entry('contentChecks', 'Content Checks', 'Content Board', contentChecks),
  entry('contentRuns', 'Content Runs', 'Content Board', contentRuns),
  entry('contentTemplates', 'Content Templates', 'Content Board', contentTemplates),
  entry('contentArtifacts', 'Content Artifacts', 'Content Board', contentArtifacts),
  entry('approvalRecords', 'Approval Records', 'Content Board', approvalRecords),
  entry('agentChatSessions', 'Agent Chat Sessions', 'Content Board', agentChatSessions),
  entry('agentChatEntries', 'Agent Chat Entries', 'Content Board', agentChatEntries),

  entry('skills', 'Skills', 'Agent Platform', skills),
  entry('skillDefinitions', 'Skill Definitions', 'Agent Platform', skillDefinitions),
  entry('skillVersions', 'Skill Versions', 'Agent Platform', skillVersions),
  entry('agentDefinitions', 'Agent Definitions', 'Agent Platform', agentDefinitions),
  entry('agentVersions', 'Agent Versions', 'Agent Platform', agentVersions),
  entry('pipelines', 'Pipelines', 'Agent Platform', pipelines),
  entry('pipelineRuns', 'Pipeline Runs', 'Agent Platform', pipelineRuns),
  entry('agentRuns', 'Agent Runs', 'Agent Platform', agentRuns),
  entry('agentGoalRuns', 'Agent Goal Runs', 'Agent Platform', agentGoalRuns),

  entry('publishConnections', 'Publish Connections', 'Publishing', publishConnections, {
    hidden: ['secret', 'secretRef'],
  }),
  entry('publishingJobs', 'Publishing Jobs', 'Publishing', publishingJobs),

  entry('accountMetrics', 'Account Metrics', 'Metrics & Inbox', accountMetrics),
  entry('postMetrics', 'Post Metrics', 'Metrics & Inbox', postMetrics),
  entry('statsSyncState', 'Stats Sync State', 'Metrics & Inbox', statsSyncState),
  entry('inboxItems', 'Inbox Items', 'Metrics & Inbox', inboxItems),

  entry('notifications', 'Notifications', 'Notifications & AI', notifications),
  entry('notificationPreferences', 'Notification Preferences', 'Notifications & AI', notificationPreferences),
  entry('userLlmConfigs', 'LLM Configs', 'Notifications & AI', userLlmConfigs, { hidden: ['apiKey'] }),

  entry('auditLog', 'Audit Log', 'System', auditLog),
]

export function getAdminTable(key: string): AdminTableConfig | undefined {
  return adminTableRegistry.find(item => item.key === key)
}

export function getPrimaryKeyFields(config: AdminTableConfig): string[] {
  return config.pk ?? ['id']
}

export function humanizeColumn(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  return spaced
    .split(' ')
    .map(word => (word.toLowerCase() === 'id' ? 'ID' : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
}

function getEnumValues(column: Column): string[] {
  const values = (column as EnumColumn).enumValues
  return Array.isArray(values) ? [...values] : []
}

const DATA_TYPE_EDITORS: Record<string, AdminColumnMeta['type']> = {
  date: 'datetime',
  number: 'number',
  boolean: 'boolean',
  json: 'json',
}

function inferEditorType(key: string, column: Column): AdminColumnMeta['type'] {
  if (getEnumValues(column).length > 0) return 'enum'
  const byDataType = DATA_TYPE_EDITORS[column.dataType ?? '']
  if (byDataType) return byDataType
  if (column.dataType === 'string' && LONG_TEXT_KEYS.has(key)) return 'textarea'
  return 'text'
}

function isColumnEditable(key: string, config: AdminTableConfig): boolean {
  if (AUTO_READ_ONLY.has(key)) return false
  if (getPrimaryKeyFields(config).includes(key)) return false
  if (config.readOnly?.includes(key)) return false
  return true
}

function toColumnMeta(key: string, column: Column, config: AdminTableConfig): AdminColumnMeta {
  const enumValues = getEnumValues(column)
  return {
    key,
    label: humanizeColumn(key),
    type: inferEditorType(key, column),
    editable: isColumnEditable(key, config),
    pk: getPrimaryKeyFields(config).includes(key),
    notNull: column.notNull,
    enumValues: enumValues.length > 0 ? enumValues : undefined,
  }
}

export function buildAdminColumns(config: AdminTableConfig): AdminColumnMeta[] {
  const columns = getTableColumns(config.table)
  return Object.entries(columns)
    .filter(([key]) => !config.hidden?.includes(key))
    .map(([key, column]) => toColumnMeta(key, column, config))
}

export function encodeRowKey(config: AdminTableConfig, row: Record<string, unknown>): string {
  return getPrimaryKeyFields(config)
    .map(field => String(row[field] ?? ''))
    .join(ROW_KEY_SEPARATOR)
}

export function decodeRowKey(config: AdminTableConfig, key: string): string[] {
  return key.split(ROW_KEY_SEPARATOR)
}

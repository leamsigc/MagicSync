import type { InferSelectModel } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { user } from '../auth/auth'
import { businessProfiles } from '../business/business'

// JSON Web Key Set for the better-auth jwt() plugin (signs OAuth/OIDC tokens).
// Table/column shape mirrors better-auth's own schema (see getAuthTables);
// string[]/json fields are TEXT columns — the drizzle adapter serializes them.
export const jwks = sqliteTable('jwks', {
  id: text('id').primaryKey(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  alg: text('alg'),
  crv: text('crv'),
})

// OAuth 2.1 clients (MCP connectors register here via DCR/CIMD).
export const oauthClient = sqliteTable('oauth_client', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().unique(),
  clientSecret: text('client_secret'),
  clientDiscoveryId: text('client_discovery_id'),
  disabled: integer('disabled', { mode: 'boolean' }).default(false),
  skipConsent: integer('skip_consent', { mode: 'boolean' }),
  enableEndSession: integer('enable_end_session', { mode: 'boolean' }),
  subjectType: text('subject_type'),
  scopes: text('scopes'),
  clientCredentialsScopes: text('client_credentials_scopes'),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()),
  name: text('name'),
  uri: text('uri'),
  icon: text('icon'),
  contacts: text('contacts'),
  tos: text('tos'),
  policy: text('policy'),
  softwareId: text('software_id'),
  softwareVersion: text('software_version'),
  softwareStatement: text('software_statement'),
  redirectUris: text('redirect_uris').notNull(),
  postLogoutRedirectUris: text('post_logout_redirect_uris'),
  backchannelLogoutUri: text('backchannel_logout_uri'),
  backchannelLogoutSessionRequired: integer('backchannel_logout_session_required', { mode: 'boolean' }),
  tokenEndpointAuthMethod: text('token_endpoint_auth_method'),
  applicationType: text('application_type'),
  jwks: text('jwks'),
  jwksUri: text('jwks_uri'),
  grantTypes: text('grant_types'),
  responseTypes: text('response_types'),
  requirePKCE: integer('require_pkce', { mode: 'boolean' }),
  dpopBoundAccessTokens: integer('dpop_bound_access_tokens', { mode: 'boolean' }).default(false),
  referenceId: text('reference_id'),
  metadata: text('metadata'),
})

// Protected resources the AS issues tokens for (one row per deployment's /mcp).
export const oauthResource = sqliteTable('oauth_resource', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull().unique(),
  name: text('name').notNull(),
  accessTokenTtl: integer('access_token_ttl'),
  refreshTokenTtl: integer('refresh_token_ttl'),
  signingAlgorithm: text('signing_algorithm'),
  signingKeyId: text('signing_key_id'),
  allowedScopes: text('allowed_scopes'),
  customClaims: text('custom_claims'),
  dpopBoundAccessTokensRequired: integer('dpop_bound_access_tokens_required', { mode: 'boolean' }).default(false),
  disabled: integer('disabled', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()),
  policyVersion: integer('policy_version').default(1),
  metadata: text('metadata'),
})

// Client ↔ resource links (which clients may request which resources).
export const oauthClientResource = sqliteTable('oauth_client_resource', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => oauthClient.clientId, { onDelete: 'cascade' }),
  resourceId: text('resource_id').notNull().references(() => oauthResource.identifier, { onDelete: 'cascade' }),
  metadata: text('metadata'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()),
}, table => [
  // Composite unique mirrors better-auth's own index.
  uniqueIndex('oauth_client_resource_client_resource').on(table.clientId, table.resourceId),
])

// Refresh tokens (rotation + 30s reuse window per mcp() defaults).
export const oauthRefreshToken = sqliteTable('oauth_refresh_token', {
  id: text('id').primaryKey(),
  token: text('token').notNull().unique(),
  clientId: text('client_id').notNull().references(() => oauthClient.clientId, { onDelete: 'cascade' }),
  sessionId: text('session_id'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  referenceId: text('reference_id'),
  authorizationCodeId: text('authorization_code_id'),
  resources: text('resources'),
  requestedUserInfoClaims: text('requested_user_info_claims'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()),
  revoked: integer('revoked', { mode: 'timestamp' }),
  rotatedAt: integer('rotated_at', { mode: 'timestamp' }),
  rotationReplayResponse: text('rotation_replay_response'),
  rotationReplayExpiresAt: integer('rotation_replay_expires_at', { mode: 'timestamp' }),
  authTime: integer('auth_time', { mode: 'timestamp' }),
  confirmation: text('confirmation'),
  scopes: text('scopes').notNull(),
})

// Access tokens (JWT when a resource is requested — our MCP case).
export const oauthAccessToken = sqliteTable('oauth_access_token', {
  id: text('id').primaryKey(),
  token: text('token').unique(),
  clientId: text('client_id').notNull().references(() => oauthClient.clientId, { onDelete: 'cascade' }),
  sessionId: text('session_id'),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  referenceId: text('reference_id'),
  authorizationCodeId: text('authorization_code_id'),
  resources: text('resources'),
  requestedUserInfoClaims: text('requested_user_info_claims'),
  refreshId: text('refresh_id').references(() => oauthRefreshToken.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()),
  revoked: integer('revoked', { mode: 'timestamp' }),
  confirmation: text('confirmation'),
  scopes: text('scopes').notNull(),
})

// User consents (client × user). businessId is OUR extension (declared in the
// mcp() plugin `schema` option in packages/auth/lib/auth.ts): the business the
// user picked on the consent screen — every OAuth token for this grant is
// scoped to exactly that business, mirroring per-business API keys.
export const oauthConsent = sqliteTable('oauth_consent', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => oauthClient.clientId, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  referenceId: text('reference_id'),
  resources: text('resources'),
  requestedUserInfoClaims: text('requested_user_info_claims'),
  scopes: text('scopes').notNull(),
  businessId: text('business_id').references(() => businessProfiles.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()),
})

// Single-use private_key_jwt assertion ids (replay protection).
export const oauthClientAssertion = sqliteTable('oauth_client_assertion', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
})

export type Jwks = InferSelectModel<typeof jwks>
export type OauthClient = InferSelectModel<typeof oauthClient>
export type OauthResource = InferSelectModel<typeof oauthResource>
export type OauthClientResource = InferSelectModel<typeof oauthClientResource>
export type OauthRefreshToken = InferSelectModel<typeof oauthRefreshToken>
export type OauthAccessToken = InferSelectModel<typeof oauthAccessToken>
export type OauthConsent = InferSelectModel<typeof oauthConsent>
export type OauthClientAssertion = InferSelectModel<typeof oauthClientAssertion>

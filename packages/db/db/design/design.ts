import type { InferSelectModel } from 'drizzle-orm'
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { user } from '../auth/auth'
import { businessProfiles } from '../business/business'
import { templates } from '../templates/templates'

/**
 * Design-studio tables (2026-11 studio upgrade).
 *
 * Designs live in the existing `templates` table (type 'IMAGES', versioned
 * envelope in `content`) — see design.service.ts. These three tables only add
 * Polotno-parity automation features: version history, brand kits and render
 * webhooks.
 */

export const designVersions = sqliteTable('design_versions', {
  id: text('id').primaryKey(),
  templateId: text('templateId').notNull().references(() => templates.id, { onDelete: 'cascade' }),
  authorId: text('authorId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
})

export const brandKits = sqliteTable('brand_kits', {
  id: text('id').primaryKey(),
  ownerId: text('ownerId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  businessId: text('businessId').references(() => businessProfiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  colors: text('colors', { mode: 'json' }).notNull().default([]),
  fonts: text('fonts', { mode: 'json' }).notNull().default({}),
  logoUrl: text('logoUrl'),
  defaults: text('defaults', { mode: 'json' }).notNull().default({}),
  isDefault: integer('isDefault', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
})

export const designWebhooks = sqliteTable('design_webhooks', {
  id: text('id').primaryKey(),
  ownerId: text('ownerId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  businessId: text('businessId'),
  url: text('url').notNull(),
  secret: text('secret').notNull(),
  events: text('events', { mode: 'json' }).notNull().default([]),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  description: text('description'),
  lastAttempts: text('lastAttempts', { mode: 'json' }).notNull().default([]),
  deliveryCount: integer('deliveryCount').notNull().default(0),
  failureCount: integer('failureCount').notNull().default(0),
  createdAt: integer('createdAt', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
})

/** Design render output retention marker (batch outputs deleted after TTL). */
export const designRenderJobs = sqliteTable('design_render_jobs', {
  id: text('id').primaryKey(),
  ownerId: text('ownerId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // render | batch | mp4
  templateId: text('templateId'),
  status: text('status').notNull(), // ok | failed
  count: integer('count').notNull().default(1),
  warnings: text('warnings', { mode: 'json' }).notNull().default([]),
  durationMs: real('durationMs'),
  renderingMs: real('renderingMs'),
  requestedAt: integer('requestedAt', { mode: 'timestamp' }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
})

export type DesignVersion = InferSelectModel<typeof designVersions>
export type BrandKit = InferSelectModel<typeof brandKits>
export type DesignWebhook = InferSelectModel<typeof designWebhooks>
export type DesignRenderJob = InferSelectModel<typeof designRenderJobs>
